"""Administration: moderation queue, catalog governance and platform metrics."""
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import BookstoreProfile, IndividualSellerProfile, User
from accounts.permissions import IsAdminOrDemo
from catalog.models import Edition, Work
from marketplace.models import Offer, Order, OrderItem, Review, SubOrder
from messaging.models import ConversationReport, Message
from metadata.models import SearchLog
from notifications.services import notify


@api_view(['GET'])
@permission_classes([IsAdminOrDemo])
def moderation_queue_view(request):
    reviews = Review.objects.filter(
        reported_at__isnull=False, is_hidden=False
    ).select_related('buyer', 'bookstore', 'individual_seller').order_by('-reported_at')[:50]
    messages = Message.objects.filter(
        is_reported=True, is_hidden=False
    ).select_related('sender', 'conversation').order_by('-reported_at')[:50]
    conversations = ConversationReport.objects.filter(
        is_resolved=False
    ).select_related('reporter', 'conversation').order_by('-created_at')[:50]

    return Response({
        'reviews': [
            {
                'id': review.id,
                'rating': review.rating,
                'comment': review.comment,
                'seller': (
                    review.bookstore.store_name if review.bookstore
                    else review.individual_seller.display_name if review.individual_seller
                    else None
                ),
                'reported_by': review.reported_by.email if review.reported_by else None,
                'report_reason': review.report_reason,
                'reported_at': review.reported_at,
            }
            for review in reviews
        ],
        'messages': [
            {
                'id': message.id,
                'conversation_id': message.conversation_id,
                'sender': message.sender.email,
                'body': message.body,
                'report_reason': message.report_reason,
                'reported_at': message.reported_at,
            }
            for message in messages
        ],
        'conversations': [
            {
                'id': report.id,
                'conversation_id': report.conversation_id,
                'reporter': report.reporter.email,
                'reason': report.reason,
                'created_at': report.created_at,
            }
            for report in conversations
        ],
    })


@api_view(['POST'])
@permission_classes([IsAdminOrDemo])
def moderate_review_view(request, review_id):
    review = Review.objects.filter(id=review_id).select_related('buyer').first()
    if review is None:
        return Response({'error': 'Avis introuvable.'}, status=404)

    action = (request.data.get('action') or '').upper()
    if action == 'HIDE':
        review.is_hidden = True
    elif action == 'DISMISS':
        review.is_hidden = False
        review.reported_at = None
        review.report_reason = None
        review.reported_by = None
    else:
        return Response({'error': 'Action invalide (HIDE ou DISMISS).'}, status=400)
    review.save()

    if action == 'HIDE':
        notify(
            review.buyer,
            'MODERATION',
            'Votre avis a été masqué',
            'Un avis que vous avez publié ne respecte pas les règles de la communauté.',
            data={'review_id': review.id},
            email=False,
        )
    return Response({'success': True, 'is_hidden': review.is_hidden})


@api_view(['POST'])
@permission_classes([IsAdminOrDemo])
def moderate_message_view(request, message_id):
    message = Message.objects.filter(id=message_id).select_related('sender').first()
    if message is None:
        return Response({'error': 'Message introuvable.'}, status=404)

    action = (request.data.get('action') or '').upper()
    if action == 'HIDE':
        message.is_hidden = True
    elif action == 'DISMISS':
        message.is_reported = False
        message.is_hidden = False
        message.report_reason = None
    else:
        return Response({'error': 'Action invalide (HIDE ou DISMISS).'}, status=400)
    message.save()
    return Response({'success': True, 'is_hidden': message.is_hidden})


@api_view(['POST'])
@permission_classes([IsAdminOrDemo])
def resolve_conversation_report_view(request, report_id):
    report = ConversationReport.objects.filter(id=report_id).first()
    if report is None:
        return Response({'error': 'Signalement introuvable.'}, status=404)
    report.is_resolved = True
    report.save(update_fields=['is_resolved'])
    return Response({'success': True})


@api_view(['GET'])
@permission_classes([IsAdminOrDemo])
def platform_analytics_view(request):
    """Extended platform analytics: popularity, geography and searches."""
    completed_orders = Order.objects.filter(status=Order.Status.DELIVERED)
    total_gmv = Order.objects.aggregate(total=Sum('total_amount'))['total'] or 0

    # Revenue per work is computed from order items to stay accurate.
    revenue_by_work = {}
    for item in OrderItem.objects.select_related('offer__work').values(
        'offer__work_id', 'offer__work__title', 'quantity', 'unit_price'
    ):
        entry = revenue_by_work.setdefault(item['offer__work_id'], {
            'work_id': item['offer__work_id'],
            'title': item['offer__work__title'],
            'units': 0,
            'revenue': 0.0,
        })
        entry['units'] += item['quantity']
        entry['revenue'] += item['quantity'] * item['unit_price']
    popular_books = sorted(
        revenue_by_work.values(), key=lambda row: row['units'], reverse=True
    )[:10]

    popular_authors = list(
        Work.objects.values('authors__id', 'authors__name')
        .annotate(works_count=Count('id', distinct=True))
        .exclude(authors__id__isnull=True)
        .order_by('-works_count')[:10]
    )

    popular_searches = list(
        SearchLog.objects.exclude(normalized_query='')
        .values('normalized_query')
        .annotate(count=Count('id'))
        .order_by('-count')[:10]
    )

    geographic = []
    for row in BookstoreProfile.objects.values('wilaya__name_fr', 'wilaya__code').annotate(
        bookstores=Count('id')
    ).order_by('-bookstores'):
        geographic.append({
            'wilaya': row['wilaya__name_fr'],
            'code': row['wilaya__code'],
            'bookstores': row['bookstores'],
        })

    return Response({
        'total_gmv_dzd': total_gmv,
        'total_orders': Order.objects.count(),
        'completed_orders': completed_orders.count(),
        'completed_revenue_dzd': completed_orders.aggregate(total=Sum('total_amount'))['total'] or 0,
        'active_listings': Offer.objects.filter(status=Offer.Status.ACTIVE).count(),
        'total_listings': Offer.objects.count(),
        'total_catalog_works': Work.objects.count(),
        'total_catalog_editions': Edition.objects.count(),
        'total_users': User.objects.count(),
        'buyers_count': User.objects.filter(role=User.Role.BUYER).count(),
        'bookstores_count': BookstoreProfile.objects.count(),
        'verified_bookstores_count': BookstoreProfile.objects.filter(is_verified=True).count(),
        'pending_bookstores_count': BookstoreProfile.objects.filter(
            verification_status=BookstoreProfile.VerificationStatus.PENDING
        ).count(),
        'individual_sellers_count': IndividualSellerProfile.objects.count(),
        'covered_wilayas_count': BookstoreProfile.objects.values('wilaya_id').distinct().count(),
        'popular_books': popular_books,
        'popular_authors': popular_authors,
        'popular_searches': popular_searches,
        'geographic_distribution': geographic,
        'open_suborders': SubOrder.objects.exclude(
            status__in=[Order.Status.DELIVERED, Order.Status.CANCELLED]
        ).count(),
        'reported_reviews': Review.objects.filter(
            reported_at__isnull=False, is_hidden=False
        ).count(),
        'reported_messages': Message.objects.filter(
            is_reported=True, is_hidden=False
        ).count(),
        'generated_at': timezone.now(),
    })
