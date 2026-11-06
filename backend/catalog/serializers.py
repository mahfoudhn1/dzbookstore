from rest_framework import serializers

from .images import mirror_cover_image
from .models import (
    Author, Category, ContributorRole, Edition, EditionContributor, Genre, Language,
    Publisher, Work, WorkContributor,
)
from marketplace.serializers import OfferSerializer


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ['id', 'name', 'name_ar', 'slug', 'nationality', 'biography', 'photo_url']


class PublisherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Publisher
        fields = ['id', 'name', 'slug', 'country', 'logo_url', 'website']


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name_fr', 'name_ar', 'name_en', 'slug', 'icon', 'parent']


class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ['id', 'name_fr', 'name_ar', 'slug']


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ['id', 'code', 'name_fr', 'name_ar', 'name_en']


class ContributorSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)

    class Meta:
        model = WorkContributor
        fields = ['id', 'author', 'role', 'ordering']


class EditionContributorSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)

    class Meta:
        model = EditionContributor
        fields = ['id', 'author', 'role']


class EditionSerializer(serializers.ModelSerializer):
    publisher = PublisherSerializer(read_only=True)
    language_ref = LanguageSerializer(read_only=True)
    contributions = EditionContributorSerializer(many=True, read_only=True)

    class Meta:
        model = Edition
        fields = [
            'id', 'isbn10', 'isbn13', 'publisher', 'publication_year', 'publication_date',
            'edition_title', 'format', 'language', 'language_ref', 'page_count',
            'cover_image', 'contributions',
        ]


