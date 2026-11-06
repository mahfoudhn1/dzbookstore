"""Cart quoting, multi-seller checkout and explicit order transitions."""
from __future__ import annotations

import secrets

from django.db import transaction
from django.utils import timezone

from notifications.services import notify
from .models import Offer, Order, OrderEvent, OrderItem, SubOrder


class CheckoutError(Exception):
    """Raised when a cart cannot be turned into an order."""

    def __init__(self, message, issues=None):
        super().__init__(message)
        self.issues = issues or []


DELIVERY_ALIASES = {
    'HOME': Order.DeliveryType.HOME_DELIVERY,
    'HOME_DELIVERY': Order.DeliveryType.HOME_DELIVERY,
    'STOP_DESK': Order.DeliveryType.STOP_DESK,
    'PICKUP': Order.DeliveryType.STORE_PICKUP,
    'STORE_PICKUP': Order.DeliveryType.STORE_PICKUP,
}

DELIVERY_FEE_FIELDS = {
    Order.DeliveryType.HOME_DELIVERY: ('has_home_delivery', 'home_delivery_fee', 550.0),
    Order.DeliveryType.STOP_DESK: ('has_stop_desk_delivery', 'stop_desk_fee', 350.0),
    Order.DeliveryType.STORE_PICKUP: ('has_store_pickup', None, 0.0),
}


def normalize_delivery(value):
    return DELIVERY_ALIASES.get((value or '').upper())


def seller_key(offer):
    if offer.bookstore_id:
        return f'BOOKSTORE-{offer.bookstore_id}'
    return f'INDIVIDUAL-{offer.individual_seller_id}'


def seller_name(offer):
    if offer.bookstore_id:
        return offer.bookstore.store_name
    if offer.individual_seller_id:
        return offer.individual_seller.display_name
    return 'Vendeur'


def delivery_options_for_offer(offer):
    options = []
    for method, (flag, fee_field, default_fee) in DELIVERY_FEE_FIELDS.items():
        if getattr(offer, flag):
            fee = getattr(offer, fee_field) if fee_field else 0.0
            options.append({
                'method': method,
                'fee': float(fee if fee is not None else default_fee),
            })
    return options


def _parse_items(items):
    if not isinstance(items, list) or not items:
        raise CheckoutError('Le panier est vide.')
    parsed = []
    for raw in items:
        try:
            offer_id = int(raw.get('offer_id') or raw.get('offer'))
            quantity = int(raw.get('quantity', 1))
        except (TypeError, ValueError, AttributeError):
            raise CheckoutError('Chaque ligne doit contenir offer_id et quantity.')
        if quantity < 1:
            raise CheckoutError('Les quantités doivent être au moins égales à 1.')
        parsed.append((offer_id, quantity, raw))
    return parsed


def _choose_delivery(offer, requested, issues):
    provider = requested.get(seller_key(offer)) or requested.get(str(offer.id))
    if provider:
        method = normalize_delivery(provider)
        if method is None:
            issues.append({
                'offer_id': offer.id,
                'reason': f"Méthode de livraison inconnue : {provider}",
            })
            return None
    else:
        options = delivery_options_for_offer(offer)
        method = options[0]['method'] if options else None
    flag = DELIVERY_FEE_FIELDS.get(method, ('has_home_delivery', None, 0.0))[0]
    if method is None or not getattr(offer, flag, False):
        issues.append({
            'offer_id': offer.id,
            'reason': "Ce mode de livraison n'est pas proposé pour cette offre.",
        })
        return None
    return method


def _delivery_fee(offer, method):
    _, fee_field, default_fee = DELIVERY_FEE_FIELDS[method]
    if not fee_field:
        return 0.0
    fee = getattr(offer, fee_field)
    return float(fee if fee is not None else default_fee)


