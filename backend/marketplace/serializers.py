from rest_framework import serializers
from .models import (
    FavoriteBookstore, FavoriteSeller, Offer, Order, OrderEvent, OrderItem, Review,
    SavedSearch, SubOrder, Wishlist,
)
from accounts.serializers import BookstoreProfileSerializer, IndividualSellerProfileSerializer

class OfferSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(read_only=True)
    distance_km = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()
    delivery_options = serializers.SerializerMethodField()
    seller_wilaya_name = serializers.SerializerMethodField()
    seller_wilaya_name_ar = serializers.SerializerMethodField()
    seller_wilaya_name_en = serializers.SerializerMethodField()
    seller_wilaya_code = serializers.SerializerMethodField()
    seller_commune_name = serializers.SerializerMethodField()
    seller_commune_name_ar = serializers.SerializerMethodField()
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    seller_type_display = serializers.CharField(source='get_seller_type_display', read_only=True)
    work_title = serializers.SerializerMethodField()
    work_slug = serializers.CharField(source='work.slug', read_only=True)
    work_synopsis = serializers.CharField(source='work.synopsis', read_only=True)
    work_cover = serializers.CharField(source='work.cover_image', read_only=True)
    edition_format = serializers.CharField(source='edition.format', read_only=True, allow_null=True)
    edition_publisher = serializers.CharField(source='edition.publisher.name', read_only=True, allow_null=True)
    edition_year = serializers.IntegerField(source='edition.publication_year', read_only=True, allow_null=True)
    edition_isbn13 = serializers.CharField(source='edition.isbn13', read_only=True, allow_null=True)
    category_name = serializers.CharField(source='category.name_fr', read_only=True, allow_null=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True, allow_null=True)
    categories = serializers.SerializerMethodField()

    bookstore = BookstoreProfileSerializer(read_only=True)
    individual_seller = IndividualSellerProfileSerializer(read_only=True)

    class Meta:
        model = Offer
        fields = [
            'id', 'work_id', 'work_title', 'work_slug', 'work_cover', 'work_synopsis',
            'edition_id', 'edition_format', 'edition_publisher', 'edition_year', 'edition_isbn13',
            'seller', 'seller_type', 'seller_type_display', 'seller_name',
            'seller_wilaya_name', 'seller_wilaya_name_ar', 'seller_wilaya_name_en', 'seller_wilaya_code',
            'seller_commune_name', 'seller_commune_name_ar',
            'bookstore', 'individual_seller',
            'title', 'description', 'category', 'category_name', 'category_slug', 'categories',
            'price', 'original_price', 'language', 'language_display',
            'condition', 'condition_display',
            'condition_description', 'photos',
            'stock_quantity', 'is_in_stock', 'in_stock', 'regions',
            # Deprecated alias kept for clients that still read ``quantity``;
            # it mirrors stock_quantity and will be removed with the UI update.
            'quantity', 'status',
            'has_store_pickup', 'has_home_delivery', 'has_stop_desk_delivery',
            'home_delivery_fee', 'stop_desk_fee', 'estimated_delivery_days',
            'last_availability_confirmed_at', 'units_sold', 'views_count',
            'distance_km', 'is_available', 'delivery_options',
            'created_at'
        ]
        read_only_fields = ['seller', 'views_count', 'units_sold', 'status']

    quantity = serializers.IntegerField(source='stock_quantity', read_only=True)
    in_stock = serializers.BooleanField(read_only=True)

    def get_categories(self, obj):
        return [
            {
                'id': category.id,
                'name_fr': category.name_fr,
                'name_ar': category.name_ar,
                'name_en': category.name_en,
                'slug': category.slug,
                'icon': category.icon,
                'parent': category.parent_id,
            }
            for category in obj.categories.all()
        ]

    def get_work_title(self, obj):
        return obj.display_title

    def get_distance_km(self, obj):
        distance = getattr(obj, 'distance_km', None)
        return round(distance, 2) if distance is not None else None

    def get_is_available(self, obj):
        return obj.status == Offer.Status.ACTIVE and obj.is_in_stock

    def get_delivery_options(self, obj):
        from .checkout import delivery_options_for_offer

        return delivery_options_for_offer(obj)

    def get_seller_wilaya_name(self, obj):
        wilaya = obj.seller_wilaya
        return wilaya.name_fr if wilaya else None

    def get_seller_wilaya_name_ar(self, obj):
        wilaya = obj.seller_wilaya
        return wilaya.name_ar if wilaya else None

    def get_seller_wilaya_name_en(self, obj):
        wilaya = obj.seller_wilaya
        if not wilaya:
            return None
        return 'Algiers' if wilaya.code == '16' else wilaya.name_fr

    def get_seller_wilaya_code(self, obj):
        wilaya = obj.seller_wilaya
        return wilaya.code if wilaya else None

    def get_seller_commune_name(self, obj):
        if obj.bookstore and obj.bookstore.commune:
            return obj.bookstore.commune.name_fr
        if obj.individual_seller and obj.individual_seller.commune:
            return obj.individual_seller.commune.name_fr
        return None

    def get_seller_commune_name_ar(self, obj):
        if obj.bookstore and obj.bookstore.commune:
            return obj.bookstore.commune.name_ar
        if obj.individual_seller and obj.individual_seller.commune:
            return obj.individual_seller.commune.name_ar
        return None