class WorkListSerializer(serializers.ModelSerializer):
    authors = AuthorSerializer(many=True, read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    genres = GenreSerializer(many=True, read_only=True)
    min_price = serializers.SerializerMethodField()
    max_price = serializers.SerializerMethodField()
    offers_count = serializers.SerializerMethodField()
    bookstores_count = serializers.SerializerMethodField()

    class Meta:
        model = Work
        fields = [
            'id', 'title', 'original_title', 'slug', 'synopsis',
            'original_language', 'cover_image', 'featured',
            'authors', 'categories', 'genres',
            'min_price', 'max_price', 'offers_count', 'bookstores_count'
        ]

    def _active_offers(self, obj):
        prefetched = getattr(obj, 'active_offers', None)
        return prefetched if prefetched is not None else obj.offers.filter(status='ACTIVE')

    def get_min_price(self, obj):
        prices = [offer.price for offer in self._active_offers(obj)]
        return min(prices) if prices else None

    def get_max_price(self, obj):
        prices = [offer.price for offer in self._active_offers(obj)]
        return max(prices) if prices else None

    def get_offers_count(self, obj):
        return len(self._active_offers(obj))

    def get_bookstores_count(self, obj):
        return len({
            offer.bookstore_id for offer in self._active_offers(obj)
            if offer.bookstore_id is not None
        })


class WorkDetailSerializer(serializers.ModelSerializer):
    authors = AuthorSerializer(many=True, read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    genres = GenreSerializer(many=True, read_only=True)
    editions = EditionSerializer(many=True, read_only=True)
    contributions = ContributorSerializer(many=True, read_only=True)
    offers = serializers.SerializerMethodField()
    min_price = serializers.SerializerMethodField()
    max_price = serializers.SerializerMethodField()

    class Meta:
        model = Work
        fields = [
            'id', 'title', 'original_title', 'slug', 'synopsis',
            'original_language', 'original_language_ref', 'cover_image', 'featured',
            'authors', 'categories', 'genres', 'editions', 'contributions',
            'offers', 'min_price', 'max_price'
        ]

    def get_offers(self, obj):
        active_offers = obj.offers.filter(status='ACTIVE').select_related(
            'edition', 'edition__publisher', 'bookstore', 'bookstore__wilaya', 'bookstore__commune',
            'individual_seller', 'individual_seller__wilaya', 'individual_seller__commune'
        )
        return OfferSerializer(active_offers, many=True).data

    def get_min_price(self, obj):
        prices = [o.price for o in obj.offers.filter(status='ACTIVE')]
        return min(prices) if prices else None

    def get_max_price(self, obj):
        prices = [o.price for o in obj.offers.filter(status='ACTIVE')]
        return max(prices) if prices else None


class WorkWriteSerializer(serializers.Serializer):
    """Manual catalog entry for administrators and verified bookstores."""

    title = serializers.CharField(max_length=300)
    synopsis = serializers.CharField(required=False, allow_blank=True, default='')
    original_title = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    original_language = serializers.CharField(required=False, default='fr')
    cover_image = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    featured = serializers.BooleanField(required=False, default=False)
    author_names = serializers.ListField(
        child=serializers.CharField(max_length=200), required=False, default=list
    )
    author_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    category_slugs = serializers.ListField(
        child=serializers.CharField(max_length=170), required=False, default=list
    )
    genre_slugs = serializers.ListField(
        child=serializers.CharField(max_length=170), required=False, default=list
    )

    def validate_cover_image(self, value):
        return mirror_cover_image(value) if value else value

    def create(self, validated_data):
        from .services import create_work

        author_names = list(validated_data.pop('author_names', []))
        author_ids = validated_data.pop('author_ids', [])
        if author_ids:
            author_names += list(
                Author.objects.filter(id__in=author_ids).values_list('name', flat=True)
            )
        work, created = create_work(
            title=validated_data['title'],
            synopsis=validated_data.get('synopsis', ''),
            original_title=validated_data.get('original_title'),
            original_language=validated_data.get('original_language', 'fr'),
            cover_image=validated_data.get('cover_image'),
            featured=validated_data.get('featured', False),
            author_names=author_names,
            category_slugs=validated_data.get('category_slugs'),
            genre_slugs=validated_data.get('genre_slugs'),
        )
        self.created_new = created
        return work

    def update(self, instance, validated_data):
        author_names = list(validated_data.pop('author_names', []))
        author_ids = validated_data.pop('author_ids', [])
        if author_ids:
            author_names += list(
                Author.objects.filter(id__in=author_ids).values_list('name', flat=True)
            )

        for field in ('title', 'synopsis', 'original_title', 'cover_image', 'featured'):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        if validated_data.get('original_language'):
            instance.original_language = validated_data['original_language']
        instance.save()

        if author_names:
            from .services import find_or_create_author
            from .models import ContributorRole, WorkContributor

            instance.authors.clear()
            for index, name in enumerate(author_names):
                author = find_or_create_author(name)
                if author:
                    WorkContributor.objects.get_or_create(
                        work=instance, author=author, role=ContributorRole.AUTHOR,
                        defaults={'ordering': index},
                    )
        if 'category_slugs' in validated_data:
            instance.categories.set(
                Category.objects.filter(slug__in=validated_data['category_slugs'])
            )
        if 'genre_slugs' in validated_data:
            instance.genres.set(Genre.objects.filter(slug__in=validated_data['genre_slugs']))
        self.created_new = False
        return instance


class EditionWriteSerializer(serializers.ModelSerializer):
    translator_names = serializers.ListField(
        child=serializers.CharField(max_length=200), required=False, write_only=True, default=list
    )

    class Meta:
        model = Edition
        fields = [
            'work', 'isbn10', 'isbn13', 'publisher', 'publication_year', 'publication_date',
            'edition_title', 'format', 'language', 'language_ref', 'page_count',
            'cover_image', 'translator_names',
        ]
        extra_kwargs = {
            'publisher': {'required': False, 'allow_null': True},
            'language_ref': {'required': False, 'allow_null': True},
            'isbn13': {'required': False, 'allow_null': True},
            'isbn10': {'required': False, 'allow_null': True},
        }

    def validate_cover_image(self, value):
        return mirror_cover_image(value) if value else value

    def validate(self, attrs):
        isbn13 = attrs.get('isbn13')
        isbn10 = attrs.get('isbn10')
        if isbn13:
            digits = ''.join(ch for ch in isbn13 if ch.isdigit())
            if len(digits) != 13:
                raise serializers.ValidationError({'isbn13': 'Un ISBN-13 doit contenir 13 chiffres.'})
        if isbn10:
            digits = ''.join(ch for ch in isbn10.upper() if ch.isdigit() or ch == 'X')
            if len(digits) != 10:
                raise serializers.ValidationError({'isbn10': 'Un ISBN-10 doit contenir 10 caractères.'})
        return attrs

    def create(self, validated_data):
        from .services import create_edition

        translator_names = validated_data.pop('translator_names', [])
        publisher = validated_data.pop('publisher', None)
        language_ref = validated_data.pop('language_ref', None)
        edition, created = create_edition(
            work=validated_data['work'],
            isbn13=validated_data.get('isbn13'),
            isbn10=validated_data.get('isbn10'),
            publisher_name=(publisher.name if publisher else None),
            publication_year=validated_data.get('publication_year'),
            publication_date=validated_data.get('publication_date'),
            edition_title=validated_data.get('edition_title'),
            format=validated_data.get('format', 'Poche'),
            language=(language_ref.name_fr if language_ref else validated_data.get('language', 'Français')),
            page_count=validated_data.get('page_count'),
            cover_image=validated_data.get('cover_image'),
            translator_names=translator_names,
        )
        self.created_new = created
        return edition
