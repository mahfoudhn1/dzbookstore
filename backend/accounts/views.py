from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from django.utils.text import slugify
from django.db.models import Avg, Count, Q, Sum
from rest_framework import viewsets, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .emails import send_email_verification, send_password_changed, send_password_reset
from .models import AuthActionToken, User, BookstoreProfile, IndividualSellerProfile
from .permissions import IsAdminOrDemo
from .serializers import (
    BookstoreProfileSerializer,
    IndividualSellerProfileSerializer,
    UserSerializer
)
from geo.models import Wilaya, Commune
from marketplace.models import Order, OrderItem, Offer, SubOrder


def _active_libraries():
    """Libraries whose owner account is still active (not suspended)."""
    return BookstoreProfile.objects.select_related('wilaya', 'commune').filter(
        user__is_active=True, user__is_suspended=False,
    )


def _library_queryset():
    return _active_libraries().annotate(
        rating_average=Avg('reviews__rating'),
        reviews_count=Count('reviews', distinct=True),
        in_stock_count=Count(
            'offers',
            filter=Q(offers__is_in_stock=True, offers__status=Offer.Status.ACTIVE),
            distinct=True,
        ),
    ).order_by('store_name')


class BookstoreViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BookstoreProfileSerializer
    lookup_field = 'slug'
    filterset_fields = ['wilaya_id', 'commune_id', 'is_verified']
    search_fields = ['store_name', 'address', 'description', 'wilaya__name_fr']
    ordering_fields = ['store_name', 'created_at']

    def get_queryset(self):
        return _library_queryset()


class LibraryViewSet(viewsets.ReadOnlyModelViewSet):
    """Public library directory: ``/api/libraries/`` and detail by id or slug."""

    serializer_class = BookstoreProfileSerializer
    lookup_field = 'slug'
    filterset_fields = ['wilaya_id', 'commune_id', 'is_verified']
    search_fields = ['store_name', 'address', 'description', 'wilaya__name_fr']
    ordering_fields = ['store_name', 'created_at']

    def get_queryset(self):
        return _library_queryset()

    def get_object(self):
        value = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        library = queryset.filter(slug=value).first()
        if library is None and str(value).isdigit():
            library = queryset.filter(pk=int(value)).first()
        if library is None:
            raise Http404
        self.check_object_permissions(self.request, library)
        return library


class IndividualSellerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IndividualSellerProfile.objects.select_related('wilaya', 'commune').all()
    serializer_class = IndividualSellerProfileSerializer
    filterset_fields = ['wilaya_id', 'commune_id']
    search_fields = ['display_name', 'wilaya__name_fr']

    def get_queryset(self):
        return super().get_queryset().annotate(
            rating_average=Avg('reviews__rating'),
            reviews_count=Count('reviews', distinct=True),
        )


def _issue_token(user):
    token, _ = Token.objects.get_or_create(user=user)
    return token.key