class BookWriteSerializer(serializers.Serializer):
    """Validates a listing payload; persistence lives in marketplace.listing."""

    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    listing_title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    author = serializers.CharField(required=False, allow_blank=True)
    authors = serializers.ListField(
        child=serializers.CharField(allow_blank=True), required=False
    )
    isbn = serializers.CharField(required=False, allow_blank=True)
    isbn10 = serializers.CharField(required=False, allow_blank=True)
    isbn13 = serializers.CharField(required=False, allow_blank=True)
    publisher = serializers.CharField(required=False, allow_blank=True)
    publication_year = serializers.IntegerField(required=False, allow_null=True)
    publication_date = serializers.CharField(required=False, allow_blank=True)
    edition_title = serializers.CharField(required=False, allow_blank=True)
    page_count = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    language = serializers.CharField(required=False, allow_blank=True)
    edition_language = serializers.CharField(required=False, allow_blank=True)
    format = serializers.CharField(required=False, allow_blank=True)
    translator = serializers.CharField(required=False, allow_blank=True)
    translators = serializers.ListField(
        child=serializers.CharField(allow_blank=True), required=False
    )
    work_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    edition_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    price = serializers.FloatField(required=False, min_value=0.01)
    original_price = serializers.FloatField(required=False, allow_null=True)
    stock_quantity = serializers.IntegerField(required=False, min_value=0)
    quantity = serializers.IntegerField(required=False, min_value=0)
    is_in_stock = serializers.BooleanField(required=False)
    condition = serializers.ChoiceField(choices=Offer.Condition.choices, required=False)
    condition_description = serializers.CharField(required=False, allow_blank=True)
    category = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    category_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    category_slug = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    categories = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False
    )
    category_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False
    )
    regions = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False
    )
    photos = serializers.ListField(
        child=serializers.CharField(allow_blank=True), required=False
    )
    cover_image = serializers.CharField(required=False, allow_blank=True)

    has_store_pickup = serializers.BooleanField(required=False)
    has_home_delivery = serializers.BooleanField(required=False)
    has_stop_desk_delivery = serializers.BooleanField(required=False)
    home_delivery_fee = serializers.FloatField(required=False, allow_null=True, min_value=0)
    stop_desk_fee = serializers.FloatField(required=False, allow_null=True, min_value=0)
    estimated_delivery_days = serializers.IntegerField(
        required=False, min_value=1, max_value=30
    )

    def validate(self, attrs):
        if self.instance is None:
            if not (attrs.get('title') or '').strip() and not attrs.get('work_id'):
                raise serializers.ValidationError(
                    {'title': 'Le titre ou l’identifiant d’une œuvre est obligatoire.'}
                )
            if attrs.get('price') is None:
                raise serializers.ValidationError({'price': 'Le prix est obligatoire.'})
        return attrs