def build_quote(items, delivery_choices=None, lock=False):
    """Validate every line against the live catalog and group it per seller.

    Prices and stock are always read from the database, never trusted from the
    client.  ``expected_price`` is accepted only to detect a change since the
    buyer added the item to the cart.
    """
    delivery_choices = delivery_choices or {}
    parsed = _parse_items(items)
    offer_ids = [offer_id for offer_id, _, _ in parsed]
    queryset = Offer.objects.select_related(
        'work', 'edition', 'bookstore', 'individual_seller'
    ).filter(id__in=offer_ids)
    if lock:
        # Only the offer rows are locked: the select_related joins include
        # nullable seller relations, which PostgreSQL refuses to lock.
        queryset = queryset.select_for_update(of=('self',))
    offers = {offer.id: offer for offer in queryset}

    issues = []
    lines = []
    for offer_id, quantity, raw in parsed:
        offer = offers.get(offer_id)
        if offer is None:
            issues.append({'offer_id': offer_id, 'reason': 'Offre introuvable.'})
            continue
        if offer.status != Offer.Status.ACTIVE:
            issues.append({
                'offer_id': offer.id,
                'reason': "Cette offre n'est plus disponible.",
                'status': offer.status,
            })
            continue
        if quantity > offer.stock_quantity:
            issues.append({
                'offer_id': offer.id,
                'reason': 'Stock insuffisant.',
                'available_quantity': offer.stock_quantity,
                'requested_quantity': quantity,
            })
            continue
        expected_price = raw.get('expected_price')
        if expected_price is not None and abs(float(expected_price) - offer.price) > 0.01:
            issues.append({
                'offer_id': offer.id,
                'reason': 'Le prix a changé depuis votre ajout au panier.',
                'current_price': offer.price,
            })
            continue

        method = _choose_delivery(offer, delivery_choices, issues)
        if method is None:
            continue

        lines.append({
            'offer': offer,
            'quantity': quantity,
            'line_total': round(offer.price * quantity, 2),
            'delivery_method': method,
            'delivery_fee': _delivery_fee(offer, method),
        })

    if issues:
        return {'valid': False, 'issues': issues, 'sellers': [], 'items': []}, {}

    groups = {}
    for line in lines:
        offer = line['offer']
        key = seller_key(offer)
        group = groups.setdefault(key, {
            'key': key,
            'seller_type': offer.seller_type,
            'seller_id': offer.bookstore_id or offer.individual_seller_id,
            'seller_name': seller_name(offer),
            'bookstore_id': offer.bookstore_id,
            'individual_seller_id': offer.individual_seller_id,
            'items': [],
            'subtotal': 0.0,
            'delivery_method': line['delivery_method'],
            'delivery_fee': 0.0,
        })
        if group['delivery_method'] != line['delivery_method']:
            issues.append({
                'offer_id': offer.id,
                'reason': 'Toutes les lignes d’un même vendeur doivent partager le même mode de livraison.',
            })
        # A single delivery fee per seller shipment.
        group['delivery_fee'] = max(group['delivery_fee'], line['delivery_fee'])
        group['subtotal'] += line['line_total']
        group['items'].append({
            'offer_id': offer.id,
            'work_id': offer.work_id,
            'work_title': offer.work.title,
            'work_slug': offer.work.slug,
            'cover_image': offer.work.cover_image,
            'quantity': line['quantity'],
            'unit_price': offer.price,
            'line_total': line['line_total'],
            'condition': offer.condition,
        })

    if issues:
        return {'valid': False, 'issues': issues, 'sellers': [], 'items': []}, {}

    sellers = []
    for group in groups.values():
        group['subtotal'] = round(group['subtotal'], 2)
        group['total'] = round(group['subtotal'] + group['delivery_fee'], 2)
        sellers.append(group)

    subtotal = round(sum(group['subtotal'] for group in sellers), 2)
    delivery_total = round(sum(group['delivery_fee'] for group in sellers), 2)
    quote = {
        'valid': True,
        'issues': [],
        'sellers': sellers,
        'subtotal': subtotal,
        'delivery_total': delivery_total,
        'grand_total': round(subtotal + delivery_total, 2),
        'currency': 'DZD',
    }
    return quote, offers


def _order_number():
    return f"DZ-{timezone.now():%Y%m%d}-{secrets.token_hex(3).upper()}"


def _seller_user(group):
    if group.get('bookstore_id'):
        from accounts.models import BookstoreProfile

        store = BookstoreProfile.objects.filter(id=group['bookstore_id']).select_related('user').first()
        return store.user if store else None
    from accounts.models import IndividualSellerProfile

    seller = IndividualSellerProfile.objects.filter(
        id=group.get('individual_seller_id')
    ).select_related('user').first()
    return seller.user if seller else None


