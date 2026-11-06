"""Watch offer price/availability changes for wishlist and saved-search alerts."""
from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from marketplace.models import Offer


@receiver(pre_save, sender=Offer)
def capture_previous_offer_state(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_offer_state = None
        return
    instance._previous_offer_state = (
        Offer.objects.filter(pk=instance.pk)
        .values('price', 'status', 'stock_quantity')
        .first()
    )


@receiver(post_save, sender=Offer)
def offer_saved(sender, instance, created, **kwargs):
    from .services import on_offer_created, on_offer_price_changed, on_offer_restocked

    previous = getattr(instance, '_previous_offer_state', None)

    def dispatch():
        # Refresh in case the transaction rolled back.
        try:
            current = Offer.objects.get(pk=instance.pk)
        except Offer.DoesNotExist:
            return
        if created:
            if current.status == Offer.Status.ACTIVE and current.is_in_stock:
                on_offer_created(current)
            return
        if previous is None:
            return
        became_available = (
            previous['stock_quantity'] <= 0
            and current.is_in_stock
            and current.status == Offer.Status.ACTIVE
        )
        if became_available:
            on_offer_restocked(current)
        if previous['price'] and current.price < previous['price']:
            on_offer_price_changed(current, previous['price'])

    transaction.on_commit(dispatch)
