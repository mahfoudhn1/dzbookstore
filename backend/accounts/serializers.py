from rest_framework import serializers
from .models import User, BookstoreProfile, IndividualSellerProfile

class BookstoreProfileSerializer(serializers.ModelSerializer):
    wilaya_name_fr = serializers.CharField(source='wilaya.name_fr', read_only=True)
    wilaya_name_ar = serializers.CharField(source='wilaya.name_ar', read_only=True)
    wilaya_name_en = serializers.SerializerMethodField()
    wilaya_code = serializers.CharField(source='wilaya.code', read_only=True)
    commune_name_fr = serializers.CharField(source='commune.name_fr', read_only=True, allow_null=True)
    commune_name_ar = serializers.CharField(source='commune.name_ar', read_only=True, allow_null=True)
    offers_count = serializers.IntegerField(source='offers.count', read_only=True)
    in_stock_count = serializers.SerializerMethodField()
    rating_average = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = BookstoreProfile
        fields = [
            'id', 'store_name', 'slug', 'description', 'address',
            'wilaya_id', 'wilaya_name_fr', 'wilaya_name_ar', 'wilaya_name_en', 'wilaya_code',
            'commune_id', 'commune_name_fr', 'commune_name_ar',
            'latitude', 'longitude', 'phone', 'whatsapp', 'contact_email',
            'opening_hours', 'logo_url', 'banner_url',
            'is_verified', 'verification_status', 'verification_document_url',
            'verification_notes', 'offers_count', 'in_stock_count',
            'rating_average', 'reviews_count'
        ]

    def get_wilaya_name_en(self, obj):
        if not obj.wilaya:
            return None
        return 'Algiers' if obj.wilaya.code == '16' else obj.wilaya.name_fr

    def get_in_stock_count(self, obj):
        annotated = getattr(obj, 'in_stock_count', None)
        if isinstance(annotated, int):
            return annotated
        return obj.offers.filter(is_in_stock=True).count()

    def get_rating_average(self, obj):
        annotated = getattr(obj, 'rating_average', None)
        if annotated is not None:
            return round(annotated, 2)
        from django.db.models import Avg
        value = obj.reviews.aggregate(value=Avg('rating'))['value']
        return round(value, 2) if value is not None else None

    def get_reviews_count(self, obj):
        annotated = getattr(obj, 'reviews_count', None)
        if annotated is not None:
            return annotated
        return obj.reviews.count()

class IndividualSellerProfileSerializer(serializers.ModelSerializer):
    wilaya_name_fr = serializers.CharField(source='wilaya.name_fr', read_only=True)
    wilaya_name_ar = serializers.CharField(source='wilaya.name_ar', read_only=True)
    wilaya_name_en = serializers.SerializerMethodField()
    commune_name_fr = serializers.CharField(source='commune.name_fr', read_only=True, allow_null=True)
    commune_name_ar = serializers.CharField(source='commune.name_ar', read_only=True, allow_null=True)
    offers_count = serializers.IntegerField(source='offers.count', read_only=True)
    rating_average = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = IndividualSellerProfile
        fields = [
            'id', 'display_name', 'bio', 'wilaya_id', 'wilaya_name_fr', 'wilaya_name_ar', 'wilaya_name_en',
            'commune_id', 'commune_name_fr', 'commune_name_ar', 'phone', 'whatsapp',
            'trust_score', 'offers_count', 'rating_average', 'reviews_count',
            'show_exact_location',
        ]

    def get_wilaya_name_en(self, obj):
        if not obj.wilaya:
            return None
        return 'Algiers' if obj.wilaya.code == '16' else obj.wilaya.name_fr

    def get_rating_average(self, obj):
        annotated = getattr(obj, 'rating_average', None)
        if annotated is not None:
            return round(annotated, 2)
        from django.db.models import Avg
        value = obj.reviews.aggregate(value=Avg('rating'))['value']
        return round(value, 2) if value is not None else None

    def get_reviews_count(self, obj):
        annotated = getattr(obj, 'reviews_count', None)
        if annotated is not None:
            return annotated
        return obj.reviews.count()

class UserSerializer(serializers.ModelSerializer):
    wilaya_name_fr = serializers.CharField(source='wilaya.name_fr', read_only=True)
    commune_name_fr = serializers.CharField(source='commune.name_fr', read_only=True)
    bookstore_profile = BookstoreProfileSerializer(read_only=True)
    individual_profile = IndividualSellerProfileSerializer(read_only=True)
    has_library = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'role', 'phone', 'address', 'avatar_url',
            'wilaya_id', 'wilaya_name_fr', 'commune_id', 'commune_name_fr',
            'is_suspended', 'is_active', 'email_verified', 'account_status',
            'is_staff', 'is_superuser', 'date_joined',
            'has_library', 'bookstore_profile', 'individual_profile'
        ]
        read_only_fields = ['email', 'role', 'is_suspended', 'is_active', 'email_verified', 'account_status']