@transaction.atomic
def place_order(buyer, items, delivery_choices=None, *, payment_method=None,
                delivery_type=None, recipient_name='', recipient_phone='',
                recipient_wilaya=None, recipient_address='', notes=''):
    """Create one order with one suborder per seller and reserve stock."""
    quote, offers = build_quote(items, delivery_choices=delivery_choices, lock=True)
    if not quote['valid']:
        raise CheckoutError('Le panier contient des lignes invalides.', quote['issues'])

    humans = [group for group in quote['sellers'] if group['items']]
    if not humans:
        raise CheckoutError('Le panier est vide.')

    method = normalize_delivery(delivery_type) if delivery_type else humans[0]['delivery_method']
    order = Order.objects.create(
        order_number=_order_number(),
        buyer=buyer,
        total_amount=quote['grand_total'],
        delivery_fee=quote['delivery_total'],
        status=Order.Status.PENDING_CONFIRMATION,
        payment_method=payment_method or Order.PaymentMethod.CASH_ON_DELIVERY,
        payment_status=Order.PaymentStatus.PENDING,
        delivery_type=method,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        recipient_wilaya=recipient_wilaya,
        recipient_address=recipient_address,
        notes=notes or '',
    )

    for group in humans:
        suborder = SubOrder.objects.create(
            order=order,
            seller_type=group['seller_type'],
            bookstore_id=group['bookstore_id'],
            individual_seller_id=group['individual_seller_id'],
            status=Order.Status.PENDING_CONFIRMATION,
            subtotal=group['subtotal'],
            delivery_fee=group['delivery_fee'],
            delivery_method=group['delivery_method'],
        )
        OrderEvent.objects.create(
            order=order,
            suborder=suborder,
            status=suborder.status,
            label='Commande transmise au vendeur',
            created_by=buyer,
        )
        for line in group['items']:
            offer = offers[line['offer_id']]
            OrderItem.objects.create(
                order=order,
                suborder=suborder,
                offer=offer,
                quantity=line['quantity'],
                unit_price=offer.price,
                seller_type=group['seller_type'],
                seller_id=str(group['seller_id']),
                sub_status=suborder.status,
            )
            # Atomic decrement guarded by select_for_update above.
            offer.stock_quantity = max(0, offer.stock_quantity - line['quantity'])
            if offer.stock_quantity == 0:
                offer.status = Offer.Status.SOLD
            offer.units_sold += line['quantity']
            offer.save(
                update_fields=['stock_quantity', 'status', 'units_sold', 'updated_at']
            )

        seller_user = _seller_user(group)
        if seller_user is not None:
            notify(
                seller_user,
                'ORDER',
                'Nouvelle commande à confirmer',
                f"Commande {order.order_number} : {len(group['items'])} article(s) pour un total de "
                f"{suborder.subtotal:.0f} DA. Confirmez la disponibilité avant expédition.",
                data={'order_id': order.id, 'suborder_id': suborder.id},
            )

    OrderEvent.objects.create(
        order=order,
        status=order.status,
        label='Commande créée',
        note=notes or None,
        created_by=buyer,
    )
    notify(
        buyer,
        'ORDER',
        'Votre commande a été enregistrée',
        f"Commande {order.order_number} — en attente de confirmation par le vendeur.",
        data={'order_id': order.id},
    )
    return order, quote


# Allowed transitions.  An order is never considered complete just because it
# was created: each seller has to confirm, then ship/deliver explicitly.
ALLOWED_TRANSITIONS = {
    Order.Status.PENDING_CONFIRMATION: {Order.Status.CONFIRMED, Order.Status.CANCELLED},
    Order.Status.CONFIRMED: {Order.Status.PREPARING, Order.Status.CANCELLED},
    Order.Status.PREPARING: {
        Order.Status.SHIPPED, Order.Status.READY_FOR_PICKUP, Order.Status.CANCELLED
    },
    Order.Status.SHIPPED: {Order.Status.DELIVERED},
    Order.Status.READY_FOR_PICKUP: {Order.Status.DELIVERED, Order.Status.CANCELLED},
    Order.Status.DELIVERED: set(),
    Order.Status.CANCELLED: set(),
}

TRANSITION_LABELS = {
    Order.Status.CONFIRMED: 'Disponibilité confirmée par le vendeur',
    Order.Status.PREPARING: 'Commande en préparation',
    Order.Status.SHIPPED: 'Colis expédié',
    Order.Status.READY_FOR_PICKUP: 'Prête pour le retrait',
    Order.Status.DELIVERED: 'Commande livrée',
    Order.Status.CANCELLED: 'Commande annulée',
}


