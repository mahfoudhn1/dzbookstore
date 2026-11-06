from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from marketplace.models import SubOrder
from notifications.services import notify_reported_content
from .models import Conversation, ConversationReport, Message
from .serializers import ConversationCreateSerializer, ConversationSerializer, MessageSerializer


def _conversations_for(user):
    return Conversation.objects.filter(
        Q(buyer=user)
        | Q(bookstore__user=user)
        | Q(individual_seller__user=user)
    ).select_related(
        'buyer', 'bookstore__user', 'individual_seller__user', 'suborder'
    ).distinct()


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def conversation_list_view(request):
    if request.method == 'POST':
        return _create_conversation(request)

    conversations = _conversations_for(request.user)
    return Response(ConversationSerializer(
        conversations, many=True, context={'request': request}
    ).data)


def _create_conversation(request):
    serializer = ConversationCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    bookstore = data.get('bookstore')
    individual_seller = data.get('individual_seller')
    suborder = None
    suborder_id = data.get('suborder_id')

    if suborder_id:
        suborder = SubOrder.objects.filter(id=suborder_id).select_related(
            'bookstore__user', 'individual_seller__user', 'order'
        ).first()
        if suborder is None:
            return Response({'error': 'Sous-commande introuvable.'}, status=404)
        if suborder.order.buyer_id != request.user.id and not _is_suborder_seller(suborder, request.user):
            return Response({'error': 'Cette commande ne vous appartient pas.'}, status=403)
        bookstore = suborder.bookstore or bookstore
        individual_seller = suborder.individual_seller or individual_seller

    if bookstore and bookstore.user_id == request.user.id:
        return Response({'error': 'Vous ne pouvez pas vous envoyer un message.'}, status=400)
    if individual_seller and individual_seller.user_id == request.user.id:
        return Response({'error': 'Vous ne pouvez pas vous envoyer un message.'}, status=400)

    # The authenticated user is the buyer of the thread, including bookstore
    # accounts that contact another seller. A seller replying from a suborder
    # uses that order's buyer instead.
    buyer = request.user
    if suborder is not None and request.user.id != suborder.order.buyer_id:
        buyer = suborder.order.buyer
    else:
        requested_buyer_id = request.data.get('buyer_id')
        if requested_buyer_id and (
            request.user.role == User.Role.BOOKSTORE_SELLER
            or request.user.is_staff
        ):
            requested = User.objects.filter(id=requested_buyer_id).first()
            if requested is not None:
                buyer = requested

    conversation = Conversation.objects.filter(
        buyer=buyer, bookstore=bookstore, individual_seller=individual_seller, suborder=suborder
    ).first()
    created = False
    if conversation is None:
        conversation = Conversation.objects.create(
            buyer=buyer,
            bookstore=bookstore,
            individual_seller=individual_seller,
            suborder=suborder,
            subject=data.get('subject', ''),
        )
        created = True

    body = (data.get('body') or '').strip()
    if body:
        Message.objects.create(
            conversation=conversation, sender=request.user, body=body
        )
        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=['last_message_at'])
        return Response(
            ConversationSerializer(conversation, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    return Response(
        ConversationSerializer(conversation, context={'request': request}).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


def _is_suborder_seller(suborder, user):
    return (
        (suborder.bookstore_id and suborder.bookstore.user_id == user.id)
        or (suborder.individual_seller_id and suborder.individual_seller.user_id == user.id)
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversation_detail_view(request, conversation_id):
    conversation = _conversations_for(request.user).filter(id=conversation_id).first()
    if conversation is None:
        return Response({'error': 'Conversation introuvable.'}, status=404)

    # Opening a thread marks the other party's messages as read.
    conversation.messages.filter(read_at__isnull=True).exclude(sender=request.user).update(
        read_at=timezone.now()
    )
    return Response({
        'conversation': ConversationSerializer(conversation, context={'request': request}).data,
        'messages': MessageSerializer(
            conversation.messages.filter(is_hidden=False).select_related('sender'), many=True
        ).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def conversation_message_view(request, conversation_id):
    conversation = _conversations_for(request.user).filter(id=conversation_id).first()
    if conversation is None:
        return Response({'error': 'Conversation introuvable.'}, status=404)

    body = (request.data.get('body') or '').strip()
    if not body:
        return Response({'error': 'Le message est vide.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(body) > 5000:
        return Response({'error': 'Message trop long.'}, status=status.HTTP_400_BAD_REQUEST)

    message = Message.objects.create(
        conversation=conversation, sender=request.user, body=body
    )
    conversation.last_message_at = timezone.now()
    conversation.save(update_fields=['last_message_at'])
    return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def message_report_view(request, message_id):
    message = Message.objects.filter(
        id=message_id, conversation__in=_conversations_for(request.user)
    ).select_related('conversation__buyer', 'sender').first()
    if message is None:
        return Response({'error': 'Message introuvable.'}, status=404)

    reason = (request.data.get('reason') or '').strip()
    if not reason:
        return Response({'error': 'Le motif est obligatoire.'}, status=400)

    message.is_reported = True
    message.report_reason = reason
    message.reported_by = request.user
    message.reported_at = timezone.now()
    message.save(update_fields=['is_reported', 'report_reason', 'reported_by', 'reported_at'])

    ConversationReport.objects.create(
        conversation=message.conversation, reporter=request.user, reason=reason
    )
    for staff in User.objects.filter(is_staff=True, is_active=True):
        notify_reported_content(staff, 'message', request.user, reason)

    return Response({'reported': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversation_unread_count_view(request):
    total = Message.objects.filter(
        conversation__in=_conversations_for(request.user),
        read_at__isnull=True,
    ).exclude(sender=request.user).count()
    return Response({'unread_count': total})
