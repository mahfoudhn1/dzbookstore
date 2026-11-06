from django.db import models
from django.conf import settings
from catalog.models import Category, Work, Edition
from accounts.models import BookstoreProfile, IndividualSellerProfile
from geo.models import Wilaya

class Offer(models.Model):
    """A seller's listing of one work (the "book" of the storefront).

    A listing belongs either to a library (``bookstore``) or to a second-hand
    seller (``individual_seller``).  ``seller`` always points at the owning
    user so ownership checks do not need to join the profile tables; it is
    filled automatically from the profile on save.
    """

    class SellerType(models.TextChoices):
        BOOKSTORE = 'BOOKSTORE', 'Librairie (Bookstore)'
        INDIVIDUAL = 'INDIVIDUAL', 'Particulier (Individual)'

    class Condition(models.TextChoices):
        NEW = 'NEW', 'Neuf (New)'
        LIKE_NEW = 'LIKE_NEW', 'Comme neuf (Like New)'
        VERY_GOOD = 'VERY_GOOD', 'Très bon état (Very Good)'
        GOOD = 'GOOD', 'Bon état (Good)'
        ACCEPTABLE = 'ACCEPTABLE', 'État convenable (Acceptable)'

    class Language(models.TextChoices):
        ARABIC = 'ARABIC', 'Arabe'
        FRENCH = 'FRENCH', 'Français'
        ENGLISH = 'ENGLISH', 'Anglais'
        TAMAZIGHT = 'TAMAZIGHT', 'Tamazight'
        OTHER = 'OTHER', 'Autre'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Actif'
        RESERVED = 'RESERVED', 'Réservé'
        SOLD = 'SOLD', 'Vendu'
        PAUSED = 'PAUSED', 'En pause'

    work = models.ForeignKey(Work, on_delete=models.CASCADE, related_name='offers')
    edition = models.ForeignKey(Edition, on_delete=models.SET_NULL, null=True, blank=True, related_name='offers')
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
        related_name='offers',
    )
    # Per-listing text overrides: a Work is shared by every seller of the same
    # title, so a library may rename or describe its own copy without editing
    # the shared catalog record.
    title = models.CharField(max_length=300, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    seller_type = models.CharField(max_length=20, choices=SellerType.choices, default=SellerType.BOOKSTORE)
    bookstore = models.ForeignKey(BookstoreProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='offers')
    individual_seller = models.ForeignKey(IndividualSellerProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='offers')
    
    price = models.FloatField(help_text="Prix en Dinars Algériens (DZD)")
    original_price = models.FloatField(blank=True, null=True)
    language = models.CharField(
        max_length=20, choices=Language.choices, default=Language.FRENCH, db_index=True
    )
    condition = models.CharField(max_length=20, choices=Condition.choices, default=Condition.NEW)
    condition_description = models.TextField(blank=True, null=True)
    photos = models.JSONField(default=list, blank=True, help_text="Liste d'URLs des photos réelles de l'exemplaire")
    stock_quantity = models.PositiveIntegerField(default=1)
    # Denormalised so the storefront can filter stock without arithmetic;
    # always derived from ``stock_quantity`` in save().
    is_in_stock = models.BooleanField(default=True)
    # Wilaya ids this listing can be delivered to.  Empty = every wilaya.
    regions = models.JSONField(default=list, blank=True)
    # Listing-level categories.  The shared Work keeps its own taxonomy; this
    # lets a seller classify their copy without changing every other listing.
    # ``category`` is kept as the primary category for older clients.
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='offers',
    )
    categories = models.ManyToManyField(
        Category, blank=True, related_name='categorized_offers',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    # Sellers explicitly re-confirm that the copy is still available; a stale
    # confirmation is a signal to the buyer, not an automatic delisting.
    last_availability_confirmed_at = models.DateTimeField(blank=True, null=True)
    views_count = models.PositiveIntegerField(default=0)
    units_sold = models.PositiveIntegerField(default=0)

    has_store_pickup = models.BooleanField(default=False)
    has_home_delivery = models.BooleanField(default=True)
    has_stop_desk_delivery = models.BooleanField(default=True)
    home_delivery_fee = models.FloatField(default=600.0, blank=True, null=True)
    stop_desk_fee = models.FloatField(default=350.0, blank=True, null=True)
    estimated_delivery_days = models.PositiveSmallIntegerField(default=3)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['price']
        indexes = [
            models.Index(fields=['status', 'price']),
            models.Index(fields=['condition', 'status']),
            models.Index(fields=['status', 'is_in_stock', 'price']),
            models.Index(fields=['category', 'status', 'is_in_stock']),
            models.Index(fields=['language', 'status', 'price']),
        ]

    def save(self, *args, **kwargs):
        self.is_in_stock = (self.stock_quantity or 0) > 0
        changed = {'is_in_stock'}
        if self.seller_id is None:
            owner_id = None
            if self.bookstore_id:
                owner_id = BookstoreProfile.objects.filter(
                    pk=self.bookstore_id
                ).values_list('user_id', flat=True).first()
            elif self.individual_seller_id:
                owner_id = IndividualSellerProfile.objects.filter(
                    pk=self.individual_seller_id
                ).values_list('user_id', flat=True).first()
            if owner_id:
                self.seller_id = owner_id
                changed.add('seller')
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            kwargs['update_fields'] = set(update_fields) | changed
        super().save(*args, **kwargs)

    def __str__(self):
        seller = self.bookstore.store_name if self.bookstore else (self.individual_seller.display_name if self.individual_seller else "Vendeur")
        return f"{self.work.title} - {self.price} DA par {seller} [{self.get_condition_display()}]"

    @property
    def display_title(self):
        """The listing's own title when set, otherwise the shared work title."""
        return (self.title or '').strip() or self.work.title

    @property
    def owner_user_id(self):
        """Id of the user allowed to manage this listing."""
        if self.seller_id:
            return self.seller_id
        if self.bookstore_id:
            return self.bookstore.user_id
        if self.individual_seller_id:
            return self.individual_seller.user_id
        return None

    @property
    def in_stock(self):
        return (self.stock_quantity or 0) > 0

    @property
    def seller_name(self):
        if self.bookstore:
            return self.bookstore.store_name
        if self.individual_seller:
            return self.individual_seller.display_name
        return "Vendeur inconnu"

    @property
    def seller_wilaya(self):
        if self.bookstore:
            return self.bookstore.wilaya
        if self.individual_seller:
            return self.individual_seller.wilaya
        return None

class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_CONFIRMATION = 'PENDING_CONFIRMATION', 'En attente de confirmation'
        CONFIRMED = 'CONFIRMED', 'Confirmée'
        PREPARING = 'PREPARING', 'En préparation'
        SHIPPED = 'SHIPPED', 'Expédiée'
        READY_FOR_PICKUP = 'READY_FOR_PICKUP', 'Prête au retrait en librairie'
        DELIVERED = 'DELIVERED', 'Livrée'
        CANCELLED = 'CANCELLED', 'Annulée'

    class PaymentMethod(models.TextChoices):
        CASH_ON_DELIVERY = 'CASH_ON_DELIVERY', 'Paiement à la livraison (Cash)'
        BARIDIMOB_TRANSFER = 'BARIDIMOB_TRANSFER', 'Virement BaridiMob / CCP'
        IN_STORE = 'IN_STORE', 'Paiement en librairie'
        DIRECT_ARRANGEMENT = 'DIRECT_ARRANGEMENT', 'Entente directe (occasion)'
        ONLINE_CARD = 'ONLINE_CARD', 'Paiement en ligne (à venir)'

    class PaymentStatus(models.TextChoices):
        PENDING = 'PENDING', 'En attente'
        RECEIPT_UPLOADED = 'RECEIPT_UPLOADED', 'Reçu BaridiMob téléversé'
        VERIFIED = 'VERIFIED', 'Vérifié'
        PAID = 'PAID', 'Payé'
        FAILED = 'FAILED', 'Échoué'

    class DeliveryType(models.TextChoices):
        HOME_DELIVERY = 'HOME_DELIVERY', 'Livraison à domicile'
        STOP_DESK = 'STOP_DESK', 'Point relais / Stop Desk (Yalidine/ZR)'
        STORE_PICKUP = 'STORE_PICKUP', 'Retrait en librairie'

    order_number = models.CharField(max_length=40, unique=True)
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    total_amount = models.FloatField()
    delivery_fee = models.FloatField(default=0.0)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING_CONFIRMATION)
    payment_method = models.CharField(max_length=30, choices=PaymentMethod.choices, default=PaymentMethod.CASH_ON_DELIVERY)
    payment_status = models.CharField(max_length=30, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    receipt_url = models.URLField(max_length=500, blank=True, null=True)
    delivery_type = models.CharField(max_length=30, choices=DeliveryType.choices, default=DeliveryType.HOME_DELIVERY)
    
    recipient_name = models.CharField(max_length=150)
    recipient_phone = models.CharField(max_length=30)
    recipient_wilaya = models.ForeignKey(Wilaya, on_delete=models.PROTECT, related_name='orders')
    recipient_address = models.CharField(max_length=300)
    recipient_stop_desk = models.CharField(max_length=200, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    seller_notes = models.TextField(blank=True, null=True)
    tracking_number = models.CharField(max_length=100, blank=True, null=True)
    cancellation_reason = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Commande {self.order_number} - {self.total_amount} DA"


class SubOrder(models.Model):
    """One seller's slice of a multi-seller order.

    Buyers place a single order; each seller confirms, ships and is reviewed
    independently.  The parent order status is derived from its suborders.
    """

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='suborders')
    seller_type = models.CharField(max_length=20, choices=Offer.SellerType.choices)
    bookstore = models.ForeignKey(
        BookstoreProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='suborders'
    )
    individual_seller = models.ForeignKey(
        IndividualSellerProfile, on_delete=models.PROTECT, null=True, blank=True,
        related_name='suborders',
    )
    status = models.CharField(
        max_length=30, choices=Order.Status.choices, default=Order.Status.PENDING_CONFIRMATION
    )
    subtotal = models.FloatField(default=0.0)
    delivery_fee = models.FloatField(default=0.0)
    delivery_method = models.CharField(
        max_length=30, choices=Order.DeliveryType.choices, default=Order.DeliveryType.HOME_DELIVERY
    )
    carrier = models.CharField(max_length=80, blank=True, null=True)
    tracking_number = models.CharField(max_length=100, blank=True, null=True)
    seller_notes = models.TextField(blank=True, null=True)
    availability_confirmed_at = models.DateTimeField(blank=True, null=True)
    shipped_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    cancelled_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']

    @property
    def seller_name(self):
        if self.bookstore:
            return self.bookstore.store_name
        if self.individual_seller:
            return self.individual_seller.display_name
        return 'Vendeur'

    @property
    def seller_id_str(self):
        return str(self.bookstore_id or self.individual_seller_id or '')

    def __str__(self):
        return f'{self.order.order_number} · {self.seller_name} ({self.status})'


class OrderEvent(models.Model):
    """Append-only status / shipment timeline used for tracking."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='events')
    suborder = models.ForeignKey(
        SubOrder, on_delete=models.CASCADE, null=True, blank=True, related_name='events'
    )
    status = models.CharField(max_length=30, blank=True, null=True)
    label = models.CharField(max_length=180)
    note = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='order_events',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.order.order_number}: {self.label}'


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    suborder = models.ForeignKey(
        SubOrder, on_delete=models.CASCADE, null=True, blank=True, related_name='items'
    )
    offer = models.ForeignKey(Offer, on_delete=models.PROTECT, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.FloatField()
    seller_type = models.CharField(max_length=20)
    seller_id = models.CharField(max_length=50)
    sub_status = models.CharField(max_length=30, default='PENDING_CONFIRMATION')

    def __str__(self):
        return f"{self.quantity}x {self.offer.work.title} ({self.unit_price} DA)"


class Review(models.Model):
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    seller_type = models.CharField(max_length=20)
    bookstore = models.ForeignKey(BookstoreProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    individual_seller = models.ForeignKey(IndividualSellerProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviews')
    suborder = models.OneToOneField(
        SubOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='review'
    )
    rating = models.IntegerField(default=5)
    comment = models.TextField(blank=True, null=True)
    is_hidden = models.BooleanField(default=False)
    reported_at = models.DateTimeField(blank=True, null=True)
    report_reason = models.TextField(blank=True, null=True)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reported_reviews',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Avis {self.rating}/5 par {self.buyer.get_full_name() or self.buyer.email}"


class FavoriteBookstore(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorite_bookstores')
    bookstore = models.ForeignKey(BookstoreProfile, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'bookstore')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} ♥ {self.bookstore.store_name}'


class FavoriteSeller(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorite_sellers')
    individual_seller = models.ForeignKey(IndividualSellerProfile, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'individual_seller')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} ♥ {self.individual_seller.display_name}'


class SavedSearch(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_searches')
    label = models.CharField(max_length=180)
    query_params = models.JSONField(default=dict, blank=True)
    notify = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_notified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email}: {self.label}'

class Wishlist(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wishlist_items')
    work = models.ForeignKey(Work, on_delete=models.CASCADE, related_name='wishlist_items')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'work')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.work.title}"
