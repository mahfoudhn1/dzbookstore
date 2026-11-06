from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.utils import timezone

from .models import Notification
from .serializers import NotificationSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_list_view(request):
    # Messages already have their own inbox and unread badge; do not duplicate
    # them in the notifications feed.
    qs = Notification.objects.filter(user=request.user).exclude(
        type=Notification.Type.MESSAGE
    )
    if request.query_params.get('unread_only', '').lower() in ('1', 'true', 'yes'):
        qs = qs.filter(read_at__isnull=True)
    type_filter = request.query_params.get('type')
    if type_filter:
        qs = qs.filter(type=type_filter)

    page_size = min(max(int(request.query_params.get('limit', 30)), 1), 100)
    return Response({
        'count': qs.count(),
        'unread_count': qs.filter(read_at__isnull=True).count(),
        'results': NotificationSerializer(qs[:page_size], many=True).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_read_view(request, notification_id):
    notification = Notification.objects.filter(id=notification_id, user=request.user).first()
    if notification is None:
        return Response({'error': 'Notification introuvable.'}, status=404)
    if notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=['read_at'])
    return Response(NotificationSerializer(notification).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_read_all_view(request):
    updated = Notification.objects.filter(
        user=request.user, read_at__isnull=True
    ).exclude(type=Notification.Type.MESSAGE).update(read_at=timezone.now())
    return Response({'updated': updated})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_unread_count_view(request):
    return Response({
        'unread_count': Notification.objects.filter(
            user=request.user, read_at__isnull=True
        ).exclude(type=Notification.Type.MESSAGE).count()
    })