class OrderItemSerializer(serializers.ModelSerializer):
    offer_title = serializers.CharField(source='offer.work.title', read_only=True)
    offer_cover = serializers.CharField(source='offer.work.cover_image', read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            'id', 'offer', 'offer_title', 'offer_cover', 'quantity',
            'unit_price', 'seller_type', 'seller_id', 'sub_status', 'suborder'
        ]


class OrderEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderEvent
        fields = ['id', 'status', 'label', 'note', 'created_at']


class SubOrderSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_method_display = serializers.CharField(
        source='get_delivery_method_display', read_only=True
    )
    events = OrderEventSerializer(many=True, read_only=True)
    can_review = serializers.SerializerMethodField()

    class Meta:
        model = SubOrder
        fields = [
            'id', 'seller_type', 'seller_name', 'bookstore', 'individual_seller',
            'status', 'status_display', 'subtotal', 'delivery_fee',
            'delivery_method', 'delivery_method_display', 'carrier', 'tracking_number',
            'seller_notes', 'availability_confirmed_at', 'shipped_at', 'delivered_at',
            'cancelled_at', 'items', 'events', 'can_review', 'created_at', 'updated_at',
        ]

    def get_can_review(self, obj):
        if obj.status != Order.Status.DELIVERED:
            return False
        return not hasattr(obj, 'review')


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    suborders = SubOrderSerializer(many=True, read_only=True)
    events = OrderEventSerializer(many=True, read_only=True)
    recipient_wilaya_name = serializers.CharField(source='recipient_wilaya.name_fr', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    delivery_type_display = serializers.CharField(source='get_delivery_type_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'buyer', 'total_amount', 'delivery_fee',
            'status', 'status_display', 'payment_method', 'payment_method_display',
            'payment_status', 'receipt_url', 'delivery_type', 'delivery_type_display',
            'recipient_name', 'recipient_phone', 'recipient_wilaya', 'recipient_wilaya_name',
            'recipient_address', 'recipient_stop_desk', 'notes',
            'seller_notes', 'tracking_number', 'cancellation_reason',
            'items', 'suborders', 'events', 'created_at', 'updated_at'
        ]

class ReviewSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.first_name', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'buyer', 'buyer_name', 'seller_type', 'order', 'suborder',
            'bookstore', 'individual_seller', 'rating', 'comment',
            'is_hidden', 'reported_at', 'report_reason', 'created_at'
        ]
        read_only_fields = ['buyer', 'is_hidden', 'reported_at', 'report_reason', 'created_at']


class FavoriteBookstoreSerializer(serializers.ModelSerializer):
    bookstore_detail = BookstoreProfileSerializer(source='bookstore', read_only=True)

    class Meta:
        model = FavoriteBookstore
        fields = ['id', 'bookstore', 'bookstore_detail', 'created_at']


class FavoriteSellerSerializer(serializers.ModelSerializer):
    seller_detail = IndividualSellerProfileSerializer(source='individual_seller', read_only=True)

    class Meta:
        model = FavoriteSeller
        fields = ['id', 'individual_seller', 'seller_detail', 'created_at']


class SavedSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedSearch
        fields = ['id', 'label', 'query_params', 'notify', 'created_at', 'last_notified_at']
        read_only_fields = ['last_notified_at']


class WishlistSerializer(serializers.ModelSerializer):
    work_title = serializers.CharField(source='work.title', read_only=True)
    work_slug = serializers.CharField(source='work.slug', read_only=True)
    work_cover = serializers.CharField(source='work.cover_image', read_only=True)
    min_price = serializers.SerializerMethodField()

    class Meta:
        model = Wishlist
        fields = ['id', 'work', 'work_title', 'work_slug', 'work_cover', 'min_price', 'created_at']

    def get_min_price(self, obj):
        active = obj.work.offers.filter(status='ACTIVE')
        return min((o.price for o in active), default=None)