def _demo_payload(token):
    """Only expose raw action tokens when the demo mode is explicitly on."""
    return token if getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False) else None


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def auth_login_view(request):
    """Login with email + password and return a DRF authentication token.

    ``role_emulation`` remains available only when ALLOW_ANONYMOUS_DEMO is on;
    it exists for the seeded demo dashboards and never accepts a password.
    """
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password')
    role_emulation = request.data.get('role_emulation')

    if not email and not password and role_emulation:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response(
                {'error': 'Identifiants requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        role_map = {
            'BUYER': User.Role.BUYER,
            'BOOKSTORE': User.Role.BOOKSTORE_SELLER,
            'INDIVIDUAL': User.Role.INDIVIDUAL_SELLER,
            'ADMIN': User.Role.ADMIN,
        }
        user = User.objects.filter(role=role_map.get(role_emulation, User.Role.BUYER)).first()
        if not user:
            return Response(
                {'error': 'Aucun compte de démonstration pour ce rôle.'},
                status=status.HTTP_404_NOT_FOUND,
            )
    else:
        if not email or not password:
            return Response(
                {'error': 'L\'adresse email et le mot de passe sont obligatoires.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response(
                {'error': 'Email ou mot de passe incorrect.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

    if user.is_suspended or not user.is_active:
        return Response(
            {'error': 'Ce compte a été suspendu par l\'administration.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])
    return Response({'token': _issue_token(user), 'user': UserSerializer(user).data})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def auth_register_view(request):
    """Register a reader, bookstore or individual seller and send verification."""
    data = request.data
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    name = (data.get('name') or '').strip()
    role = data.get('role', User.Role.BUYER)
    phone = data.get('phone', '')
    wilaya_id = data.get('wilaya_id') or 16
    address = data.get('address', '')

    allowed_roles = {User.Role.BUYER, User.Role.BOOKSTORE_SELLER, User.Role.INDIVIDUAL_SELLER}
    if role not in allowed_roles:
        return Response({'error': 'Rôle invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    if not email:
        return Response({'error': 'L\'adresse email est obligatoire'}, status=status.HTTP_400_BAD_REQUEST)
    if not password or len(password) < 8:
        return Response(
            {'error': 'Le mot de passe doit contenir au moins 8 caractères.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if User.objects.filter(email__iexact=email).exists():
        return Response(
            {'error': 'Un compte existe déjà avec cette adresse email'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    wilaya = Wilaya.objects.filter(id=wilaya_id).first() or Wilaya.objects.filter(id=16).first()
    if wilaya is None:
        return Response(
            {'error': 'La base géographique algérienne n\'est pas encore initialisée.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # ``username`` stays unique internally; the public identifier is the email.
    base_username = email.split('@')[0] or 'lecteur'
    username = base_username
    suffix = 1
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f'{base_username}{suffix}'

    with transaction.atomic():
        user = User(
            email=email,
            username=username,
            first_name=name[:150],
            role=role,
            phone=phone,
            address=address,
            wilaya=wilaya,
            email_verified=False,
        )
        user.set_password(password)
        user.save()

        if role == User.Role.BOOKSTORE_SELLER:
            store_name = (data.get('store_name') or f"Librairie {name or username}").strip()
            slug_base = slugify(store_name) or f'librairie-{user.id}'
            slug = slug_base
            index = 1
            while BookstoreProfile.objects.filter(slug=slug).exists():
                index += 1
                slug = f'{slug_base}-{index}'
            BookstoreProfile.objects.create(
                user=user,
                store_name=store_name,
                slug=slug,
                address=address or f"{wilaya.name_fr} Centre",
                wilaya=wilaya,
                phone=phone,
                is_verified=False,
                verification_status=BookstoreProfile.VerificationStatus.PENDING,
            )
        elif role == User.Role.INDIVIDUAL_SELLER:
            IndividualSellerProfile.objects.create(
                user=user,
                display_name=name or username,
                wilaya=wilaya,
                phone=phone,
            )

        action_token = AuthActionToken.issue(
            user, AuthActionToken.Purpose.EMAIL_VERIFICATION
        )
        transaction.on_commit(lambda: send_email_verification(user, action_token.token))

    payload = {
        'message': 'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.',
        'token': _issue_token(user),
        'user': UserSerializer(user).data,
    }
    verification_token = _demo_payload(action_token.token)
    if verification_token:
        payload['verification_token'] = verification_token
    return Response(payload, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auth_logout_view(request):
    """Revoke the current API token."""
    Token.objects.filter(user=request.user).delete()
    return Response({'message': 'Déconnecté.'})


@api_view(['GET', 'PUT'])
@permission_classes([AllowAny])
def auth_me_view(request):
    """Return the authenticated profile, or update it (PUT).

    The ``user_id`` query parameter is kept as a demo fallback; authenticated
    requests always take precedence over it.
    """
    user = request.user if request.user and request.user.is_authenticated else None
    if user is None:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response({'error': 'Authentification requise.'}, status=status.HTTP_401_UNAUTHORIZED)
        user_id = request.query_params.get('user_id')
        user = User.objects.filter(id=user_id).first() if user_id else User.objects.first()

    if not user:
        return Response({'error': 'Utilisateur introuvable'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PUT':
        data = request.data
        user.first_name = data.get('first_name', user.first_name)
        user.last_name = data.get('last_name', user.last_name)
        user.phone = data.get('phone', user.phone)
        user.address = data.get('address', user.address)
        if 'avatar_url' in data:
            user.avatar_url = data.get('avatar_url') or None
        if 'wilaya_id' in data:
            user.wilaya = Wilaya.objects.filter(id=data['wilaya_id']).first()
        if 'commune_id' in data:
            user.commune = Commune.objects.filter(id=data['commune_id']).first()
        user.save()

    return Response(UserSerializer(user).data)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def auth_verify_email_view(request):
    token_value = (request.data.get('token') or '').strip()
    if not token_value:
        return Response({'error': 'Jeton de vérification manquant.'}, status=400)

    token = AuthActionToken.objects.filter(
        token=token_value,
        purpose=AuthActionToken.Purpose.EMAIL_VERIFICATION,
    ).select_related('user').first()
    if token is None or not token.is_valid:
        return Response(
            {'error': 'Ce lien de vérification est invalide ou a expiré.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        token.consume()
        token.user.email_verified = True
        token.user.save(update_fields=['email_verified'])

    return Response({'message': 'Adresse email confirmée.', 'email_verified': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auth_resend_verification_view(request):
    user = request.user
    if user.email_verified:
        return Response({'message': 'Cette adresse est déjà vérifiée.', 'email_verified': True})

    token = AuthActionToken.issue(user, AuthActionToken.Purpose.EMAIL_VERIFICATION)
    send_email_verification(user, token.token)
    payload = {'message': 'Un nouvel email de vérification a été envoyé.'}
    verification_token = _demo_payload(token.token)
    if verification_token:
        payload['verification_token'] = verification_token
    return Response(payload)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def auth_password_reset_request_view(request):
    """Always answer 200 so the endpoint cannot be used to enumerate emails."""
    email = (request.data.get('email') or '').strip().lower()
    user = User.objects.filter(email__iexact=email).first()
    token_value = None
    if user is not None and user.is_active and not user.is_suspended:
        token = AuthActionToken.issue(
            user, AuthActionToken.Purpose.PASSWORD_RESET, ttl=timedelta(hours=2)
        )
        send_password_reset(user, token.token)
        token_value = _demo_payload(token.token)

    payload = {'message': 'Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé.'}
    if token_value:
        payload['reset_token'] = token_value
    return Response(payload)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def auth_password_reset_confirm_view(request):
    token_value = (request.data.get('token') or '').strip()
    new_password = request.data.get('new_password') or ''
    if len(new_password) < 8:
        return Response(
            {'error': 'Le mot de passe doit contenir au moins 8 caractères.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    token = AuthActionToken.objects.filter(
        token=token_value, purpose=AuthActionToken.Purpose.PASSWORD_RESET
    ).select_related('user').first()
    if token is None or not token.is_valid:
        return Response(
            {'error': 'Ce lien de réinitialisation est invalide ou a expiré.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        token.consume()
        token.user.set_password(new_password)
        token.user.save(update_fields=['password'])
        # Existing sessions must not survive a password change.
        Token.objects.filter(user=token.user).delete()

    send_password_changed(token.user)
    return Response({'message': 'Mot de passe mis à jour. Vous pouvez vous connecter.'})

# ----------------- LIBRARY PROFILE APIS -----------------

# Optional storefront fields may be cleared; address and phone are structural
# and must stay filled.
LIBRARY_OPTIONAL_TEXT_FIELDS = (
    'description', 'whatsapp', 'contact_email', 'logo_url', 'banner_url',
)


def _unique_store_slug(name):
    base = slugify(name)[:210] or 'librairie'
    slug = base
    index = 1
    while BookstoreProfile.objects.filter(slug=slug).exists():
        index += 1
        slug = f'{base}-{index}'[:220]
    return slug


def _apply_library_fields(store, data):
    """Apply the editable storefront fields and return ``{field: error}``."""
    errors = {}

    if 'store_name' in data:
        name = (data.get('store_name') or '').strip()
        if len(name) < 2:
            errors['store_name'] = 'Le nom de la librairie est obligatoire.'
        else:
            store.store_name = name

    for field in LIBRARY_OPTIONAL_TEXT_FIELDS:
        if field in data:
            value = (data.get(field) or '').strip()
            setattr(store, field, value or None)

    if 'address' in data:
        address = (data.get('address') or '').strip()
        if not address:
            errors['address'] = "L'adresse physique est obligatoire."
        else:
            store.address = address

    if 'phone' in data:
        phone = (data.get('phone') or '').strip()
        if not phone:
            errors['phone'] = 'Le téléphone de la librairie est obligatoire.'
        else:
            store.phone = phone

    if 'opening_hours' in data:
        store.opening_hours = (data.get('opening_hours') or '').strip()

    if 'wilaya_id' in data:
        wilaya = Wilaya.objects.filter(id=data.get('wilaya_id')).first()
        if wilaya is None:
            errors['wilaya_id'] = 'Wilaya invalide.'
        else:
            store.wilaya = wilaya

    if 'commune_id' in data:
        commune_id = data.get('commune_id')
        if commune_id in (None, ''):
            store.commune = None
        else:
            commune = Commune.objects.filter(id=commune_id).first()
            if commune is None:
                errors['commune_id'] = 'Commune invalide.'
            else:
                store.commune = commune

    for field in ('latitude', 'longitude'):
        if field in data:
            raw = data.get(field)
            try:
                setattr(store, field, float(raw) if raw not in (None, '') else None)
            except (TypeError, ValueError):
                errors[field] = 'Coordonnées invalides.'

    if 'verification_document_url' in data:
        store.verification_document_url = data.get('verification_document_url') or None
        store.verification_status = BookstoreProfile.VerificationStatus.PENDING

    return errors


@api_view(['GET', 'POST', 'PATCH', 'PUT'])
@permission_classes([IsAuthenticated])
def library_me_view(request):
    """Read, open or update the authenticated user's library profile.

    ``POST`` upgrades any account (reader, second-hand seller) into a library
    owner; ``PATCH``/``PUT`` edit the exact fields shown on the public
    ``/libraries`` pages.
    """
    store = BookstoreProfile.objects.filter(user=request.user).first()

    if request.method == 'GET':
        if store is None:
            return Response(
                {'error': 'Aucun profil librairie.', 'has_library': False},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(BookstoreProfileSerializer(store).data)

    if request.method == 'POST':
        if store is not None:
            return Response(
                {'error': 'Vous avez déjà un profil librairie.', 'library_id': store.id},
                status=status.HTTP_409_CONFLICT,
            )

        data = request.data
        errors = {}
        name = (data.get('store_name') or '').strip()
        if len(name) < 2:
            errors['store_name'] = 'Le nom de la librairie est obligatoire.'
        phone = (data.get('phone') or request.user.phone or '').strip()
        if not phone:
            errors['phone'] = 'Le téléphone de la librairie est obligatoire.'
        wilaya = request.user.wilaya
        if data.get('wilaya_id'):
            wilaya = Wilaya.objects.filter(id=data.get('wilaya_id')).first()
        if wilaya is None:
            errors['wilaya_id'] = 'Renseignez la wilaya de votre librairie.'
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        address = (data.get('address') or request.user.address or '').strip()
        address = address or f'{wilaya.name_fr} Centre'

        store = BookstoreProfile(
            user=request.user,
            store_name=name,
            slug=_unique_store_slug(name),
            address=address,
            wilaya=wilaya,
            phone=phone,
            is_verified=False,
            verification_status=BookstoreProfile.VerificationStatus.PENDING,
        )
        field_errors = _apply_library_fields(store, data)
        if field_errors:
            return Response(field_errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            store.save()
            if request.user.role != User.Role.ADMIN:
                request.user.role = User.Role.BOOKSTORE_SELLER
                request.user.save(update_fields=['role'])

        return Response(
            BookstoreProfileSerializer(store).data, status=status.HTTP_201_CREATED
        )

    # PATCH / PUT
    if store is None:
        return Response(
            {'error': 'Aucun profil librairie.', 'has_library': False},
            status=status.HTTP_404_NOT_FOUND,
        )

    errors = _apply_library_fields(store, request.data)
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    store.save()
    return Response(BookstoreProfileSerializer(store).data)


# ----------------- LIBRARY ORDERS -----------------

LIBRARY_ORDER_STATUS = {
    Order.Status.PENDING_CONFIRMATION: 'PENDING',
    Order.Status.CONFIRMED: 'CONFIRMED',
    Order.Status.PREPARING: 'CONFIRMED',
    Order.Status.SHIPPED: 'SHIPPED',
    Order.Status.READY_FOR_PICKUP: 'SHIPPED',
    Order.Status.DELIVERED: 'DELIVERED',
    Order.Status.CANCELLED: 'CANCELLED',
}

LIBRARY_TARGET_STATUS = {
    'PENDING': Order.Status.PENDING_CONFIRMATION,
    'CONFIRMED': Order.Status.CONFIRMED,
    'SHIPPED': Order.Status.SHIPPED,
    'DELIVERED': Order.Status.DELIVERED,
    'CANCELLED': Order.Status.CANCELLED,
}


def _library_status_options(suborder):
    current = suborder.status
    if current == Order.Status.PENDING_CONFIRMATION:
        return ['CONFIRMED', 'SHIPPED', 'CANCELLED']
    if current == Order.Status.CONFIRMED:
        return ['SHIPPED', 'CANCELLED']
    if current == Order.Status.PREPARING:
        return ['SHIPPED', 'CANCELLED']
    if current == Order.Status.SHIPPED:
        return ['DELIVERED']
    if current == Order.Status.READY_FOR_PICKUP:
        return ['DELIVERED', 'CANCELLED']
    return []


def _library_order_payload(suborder):
    order = suborder.order
    items = []
    for item in suborder.items.all():
        offer = item.offer
        items.append({
            'id': item.id,
            'offer_id': offer.id,
            'work_id': offer.work_id,
            'title': offer.display_title,
            'work_slug': offer.work.slug,
            'cover_image': offer.work.cover_image,
            'quantity': item.quantity,
            'unit_price': item.unit_price,
            'line_total': round(item.quantity * item.unit_price, 2),
        })
    return {
        'id': order.id,
        'suborder_id': suborder.id,
        'order_number': order.order_number,
        'status': LIBRARY_ORDER_STATUS.get(suborder.status, suborder.status),
        'internal_status': suborder.status,
        'status_display': suborder.get_status_display(),
        'allowed_statuses': _library_status_options(suborder),
        'buyer_name': order.recipient_name,
        'buyer_phone': order.recipient_phone,
        'wilaya_name': order.recipient_wilaya.name_fr,
        'address': order.recipient_address,
        'delivery_type': suborder.delivery_method,
        'delivery_type_display': suborder.get_delivery_method_display(),
        'subtotal': suborder.subtotal,
        'delivery_fee': suborder.delivery_fee,
        'total_amount': round(suborder.subtotal + suborder.delivery_fee, 2),
        'tracking_number': suborder.tracking_number,
        'seller_notes': suborder.seller_notes,
        'created_at': order.created_at,
        'items': items,
    }


def _current_library(request):
    return BookstoreProfile.objects.filter(user=request.user).first()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def library_orders_view(request):
    """Incoming orders (one row per suborder) for the authenticated library."""
    store = _current_library(request)
    if store is None:
        return Response(
            {'error': 'Aucun profil librairie.', 'has_library': False},
            status=status.HTTP_404_NOT_FOUND,
        )

    suborders = SubOrder.objects.filter(bookstore=store).select_related(
        'order', 'order__recipient_wilaya', 'bookstore'
    ).prefetch_related('items__offer__work').order_by('-order__created_at')
    return Response([_library_order_payload(suborder) for suborder in suborders])


def _advance_library_suborder(suborder, target, actor=None, note=None):
    from marketplace.checkout import CheckoutError, transition_suborder

    if target == suborder.status:
        return suborder

    if target == Order.Status.CANCELLED:
        return transition_suborder(suborder, target, actor=actor, note=note)

    if target == Order.Status.CONFIRMED:
        if suborder.status != Order.Status.PENDING_CONFIRMATION:
            raise CheckoutError('Cette commande est déjà confirmée.')
        return transition_suborder(suborder, target, actor=actor, note=note)

    if target == Order.Status.SHIPPED:
        if suborder.status == Order.Status.PENDING_CONFIRMATION:
            transition_suborder(suborder, Order.Status.CONFIRMED, actor=actor, note=note)
        if suborder.status == Order.Status.CONFIRMED:
            transition_suborder(suborder, Order.Status.PREPARING, actor=actor, note=note)
        if suborder.status == Order.Status.PREPARING:
            return transition_suborder(suborder, Order.Status.SHIPPED, actor=actor, note=note)
        if suborder.status in (Order.Status.SHIPPED, Order.Status.READY_FOR_PICKUP):
            return suborder
        raise CheckoutError('Cette commande ne peut pas être expédiée dans son état actuel.')

    if target == Order.Status.DELIVERED:
        if suborder.status == Order.Status.PENDING_CONFIRMATION:
            transition_suborder(suborder, Order.Status.CONFIRMED, actor=actor, note=note)
        if suborder.status == Order.Status.CONFIRMED:
            transition_suborder(suborder, Order.Status.PREPARING, actor=actor, note=note)
        if suborder.status == Order.Status.PREPARING:
            transition_suborder(suborder, Order.Status.SHIPPED, actor=actor, note=note)
        if suborder.status in (Order.Status.SHIPPED, Order.Status.READY_FOR_PICKUP):
            return transition_suborder(suborder, Order.Status.DELIVERED, actor=actor, note=note)
        if suborder.status == Order.Status.DELIVERED:
            return suborder
        raise CheckoutError('Cette commande ne peut pas être livrée dans son état actuel.')

    if target == Order.Status.PENDING_CONFIRMATION:
        if suborder.status == Order.Status.PENDING_CONFIRMATION:
            return suborder
        raise CheckoutError('Une commande ne peut pas revenir à l’état en attente.')

    raise CheckoutError('Transition de statut invalide.')


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def library_order_detail_view(request, order_id):
    """Update the library's suborder status for one incoming order."""
    from marketplace.checkout import CheckoutError

    store = _current_library(request)
    if store is None:
        return Response(
            {'error': 'Aucun profil librairie.', 'has_library': False},
            status=status.HTTP_404_NOT_FOUND,
        )

    suborder = SubOrder.objects.filter(
        bookstore=store, order_id=order_id
    ).select_related('order', 'order__recipient_wilaya').first()
    if suborder is None:
        return Response({'error': 'Commande introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    raw_status = str(request.data.get('status') or '').upper()
    target = LIBRARY_TARGET_STATUS.get(raw_status)
    if target is None:
        return Response(
            {'error': 'Statut invalide.', 'allowed_statuses': _library_status_options(suborder)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    tracking = request.data.get('tracking_number')
    notes = request.data.get('seller_notes')
    update_fields = []
    if tracking is not None:
        suborder.tracking_number = str(tracking).strip()
        suborder.order.tracking_number = suborder.tracking_number
        suborder.order.save(update_fields=['tracking_number', 'updated_at'])
        update_fields.append('tracking_number')
    if notes is not None:
        suborder.seller_notes = str(notes).strip()
        update_fields.append('seller_notes')
    if update_fields:
        suborder.save(update_fields=update_fields + ['updated_at'])

    try:
        _advance_library_suborder(
            suborder, target, actor=request.user, note=notes or None
        )
    except CheckoutError as exc:
        return Response(
            {'error': str(exc), 'issues': exc.issues},
            status=status.HTTP_409_CONFLICT,
        )

    suborder.refresh_from_db()
    return Response(_library_order_payload(suborder))


# ----------------- BOOKSTORE SELLER PORTAL APIS -----------------

@api_view(['GET', 'PUT'])
def bookstore_my_store_view(request):
    """View and update bookstore storefront details (GPS, opening hours, logo, verification docs)"""
    store_id = request.query_params.get('store_id')
    store = None
    if request.user and request.user.is_authenticated:
        store = BookstoreProfile.objects.filter(user=request.user).first()
    if store is None and store_id:
        store = BookstoreProfile.objects.filter(id=store_id).first()
    if store is None:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response({'error': 'Authentification requise.'}, status=401)
        store = BookstoreProfile.objects.first()

    if not store:
        return Response({'error': 'Librairie introuvable'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PUT':
        errors = _apply_library_fields(store, request.data)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        store.save()

    return Response(BookstoreProfileSerializer(store).data)

@api_view(['GET'])
def bookstore_stats_view(request):
    """Sales, listings and popular titles for one bookstore."""
    if request.user and request.user.is_authenticated:
        store = BookstoreProfile.objects.filter(user=request.user).first()
    else:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response({'error': 'Authentification requise.'}, status=401)
        store_id = request.query_params.get('store_id')
        store = BookstoreProfile.objects.filter(id=store_id).first() if store_id else BookstoreProfile.objects.first()

    if not store:
        return Response({'error': 'Librairie introuvable'}, status=404)

    offers = Offer.objects.filter(bookstore=store)
    active_count = offers.filter(status=Offer.Status.ACTIVE).count()
    low_stock_count = offers.filter(
        stock_quantity__lte=2, status=Offer.Status.ACTIVE
    ).count()

    order_items = OrderItem.objects.filter(seller_type='BOOKSTORE', seller_id=str(store.id))
    orders_count = order_items.values('order_id').distinct().count()
    total_revenue = sum(item.unit_price * item.quantity for item in order_items)
    delivered_revenue = sum(
        item.unit_price * item.quantity
        for item in order_items.filter(sub_status=Order.Status.DELIVERED)
    )

    top_books = []
    for row in order_items.values('offer__work__id', 'offer__work__title').annotate(
        units=Sum('quantity')
    ).order_by('-units')[:5]:
        top_books.append({'work_id': row['offer__work__id'], 'title': row['offer__work__title'], 'units': row['units']})

    from django.db.models import Avg

    rating = store.reviews.filter(is_hidden=False).aggregate(value=Avg('rating'))['value']
    pending_suborders = store.suborders.filter(
        status=Order.Status.PENDING_CONFIRMATION
    ).count()

    return Response({
        'store_name': store.store_name,
        'is_verified': store.is_verified,
        'verification_status': store.verification_status,
        'total_revenue_dzd': total_revenue,
        'delivered_revenue_dzd': delivered_revenue,
        'total_orders': orders_count,
        'active_listings': active_count,
        'low_stock_count': low_stock_count,
        'top_books': top_books,
        'rating_average': round(rating, 2) if rating is not None else None,
        'reviews_count': store.reviews.filter(is_hidden=False).count(),
        'pending_suborders': pending_suborders,
    })

@api_view(['GET'])
def bookstore_orders_view(request):
    """Return all orders containing items from this bookstore"""
    store = BookstoreProfile.objects.filter(user=request.user).first() if request.user.is_authenticated else None
    if store is None:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False) and not request.user.is_authenticated:
            return Response({'error': 'Authentification requise.'}, status=401)
        store_id = request.query_params.get('store_id')
        store = BookstoreProfile.objects.filter(id=store_id).first() if store_id else BookstoreProfile.objects.first()

    if not store:
        return Response([])

    order_ids = OrderItem.objects.filter(
        seller_type='BOOKSTORE',
        seller_id=str(store.id)
    ).values_list('order_id', flat=True).distinct()

    orders = Order.objects.filter(id__in=order_ids).select_related('buyer', 'recipient_wilaya').prefetch_related('items__offer__work')
    
    results = []
    for o in orders:
        items = [{
            'title': it.offer.work.title,
            'quantity': it.quantity,
            'unit_price': it.unit_price,
            'sub_status': it.sub_status
        } for it in o.items.filter(seller_id=str(store.id))]

        results.append({
            'id': o.id,
            'order_number': o.order_number,
            'buyer_name': o.recipient_name,
            'buyer_phone': o.recipient_phone,
            'wilaya_name': o.recipient_wilaya.name_fr,
            'address': o.recipient_address,
            'delivery_type': o.get_delivery_type_display(),
            'status': o.status,
            'status_display': o.get_status_display(),
            'total_amount': o.total_amount,
            'seller_notes': o.seller_notes,
            'tracking_number': o.tracking_number,
            'created_at': o.created_at,
            'items': items
        })

    return Response(results)

@api_view(['POST'])
def bookstore_order_action_view(request, order_id):
    """Bookstore confirms availability or advances its suborder status."""
    from marketplace.checkout import CheckoutError, transition_suborder

    order = Order.objects.filter(id=order_id).prefetch_related('suborders').first()
    if not order:
        return Response({'error': 'Commande introuvable'}, status=404)

    if request.user and request.user.is_authenticated:
        store = BookstoreProfile.objects.filter(user=request.user).first()
    else:
        if not getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
            return Response({'error': 'Authentification requise.'}, status=401)
        store_id = request.query_params.get('store_id') or request.data.get('store_id')
        store = BookstoreProfile.objects.filter(id=store_id).first() if store_id else BookstoreProfile.objects.first()

    suborders = order.suborders.filter(bookstore=store) if store else order.suborders.none()
    suborder = suborders.first()
    if suborder is None:
        return Response({'error': 'Aucune sous-commande pour cette librairie.'}, status=404)

    action = request.data.get('action')
    mapping = {
        'CONFIRM': Order.Status.CONFIRMED,
        'PREPARING': Order.Status.PREPARING,
        'SHIPPED': Order.Status.SHIPPED,
        'READY_FOR_PICKUP': Order.Status.READY_FOR_PICKUP,
        'DELIVERED': Order.Status.DELIVERED,
        'CANCEL': Order.Status.CANCELLED,
    }
    new_status = mapping.get(action)
    if new_status is None:
        return Response({'error': 'Action inconnue.'}, status=400)

    tracking = request.data.get('tracking_number')
    if tracking:
        suborder.tracking_number = tracking
        suborder.save(update_fields=['tracking_number', 'updated_at'])
        order.tracking_number = tracking
        order.save(update_fields=['tracking_number', 'updated_at'])

    notes = request.data.get('seller_notes')
    if notes:
        suborder.seller_notes = notes
        suborder.save(update_fields=['seller_notes', 'updated_at'])

    try:
        transition_suborder(suborder, new_status, actor=request.user if request.user.is_authenticated else None, note=notes)
    except CheckoutError as exc:
        return Response({'error': str(exc), 'issues': exc.issues}, status=409)

    order.refresh_from_db()
    return Response({
        'success': True,
        'order_number': order.order_number,
        'new_status': order.status,
        'new_status_display': order.get_status_display(),
        'suborder_status': suborder.status,
    })

# ----------------- ADMIN DASHBOARD APIS -----------------

@api_view(['GET'])
@permission_classes([IsAdminOrDemo])
def admin_analytics_view(request):
    """Platform-wide analytics for administrators"""
    total_gmv = Order.objects.aggregate(total=Sum('total_amount'))['total'] or 0
    total_orders = Order.objects.count()
    total_users = User.objects.count()
    buyers_count = User.objects.filter(role=User.Role.BUYER).count()
    bookstores_count = BookstoreProfile.objects.count()
    verified_bookstores_count = BookstoreProfile.objects.filter(is_verified=True).count()
    pending_bookstores_count = BookstoreProfile.objects.filter(verification_status='PENDING').count()
    individual_sellers_count = IndividualSellerProfile.objects.count()
    total_offers = Offer.objects.filter(status='ACTIVE').count()
    covered_wilayas = BookstoreProfile.objects.values('wilaya_id').distinct().count()

    return Response({
        'total_gmv_dzd': total_gmv,
        'total_orders': total_orders,
        'total_users': total_users,
        'buyers_count': buyers_count,
        'bookstores_count': bookstores_count,
        'verified_bookstores_count': verified_bookstores_count,
        'pending_bookstores_count': pending_bookstores_count,
        'individual_sellers_count': individual_sellers_count,
        'total_active_offers': total_offers,
        'covered_wilayas_count': covered_wilayas,
    })

@api_view(['GET', 'POST'])
@permission_classes([IsAdminOrDemo])
def admin_bookstores_verification_view(request, store_id=None):
    """Review and verify or reject physical bookstores"""
    if request.method == 'POST' and store_id:
        store = BookstoreProfile.objects.filter(id=store_id).first()
        if not store:
            return Response({'error': 'Librairie introuvable'}, status=404)
        
        action = request.data.get('action') # 'VERIFY' or 'REJECT'
        notes = request.data.get('notes', '')

        if action == 'VERIFY':
            store.is_verified = True
            store.verification_status = BookstoreProfile.VerificationStatus.VERIFIED
            store.verification_notes = notes or 'Documents vérifiés par l\'administrateur.'
        elif action == 'REJECT':
            store.is_verified = False
            store.verification_status = BookstoreProfile.VerificationStatus.REJECTED
            store.verification_notes = notes or 'Registre de commerce ou documents invalides.'

        store.save()
        return Response({'success': True, 'status': store.verification_status})

    # GET list
    bookstores = BookstoreProfile.objects.select_related('wilaya', 'commune').all()
    return Response(BookstoreProfileSerializer(bookstores, many=True).data)

@api_view(['GET', 'POST'])
@permission_classes([IsAdminOrDemo])
def admin_users_management_view(request, user_id=None):
    """View users and toggle suspension of fraudulent accounts"""
    if request.method == 'POST' and user_id:
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({'error': 'Utilisateur introuvable'}, status=404)
        
        user.is_suspended = not user.is_suspended
        user.save()
        return Response({'success': True, 'is_suspended': user.is_suspended})

    users = User.objects.select_related('wilaya').all().order_by('-date_joined')
    return Response(UserSerializer(users, many=True).data)
