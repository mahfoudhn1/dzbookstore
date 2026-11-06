"""Notification creation plus the availability/price watchers."""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from common.text import normalize
from .models import Notification

logger = logging.getLogger(__name__)


def notify(user, type, title, message='', data=None, email=True):
    """Persist a notification and (optionally) send its email copy.

    Email is sent through Django's configured backend; the development console
    backend keeps the flow visible without an external provider.
    """
    if user is None:
        return None
    notification = Notification.objects.create(
        user=user,
        type=type,
        title=title,
        message=message or '',
        data=data or {},
    )
    if email and getattr(user, 'email', None) and getattr(settings, 'SEND_NOTIFICATION_EMAILS', True):
        try:
            sent = send_mail(
                f'{title} · BookstoreDZ',
                message or title,
                getattr(settings, 'DEFAULT_FROM_EMAIL', 'BookstoreDZ <noreply@bookstoredz.dz>'),
                [user.email],
                fail_silently=True,
            )
            if sent:
                notification.email_sent = True
                notification.save(update_fields=['email_sent'])
        except Exception:  # noqa: BLE001 - email must never block an order
            logger.exception('Notification email failed for %s', user.email)
    return notification


def notify_wishlist_users(work, title, message, data, notification_type=Notification.Type.LISTING):
    from marketplace.models import Wishlist

    user_ids = Wishlist.objects.filter(work=work).values_list('user_id', flat=True)
    from accounts.models import User

    for user in User.objects.filter(id__in=user_ids, is_active=True):
        notify(user, notification_type, title, message, data=data)


def notify_saved_search_matches(offer):
    """Match a new listing against saved searches (title/author/wilaya)."""
    from marketplace.models import SavedSearch
    from accounts.models import User

    work = offer.work
    haystack = normalize(' '.join([
        work.title,
        work.original_title or '',
        ' '.join(author.name for author in work.authors.all()),
    ]))
    offer_wilaya_id = offer.seller_wilaya.id if offer.seller_wilaya else None
    category_slugs = set(work.categories.values_list('slug', flat=True))
    seller = offer.bookstore or offer.individual_seller
    seller_user = getattr(seller, 'user', None)
    if seller_user is None:
        return

    matches = []
    for saved in SavedSearch.objects.filter(notify=True).exclude(user=seller_user).select_related('user'):
        params = saved.query_params or {}
        q = normalize(str(params.get('q') or params.get('search') or ''))
        if q and q not in haystack:
            continue
        try:
            wanted_wilaya = int(params.get('wilaya_id')) if params.get('wilaya_id') else None
        except (TypeError, ValueError):
            wanted_wilaya = None
        if wanted_wilaya and offer_wilaya_id and wanted_wilaya != offer_wilaya_id:
            continue
        category = params.get('category') or params.get('categories__slug')
        if category and category not in category_slugs:
            continue
        matches.append(saved)

    for saved in matches:
        notify(
            saved.user,
            Notification.Type.LISTING,
            'Une recherche sauvegardée a de nouveaux résultats',
            f'{work.title} est disponible chez {offer.seller_name}.',
            data={'offer_id': offer.id, 'work_slug': work.slug, 'saved_search_id': saved.id},
        )
        saved.last_notified_at = timezone.now()
        saved.save(update_fields=['last_notified_at'])


def on_offer_created(offer):
    notify_wishlist_users(
        offer.work,
        'Un livre de votre liste de souhaits est disponible',
        f"{offer.work.title} est proposé par {offer.seller_name} à {offer.price:.0f} DA.",
        data={'offer_id': offer.id, 'work_slug': offer.work.slug, 'price': offer.price},
        notification_type=Notification.Type.WISHLIST,
    )
    notify_saved_search_matches(offer)


def on_offer_restocked(offer):
    notify_wishlist_users(
        offer.work,
        'De nouveau en stock',
        f"{offer.work.title} est de nouveau disponible chez {offer.seller_name}.",
        data={'offer_id': offer.id, 'work_slug': offer.work.slug},
        notification_type=Notification.Type.WISHLIST,
    )


def on_offer_price_changed(offer, old_price):
    if old_price is None or offer.price >= old_price:
        return
    notify_wishlist_users(
        offer.work,
        'Baisse de prix sur un livre de votre liste',
        (
            f"{offer.work.title} passe de {old_price:.0f} DA à {offer.price:.0f} DA "
            f"chez {offer.seller_name}."
        ),
        data={
            'offer_id': offer.id, 'work_slug': offer.work.slug,
            'old_price': old_price, 'new_price': offer.price,
        },
        notification_type=Notification.Type.PRICE,
    )


def notify_reported_content(recipient, label, reporter, reason):
    return notify(
        recipient,
        Notification.Type.MODERATION,
        f'Signalement : {label}',
        f'Contenu signalé par {reporter.email}. Motif : {reason}',
        email=False,
    )
