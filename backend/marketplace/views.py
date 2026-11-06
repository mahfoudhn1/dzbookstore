from django.conf import settings
from django.db.models import Avg, F, Prefetch, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import (
    AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response

from accounts.models import BookstoreProfile, IndividualSellerProfile, User
from accounts.permissions import IsOwnerOrReadOnly
from catalog.models import Work
from discovery.search import apply_offer_filters
from geo.models import Wilaya
from notifications.services import notify
from .checkout import (
    ALLOWED_TRANSITIONS, CheckoutError, build_quote, cancel_order, delivery_options_for_offer,
    place_order, transition_suborder,
)
from .listing import ListingError, can_manage, create_listing, update_listing
from .models import (
    FavoriteBookstore, FavoriteSeller, Offer, Order, OrderEvent, OrderItem, Review,
    SavedSearch, SubOrder, Wishlist,
)
from .serializers import (
    BookWriteSerializer, FavoriteBookstoreSerializer, FavoriteSellerSerializer,
    OfferSerializer, OrderSerializer, ReviewSerializer, SavedSearchSerializer,
    SubOrderSerializer, WishlistSerializer,
)


def _resolve_user(request):
    """Authenticated user, with the seeded demo fallback when enabled."""
    if request.user is not None and request.user.is_authenticated:
        return request.user
    if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
        return None
    user_id = request.data.get('buyer_id') if isinstance(request.data, dict) else None
    if user_id:
        return User.objects.filter(id=user_id).first()
    return User.objects.filter(role=User.Role.BUYER).first()


def _user_for_bookstore(store_id):
    return BookstoreProfile.objects.filter(id=store_id).select_related('user').first()


class OfferViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OfferSerializer
    permission_classes = [AllowAny]
    filterset_fields = [
        'work_id', 'bookstore_id', 'individual_seller_id', 'seller_type',
        'condition', 'has_store_pickup', 'has_home_delivery', 'has_stop_desk_delivery'
    ]
    search_fields = ['work__title', 'bookstore__store_name', 'individual_seller__display_name', 'edition__isbn13']
    ordering_fields = ['price', 'created_at', 'units_sold']

    def get_queryset(self):
        qs, _meta = apply_offer_filters(self.request)
        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Offer.objects.filter(id=instance.id).update(views_count=F('views_count') + 1)
        instance.refresh_from_db(fields=['views_count'])
        return Response(self.get_serializer(instance).data)


class BookViewSet(viewsets.ModelViewSet):
    """CRUD for seller listings, exposed as ``/api/books/``.

    The seller type and library are never taken from the payload: a user with
    a library profile publishes into that library, every other account
    publishes a second-hand copy (``bookstore=None``, one unit in stock).
    """

    serializer_class = OfferSerializer
    lookup_field = 'pk'
    filterset_fields = [
        'work_id', 'bookstore_id', 'individual_seller_id', 'seller_type',
        'condition', 'status', 'is_in_stock',
    ]
    search_fields = ['work__title', 'bookstore__store_name', 'individual_seller__display_name']
    ordering_fields = ['price', 'created_at', 'units_sold', 'stock_quantity']

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsOwnerOrReadOnly()]
        if self.action == 'create':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        if self.action in ('update', 'partial_update', 'destroy'):
            return Offer.objects.select_related(
                'work', 'edition', 'edition__publisher', 'bookstore',
                'bookstore__wilaya', 'individual_seller', 'individual_seller__wilaya',
            )
        return apply_offer_filters(self.request)[0]

    def create(self, request, *args, **kwargs):
        serializer = BookWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            offer = create_listing(request.user, serializer.validated_data)
        except ListingError as exc:
            return Response(
                {'error': exc.message, **exc.details},
                status=status.HTTP_400_BAD_REQUEST,
            )
        output = OfferSerializer(offer, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        offer = self.get_object()
        serializer = BookWriteSerializer(instance=offer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            offer = update_listing(offer, serializer.validated_data)
        except ListingError as exc:
            return Response(
                {'error': exc.message, **exc.details},
                status=status.HTTP_400_BAD_REQUEST,
            )
        output = OfferSerializer(offer, context=self.get_serializer_context())
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        offer = self.get_object()
        if offer.order_items.exists():
            return Response(
                {
                    'error': (
                        'Cette annonce a déjà des commandes : mettez-la en pause '
                        'plutôt que de la supprimer.'
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        offer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only; all mutations go through the explicit transition endpoints."""

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return Order.objects.filter(buyer=self.request.user).prefetch_related(
            'items__offer__work', 'suborders__items', 'events'
        )


# ----------------- CART & CHECKOUT -----------------

@api_view(['POST'])
@permission_classes([AllowAny])
def checkout_quote_view(request):
    """Validate stock/prices and return the per-seller split without ordering."""
    quote, _offers = build_quote(
        request.data.get('items', []),
        delivery_choices=request.data.get('delivery') or {},
    )
    return Response(quote, status=200 if quote['valid'] else status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def checkout_view(request):
    buyer = _resolve_user(request)
    if buyer is None:
        return Response({'error': 'Authentification requise.'}, status=status.HTTP_401_UNAUTHORIZED)

    data = request.data
    wilaya = None
    if data.get('recipient_wilaya') or data.get('wilaya_id'):
        wilaya_id = data.get('recipient_wilaya') or data.get('wilaya_id')
        wilaya = Wilaya.objects.filter(id=wilaya_id).first()
    elif buyer.wilaya_id:
        wilaya = buyer.wilaya
    if wilaya is None:
        return Response({'error': 'Wilaya de livraison invalide.'}, status=400)

    recipient_name = data.get('recipient_name') or buyer.get_full_name() or buyer.username
    recipient_phone = data.get('recipient_phone') or buyer.phone or ''
    if not recipient_phone:
        return Response({'error': 'Un numéro de téléphone est requis.'}, status=400)

    try:
        order, quote = place_order(
            buyer,
            data.get('items', []),
            delivery_choices=data.get('delivery') or {},
            payment_method=data.get('payment_method'),
            delivery_type=data.get('delivery_type'),
            recipient_name=recipient_name,
            recipient_phone=recipient_phone,
            recipient_wilaya=wilaya,
            recipient_address=data.get('recipient_address') or buyer.address or '',
            notes=data.get('notes', ''),
        )
    except CheckoutError as exc:
        return Response(
            {'error': str(exc), 'issues': exc.issues},
            status=status.HTTP_409_CONFLICT,
        )

    order = Order.objects.select_related('buyer', 'recipient_wilaya').prefetch_related(
        'items__offer__work', 'suborders__items', 'events'
    ).get(id=order.id)
    return Response(
        {'order': OrderSerializer(order).data, 'quote': quote},
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def delivery_options_view(request):
    offer_id = request.query_params.get('offer_id')
    offer = Offer.objects.select_related('bookstore', 'individual_seller').filter(id=offer_id).first()
    if offer is None:
        return Response({'error': 'Offre introuvable.'}, status=404)
    return Response({
        'offer_id': offer.id,
        'seller_name': offer.seller_name,
        'options': delivery_options_for_offer(offer),
    })


# ----------------- ORDER LIFECYCLE -----------------

def _order_for_user(order_id, user):
    order = Order.objects.select_related('buyer', 'recipient_wilaya').prefetch_related(
        'items__offer__work', 'suborders__items', 'suborders__events', 'events'
    ).filter(id=order_id).first()
    if order is None:
        return None, None
    if order.buyer_id == user.id:
        return order, 'buyer'
    seller_id = None
    if BookstoreProfile.objects.filter(user=user).exists():
        seller_id = 'bookstore'
    if IndividualSellerProfile.objects.filter(user=user).exists():
        seller_id = 'individual'
    if seller_id and order.suborders.filter(
        Q(bookstore__user=user) | Q(individual_seller__user=user)
    ).exists():
        return order, 'seller'
    if user.is_staff or user.is_admin_user:
        return order, 'admin'
    return order, None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_detail_view(request, order_id):
    order, role = _order_for_user(order_id, request.user)
    if order is None:
        return Response({'error': 'Commande introuvable.'}, status=404)
    if role is None:
        return Response({'error': 'Accès refusé.'}, status=403)
    return Response({'order': OrderSerializer(order).data, 'role': role})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_tracking_view(request, order_id):
    order, role = _order_for_user(order_id, request.user)
    if order is None or role is None:
        return Response({'error': 'Commande introuvable.'}, status=404)
    events = order.events.select_related('suborder').all().order_by('created_at')
    return Response({
        'order_number': order.order_number,
        'status': order.status,
        'tracking_number': order.tracking_number,
        'events': [
            {
                'id': event.id,
                'suborder_id': event.suborder_id,
                'status': event.status,
                'label': event.label,
                'note': event.note,
                'created_at': event.created_at,
            }
            for event in events
        ],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_transition_view(request, order_id):
    """Move one seller suborder forward (or cancel) with validation."""
    order, role = _order_for_user(order_id, request.user)
    if order is None or role is None:
        return Response({'error': 'Commande introuvable.'}, status=404)

    new_status = (request.data.get('status') or '').upper()
    suborder_id = request.data.get('suborder_id')
    valid_statuses = {choice for choice, _label in Order.Status.choices}
    if new_status not in valid_statuses:
        return Response({'error': 'Statut invalide.'}, status=400)

    suborders = order.suborders.all()
    if role == 'seller':
        # A seller may only ever move its own suborder, even when it guesses
        # another seller's suborder id.
        suborders = suborders.filter(
            Q(bookstore__user=request.user) | Q(individual_seller__user=request.user)
        )
    if suborder_id:
        suborders = suborders.filter(id=suborder_id)
    suborder = suborders.first()
    if suborder is None:
        return Response({'error': 'Sous-commande introuvable.'}, status=404)

    if role == 'buyer' and new_status != Order.Status.CANCELLED:
        return Response({'error': 'L’acheteur ne peut qu’annuler.'}, status=403)
    if role == 'buyer':
        try:
            cancelled = cancel_order(order, request.data.get('reason', ''), actor=request.user)
        except CheckoutError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_409_CONFLICT)
        order.refresh_from_db()
        return Response({
            'success': True,
            'order_status': order.status,
            'cancelled_suborders': [item.id for item in cancelled],
        })

    tracking_number = request.data.get('tracking_number')
    carrier = request.data.get('carrier')
    if tracking_number:
        if role not in ('seller', 'admin'):
            return Response({'error': 'Seul le vendeur peut ajouter un suivi.'}, status=403)
        suborder.tracking_number = tracking_number
        order.tracking_number = tracking_number
    if carrier:
        suborder.carrier = carrier
    if tracking_number or carrier:
        suborder.save(update_fields=['tracking_number', 'carrier', 'updated_at'])
        order.save(update_fields=['tracking_number', 'updated_at'])

    try:
        transition_suborder(
            suborder,
            new_status,
            actor=request.user,
            note=request.data.get('note') or request.data.get('seller_notes'),
        )
    except CheckoutError as exc:
        return Response(
            {'error': str(exc), 'issues': exc.issues},
            status=status.HTTP_409_CONFLICT,
        )

    order.refresh_from_db()
    return Response({
        'success': True,
        'order_status': order.status,
        'suborder': SubOrderSerializer(suborder).data,
        'allowed_next': sorted(ALLOWED_TRANSITIONS.get(suborder.status, set())),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_cancel_view(request, order_id):
    order, role = _order_for_user(order_id, request.user)
    if order is None or role is None:
        return Response({'error': 'Commande introuvable.'}, status=404)
    if role not in ('buyer', 'seller', 'admin'):
        return Response({'error': 'Accès refusé.'}, status=403)

    try:
        cancelled = cancel_order(order, request.data.get('reason', ''), actor=request.user)
    except CheckoutError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_409_CONFLICT)

    return Response({
        'success': True,
        'cancelled_suborders': [suborder.id for suborder in cancelled],
        'order_status': Order.objects.get(id=order.id).status,
    })


# ----------------- BUYER APIS -----------------

@api_view(['GET'])
@permission_classes([AllowAny])
def buyer_orders_view(request):
    """Buyer order history (authenticated, or demo fallback)."""
    if request.user and request.user.is_authenticated:
        buyer = request.user
    else:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response({'error': 'Authentification requise.'}, status=401)
        buyer_email = request.query_params.get('buyer_email')
        buyer = (
            User.objects.filter(email=buyer_email).first() if buyer_email else None
        ) or User.objects.filter(role=User.Role.BUYER).first()

    if not buyer:
        return Response([])

    orders = Order.objects.filter(buyer=buyer).select_related(
        'recipient_wilaya'
    ).prefetch_related(
        'items__offer__work', 'suborders__items', 'suborders__events', 'events'
    ).order_by('-created_at')
    return Response(OrderSerializer(orders, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def buyer_wishlist_view(request):
    """Book wishlist, with price/availability notifications handled on save."""
    user = _resolve_user(request)
    if user is None:
        return Response({'error': 'Authentification requise.'}, status=401)

    if request.method == 'POST':
        work_id = request.data.get('work_id')
        work = Work.objects.filter(id=work_id).first()
        if not work:
            return Response({'error': 'Livre introuvable'}, status=404)

        existing = Wishlist.objects.filter(user=user, work=work).first()
        if existing:
            existing.delete()
            return Response({'saved': False, 'message': 'Retiré des favoris'})
        Wishlist.objects.create(user=user, work=work)
        return Response({'saved': True, 'message': 'Ajouté aux favoris'})

    items = Wishlist.objects.filter(user=user).select_related('work').prefetch_related('work__offers')
    return Response(WishlistSerializer(items, many=True).data)


# ----------------- FAVORITES & SAVED SEARCHES -----------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def favorite_bookstores_view(request):
    if request.method == 'POST':
        bookstore = BookstoreProfile.objects.filter(id=request.data.get('bookstore_id')).first()
        if bookstore is None:
            return Response({'error': 'Librairie introuvable.'}, status=404)
        favorite, created = FavoriteBookstore.objects.get_or_create(
            user=request.user, bookstore=bookstore
        )
        if not created:
            favorite.delete()
            return Response({'saved': False, 'message': 'Librairie retirée des favoris.'})
        return Response({'saved': True, 'message': 'Librairie ajoutée aux favoris.'})

    favorites = FavoriteBookstore.objects.filter(user=request.user).select_related(
        'bookstore__wilaya', 'bookstore__commune'
    )
    return Response(FavoriteBookstoreSerializer(favorites, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def favorite_sellers_view(request):
    if request.method == 'POST':
        seller = IndividualSellerProfile.objects.filter(
            id=request.data.get('seller_id')
        ).first()
        if seller is None:
            return Response({'error': 'Vendeur introuvable.'}, status=404)
        favorite, created = FavoriteSeller.objects.get_or_create(
            user=request.user, individual_seller=seller
        )
        if not created:
            favorite.delete()
            return Response({'saved': False, 'message': 'Vendeur retiré des favoris.'})
        return Response({'saved': True, 'message': 'Vendeur ajouté aux favoris.'})

    favorites = FavoriteSeller.objects.filter(user=request.user).select_related(
        'individual_seller__wilaya', 'individual_seller__commune'
    )
    return Response(FavoriteSellerSerializer(favorites, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def saved_searches_view(request):
    if request.method == 'POST':
        label = (request.data.get('label') or 'Ma recherche').strip()[:180]
        params = request.data.get('query_params') or {}
        if not isinstance(params, dict):
            return Response({'error': 'query_params doit être un objet.'}, status=400)
        saved = SavedSearch.objects.create(
            user=request.user,
            label=label,
            query_params=params,
            notify=bool(request.data.get('notify', True)),
        )
        return Response(SavedSearchSerializer(saved).data, status=201)

    searches = SavedSearch.objects.filter(user=request.user)
    return Response(SavedSearchSerializer(searches, many=True).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def saved_search_detail_view(request, saved_search_id):
    deleted, _ = SavedSearch.objects.filter(
        id=saved_search_id, user=request.user
    ).delete()
    if not deleted:
        return Response({'error': 'Recherche introuvable.'}, status=404)
    return Response(status=204)


# ----------------- REVIEWS -----------------

def _recalculate_seller_rating(seller_type, bookstore_id=None, seller_id=None):
    """Refresh the cached trust score used for individual sellers."""
    if seller_type == 'INDIVIDUAL' and seller_id:
        seller = IndividualSellerProfile.objects.filter(id=seller_id).first()
        if seller:
            average = Review.objects.filter(
                individual_seller_id=seller_id, is_hidden=False
            ).aggregate(value=Avg('rating'))['value']
            if average is not None:
                seller.trust_score = round(average, 2)
                seller.save(update_fields=['trust_score'])
            return average
    return None


@api_view(['POST'])
@permission_classes([AllowAny])
def submit_review_view(request):
    """Only the buyer of a delivered suborder may review that seller, once."""
    buyer = _resolve_user(request)
    if buyer is None:
        return Response({'error': 'Authentification requise.'}, status=401)

    data = request.data
    suborder_id = data.get('suborder_id')
    seller_type = data.get('seller_type', 'BOOKSTORE')
    bookstore_id = data.get('bookstore_id')
    seller_id = data.get('individual_seller_id')

    suborders = SubOrder.objects.filter(order__buyer=buyer, status=Order.Status.DELIVERED)
    if suborder_id:
        suborders = suborders.filter(id=suborder_id)
    elif data.get('order_id'):
        suborders = suborders.filter(
            order_id=data.get('order_id'),
            seller_type=seller_type,
        )
        if seller_type == 'BOOKSTORE' and bookstore_id:
            suborders = suborders.filter(bookstore_id=bookstore_id)
        if seller_type == 'INDIVIDUAL' and seller_id:
            suborders = suborders.filter(individual_seller_id=seller_id)
    else:
        suborders = suborders.filter(seller_type=seller_type)
        if seller_type == 'BOOKSTORE' and bookstore_id:
            suborders = suborders.filter(bookstore_id=bookstore_id)
        if seller_type == 'INDIVIDUAL' and seller_id:
            suborders = suborders.filter(individual_seller_id=seller_id)

    suborder = suborders.filter(review__isnull=True).first()
    if suborder is None:
        return Response(
            {'error': 'Un avis ne peut être déposé qu’après une commande livrée et une seule fois.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        rating = int(data.get('rating', 5))
    except (TypeError, ValueError):
        return Response({'error': 'Note invalide.'}, status=400)
    if not 1 <= rating <= 5:
        return Response({'error': 'La note doit être comprise entre 1 et 5.'}, status=400)

    review = Review.objects.create(
        buyer=buyer,
        seller_type=suborder.seller_type,
        bookstore=suborder.bookstore,
        individual_seller=suborder.individual_seller,
        order=suborder.order,
        suborder=suborder,
        rating=rating,
        comment=data.get('comment', ''),
    )
    _recalculate_seller_rating(
        suborder.seller_type,
        bookstore_id=suborder.bookstore_id,
        seller_id=suborder.individual_seller_id,
    )
    return Response({
        'success': True,
        'review_id': review.id,
        'message': 'Avis publié avec succès',
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def review_report_view(request, review_id):
    reviewer = _resolve_user(request)
    if reviewer is None:
        return Response({'error': 'Authentification requise.'}, status=401)
    review = Review.objects.filter(id=review_id).select_related('bookstore', 'individual_seller').first()
    if review is None:
        return Response({'error': 'Avis introuvable.'}, status=404)
    reason = (request.data.get('reason') or '').strip()
    if not reason:
        return Response({'error': 'Le motif est obligatoire.'}, status=400)

    review.reported_at = timezone.now()
    review.report_reason = reason
    review.reported_by = reviewer
    review.save(update_fields=['reported_at', 'report_reason', 'reported_by'])

    for staff in User.objects.filter(is_staff=True, is_active=True):
        notify(
            staff,
            'MODERATION',
            'Avis signalé',
            f'Avis #{review.id} signalé par {reviewer.email} : {reason}',
            data={'review_id': review.id},
            email=False,
        )
    return Response({'reported': True})


# ----------------- INDIVIDUAL SELLER APIS -----------------

@api_view(['GET'])
@permission_classes([AllowAny])
def seller_my_listings_view(request):
    if request.user and request.user.is_authenticated:
        seller = IndividualSellerProfile.objects.filter(user=request.user).first()
    else:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response({'error': 'Authentification requise.'}, status=401)
        seller_id = request.query_params.get('seller_id')
        seller = (
            IndividualSellerProfile.objects.filter(id=seller_id).first()
            if seller_id else IndividualSellerProfile.objects.first()
        )

    if not seller:
        return Response([])

    offers = Offer.objects.filter(individual_seller=seller).select_related('work', 'edition').order_by('-created_at')
    return Response(OfferSerializer(offers, many=True).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def publish_offer_view(request):
    """Publish a listing for the authenticated user.

    The former client-supplied ``seller_type`` / ``bookstore_id`` /
    ``seller_id`` are gone: the owner (and therefore the library) is always
    derived server-side from the logged-in account.
    """
    publisher = request.user if request.user.is_authenticated else None
    if publisher is None:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response(
                {'error': 'Authentification requise.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        store = BookstoreProfile.objects.select_related('user').first()
        publisher = store.user if store else User.objects.first()
    if publisher is None:
        return Response(
            {'error': 'Aucun compte vendeur disponible.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        offer = create_listing(publisher, request.data)
    except ListingError as exc:
        return Response(
            {'error': exc.message, **exc.details},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({
        'success': True,
        'offer_id': offer.id,
        'work_id': offer.work_id,
        'work_slug': offer.work.slug,
        'work_title': offer.display_title,
        'price': offer.price,
        'stock_quantity': offer.stock_quantity,
        'is_in_stock': offer.is_in_stock,
        'cover_image': offer.work.cover_image or (offer.photos[0] if offer.photos else None),
        'seller_type': offer.seller_type,
        'message': 'Votre offre est en ligne avec succès !',
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def seller_create_listing_view(request):
    """Alias of ``/api/offers/publish/`` for the second-hand seller portal."""
    return publish_offer_view(request)


@api_view(['POST'])
@permission_classes([AllowAny])
def seller_toggle_listing_status_view(request, offer_id):
    offer = Offer.objects.filter(id=offer_id).first()
    if not offer:
        return Response({'error': 'Annonce introuvable'}, status=404)

    if not request.user or not request.user.is_authenticated:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response({'error': 'Authentification requise.'}, status=401)
    elif not can_manage(request.user, offer):
        return Response({'error': 'Cette annonce ne vous appartient pas.'}, status=403)

    new_status = request.data.get('status', 'ACTIVE')
    if new_status in [Offer.Status.ACTIVE, Offer.Status.RESERVED, Offer.Status.SOLD, Offer.Status.PAUSED]:
        if new_status == Offer.Status.ACTIVE and not offer.is_in_stock:
            return Response(
                {'error': 'Réapprovisionnez cette annonce avant de la réactiver.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        offer.status = new_status
        if new_status == Offer.Status.ACTIVE:
            offer.last_availability_confirmed_at = timezone.now()
        offer.save()
        return Response({'success': True, 'status': offer.status})

    return Response({'error': 'Statut invalide'}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_suborders_view(request):
    """Orders containing this seller's items, one row per suborder."""
    qs = SubOrder.objects.filter(
        Q(bookstore__user=request.user) | Q(individual_seller__user=request.user)
    ).select_related(
        'order', 'order__buyer', 'order__recipient_wilaya', 'bookstore', 'individual_seller'
    ).prefetch_related('items__offer__work', 'events')

    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter.upper())

    return Response({
        'count': qs.count(),
        'results': [
            {
                **SubOrderSerializer(suborder).data,
                'order_number': suborder.order.order_number,
                'buyer_name': suborder.order.recipient_name,
                'buyer_phone': suborder.order.recipient_phone,
                'recipient_wilaya': suborder.order.recipient_wilaya.name_fr,
                'recipient_address': suborder.order.recipient_address,
                'order_created_at': suborder.order.created_at,
                'allowed_next': sorted(ALLOWED_TRANSITIONS.get(suborder.status, set())),
            }
            for suborder in qs
        ],
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def seller_confirm_availability_view(request, offer_id):
    """Seller re-confirms that a copy is still available."""
    offer = Offer.objects.filter(id=offer_id).first()
    if not offer:
        return Response({'error': 'Annonce introuvable'}, status=404)
    if not request.user or not request.user.is_authenticated:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response({'error': 'Authentification requise.'}, status=401)
    elif not can_manage(request.user, offer):
        return Response({'error': 'Cette annonce ne vous appartient pas.'}, status=403)
    offer.last_availability_confirmed_at = timezone.now()
    offer.save(update_fields=['last_availability_confirmed_at', 'updated_at'])
    return Response({
        'success': True,
        'last_availability_confirmed_at': offer.last_availability_confirmed_at,
    })