def _restore_stock(suborder):
    for item in suborder.items.select_related('offer'):
        offer = item.offer
        offer.stock_quantity += item.quantity
        offer.units_sold = max(0, offer.units_sold - item.quantity)
        if offer.status == Offer.Status.SOLD:
            offer.status = Offer.Status.ACTIVE
        offer.save(
            update_fields=['stock_quantity', 'units_sold', 'status', 'updated_at']
        )


def recompute_order_status(order):
    statuses = list(order.suborders.values_list('status', flat=True))
    if not statuses:
        return order.status
    if all(status == Order.Status.DELIVERED for status in statuses):
        new_status = Order.Status.DELIVERED
    elif all(status == Order.Status.CANCELLED for status in statuses):
        new_status = Order.Status.CANCELLED
    elif any(status == Order.Status.SHIPPED for status in statuses):
        new_status = Order.Status.SHIPPED
    elif any(status == Order.Status.READY_FOR_PICKUP for status in statuses):
        new_status = Order.Status.READY_FOR_PICKUP
    elif any(status == Order.Status.PREPARING for status in statuses):
        new_status = Order.Status.PREPARING
    elif any(status == Order.Status.CONFIRMED for status in statuses):
        new_status = Order.Status.CONFIRMED
    else:
        new_status = Order.Status.PENDING_CONFIRMATION

    if new_status != order.status:
        order.status = new_status
        order.save(update_fields=['status', 'updated_at'])
        OrderEvent.objects.create(
            order=order,
            status=new_status,
            label=TRANSITION_LABELS.get(new_status, new_status),
        )
    return new_status


@transaction.atomic
def transition_suborder(suborder, new_status, actor=None, note=None):
    """Apply one validated status transition to a seller's suborder."""
    current = suborder.status
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if new_status not in allowed:
        raise CheckoutError(
            f"Transition invalide : {current} → {new_status}.",
            [{'current_status': current, 'allowed': sorted(allowed)}],
        )

    previous = suborder.status
    suborder.status = new_status
    if new_status == Order.Status.CONFIRMED:
        suborder.availability_confirmed_at = timezone.now()
    elif new_status == Order.Status.SHIPPED:
        suborder.shipped_at = timezone.now()
    elif new_status == Order.Status.DELIVERED:
        suborder.delivered_at = timezone.now()
    elif new_status == Order.Status.CANCELLED:
        suborder.cancelled_at = timezone.now()
        _restore_stock(suborder)
    suborder.save()

    suborder.items.update(sub_status=new_status)
    OrderEvent.objects.create(
        order=suborder.order,
        suborder=suborder,
        status=new_status,
        label=TRANSITION_LABELS.get(new_status, new_status),
        note=note or None,
        created_by=actor if getattr(actor, 'pk', None) else None,
    )

    order = suborder.order
    recompute_order_status(order)

    buyer = order.buyer
    notify(
        buyer,
        'ORDER',
        f"Commande {order.order_number} : {TRANSITION_LABELS.get(new_status, new_status)}",
        f"{suborder.seller_name} — {TRANSITION_LABELS.get(new_status, new_status)}.",
        data={'order_id': order.id, 'suborder_id': suborder.id, 'status': new_status},
    )
    return suborder


@transaction.atomic
def cancel_order(order, reason='', actor=None):
    """Cancel every suborder that has not shipped yet and restore its stock."""
    cancellable = [Order.Status.PENDING_CONFIRMATION, Order.Status.CONFIRMED]
    cancelled = []
    for suborder in order.suborders.exclude(status__in=[
        Order.Status.SHIPPED, Order.Status.DELIVERED, Order.Status.READY_FOR_PICKUP,
        Order.Status.CANCELLED,
    ]):
        if suborder.status in cancellable:
            transition_suborder(suborder, Order.Status.CANCELLED, actor=actor, note=reason)
            cancelled.append(suborder)

    if not cancelled:
        raise CheckoutError('Aucune sous-commande ne peut encore être annulée.')

    order.cancellation_reason = reason or order.cancellation_reason
    order.save(update_fields=['cancellation_reason', 'updated_at'])
    return cancelled
