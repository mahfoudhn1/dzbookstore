import csv
import io

from django.conf import settings
from django.db.models import Count, Prefetch
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from accounts.models import BookstoreProfile
from accounts.permissions import IsCatalogEditorOrDemo
from marketplace.models import Offer
from .models import Author, Category, Edition, Genre, Language, Publisher, Work
from .serializers import (
    AuthorSerializer, CategorySerializer, EditionSerializer, EditionWriteSerializer,
    GenreSerializer, LanguageSerializer, PublisherSerializer, WorkDetailSerializer,
    WorkListSerializer, WorkWriteSerializer,
)
from .services import lookup_isbn_metadata


class AuthorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Author.objects.all()
    serializer_class = AuthorSerializer
    lookup_field = 'slug'
    search_fields = ['name', 'name_ar', 'normalized_name']


class PublisherViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Publisher.objects.all()
    serializer_class = PublisherSerializer
    lookup_field = 'slug'
    search_fields = ['name']


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    lookup_field = 'slug'
    pagination_class = None


class GenreViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Genre.objects.all()
    serializer_class = GenreSerializer
    lookup_field = 'slug'
    pagination_class = None


class LanguageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Language.objects.all()
    serializer_class = LanguageSerializer
    lookup_field = 'code'
    lookup_value_regex = '[A-Za-z0-9-]+'
    pagination_class = None


class WorkViewSet(viewsets.ModelViewSet):
    lookup_field = 'slug'
    search_fields = [
        'title', 'original_title', 'normalized_title', 'synopsis',
        'authors__name', 'authors__name_ar', 'editions__isbn13', 'editions__isbn10',
    ]
    filterset_fields = {
        'featured': ['exact'],
        'original_language': ['exact'],
        'categories__slug': ['exact'],
        'genres__slug': ['exact'],
    }
    ordering_fields = ['title', 'created_at']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsCatalogEditorOrDemo()]
        return super().get_permissions()

    def get_queryset(self):
        active_offers = Offer.objects.filter(status=Offer.Status.ACTIVE).select_related(
            'edition', 'bookstore', 'individual_seller'
        )
        qs = Work.objects.prefetch_related(
            'authors', 'categories', 'genres', 'editions',
            Prefetch('offers', queryset=active_offers, to_attr='active_offers'),
        )
        category_param = self.request.query_params.get('category')
        if category_param:
            slugs = [slug.strip() for slug in category_param.split(',') if slug.strip()]
            if slugs:
                qs = qs.filter(categories__slug__in=slugs).distinct()
        if self.action in ('list', 'retrieve'):
            qs = qs.annotate(
                popular_offer_count=Count('offers', distinct=True),
            )
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return WorkWriteSerializer
        if self.action == 'retrieve':
            return WorkDetailSerializer
        return WorkListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        work = serializer.save()
        return Response(
            {
                'created': getattr(serializer, 'created_new', False),
                'work': WorkDetailSerializer(work, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED if getattr(serializer, 'created_new', False) else status.HTTP_200_OK,
        )


class EditionViewSet(viewsets.ModelViewSet):
    queryset = Edition.objects.select_related('work', 'publisher', 'language_ref').prefetch_related('contributions__author')
    serializer_class = EditionSerializer
    filterset_fields = ['work_id', 'publisher_id', 'language', 'format', 'publication_year']
    search_fields = ['work__title', 'isbn13', 'isbn10', 'publisher__name']
    ordering_fields = ['publication_year', 'created_at']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsCatalogEditorOrDemo()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return EditionWriteSerializer
        return EditionSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        edition = serializer.save()
        return Response(
            {
                'created': getattr(serializer, 'created_new', False),
                'edition': EditionSerializer(edition).data,
            },
            status=status.HTTP_201_CREATED if getattr(serializer, 'created_new', False) else status.HTTP_200_OK,
        )


@api_view(['GET'])
def isbn_lookup_view(request):
    """Look up an ISBN locally first, then through the metadata providers."""
    isbn = request.query_params.get('isbn')
    if not isbn:
        return Response({'error': 'Le paramètre isbn est requis'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(lookup_isbn_metadata(isbn))


@api_view(['POST'])
def import_catalog_csv_view(request):
    """
    Bulk import catalog from CSV for physical bookstores.
    Expected CSV columns: isbn, title, author, price, quantity, condition
    """
    bookstore_id = request.data.get('bookstore_id')
    file_obj = request.FILES.get('file')

    if not file_obj:
        return Response({'error': 'Aucun fichier CSV fourni'}, status=status.HTTP_400_BAD_REQUEST)

    bookstore = None
    if request.user and request.user.is_authenticated:
        bookstore = getattr(request.user, 'bookstore_profile', None)
        requested = BookstoreProfile.objects.filter(id=bookstore_id).first() if bookstore_id else None
        if requested is not None and requested.user_id != request.user.id:
            return Response(
                {'error': 'Cette librairie ne vous appartient pas.'},
                status=status.HTTP_403_FORBIDDEN,
            )
    if not bookstore and bookstore_id:
        bookstore = BookstoreProfile.objects.filter(id=bookstore_id).first()
    if not bookstore and getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False):
        bookstore = BookstoreProfile.objects.first()

    if bookstore is None:
        return Response({'error': 'Aucune librairie associée à cet import.'}, status=404)

    decoded_file = file_obj.read().decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded_file))

    imported_count = 0
    errors = []

    for idx, row in enumerate(reader):
        try:
            title = (row.get('title') or '').strip()
            isbn = ''.join(ch for ch in (row.get('isbn') or '') if ch.isdigit())
            price = float(row.get('price') or 0)
            quantity = int(row.get('quantity') or 1)
            author_name = (row.get('author') or '').strip()

            if not title:
                continue

            # Reuse the dedupe-aware catalog helpers so CSV rows created by
            # different bookstores cannot fork a second work/edition record.
            from .services import create_edition, create_work

            work, _ = create_work(
                title=title,
                synopsis=f'Ouvrage répertorié par la librairie {bookstore.store_name}.',
                author_names=[author_name] if author_name else [],
            )

            edition = None
            if isbn:
                edition, _ = create_edition(
                    work=work,
                    isbn13=isbn,
                    format='Broché',
                    language='Français',
                )

            Offer.objects.update_or_create(
                work=work,
                bookstore=bookstore,
                seller_type=Offer.SellerType.BOOKSTORE,
                defaults={
                    'edition': edition,
                    'seller': bookstore.user_id,
                    'price': price,
                    'stock_quantity': quantity,
                    'regions': [],
                    'condition': Offer.Condition.NEW,
                    'has_store_pickup': True,
                    'has_home_delivery': True,
                    'has_stop_desk_delivery': True,
                    'last_availability_confirmed_at': timezone.now(),
                },
            )
            imported_count += 1
        except Exception as exc:  # noqa: BLE001 - one bad CSV row must not abort the import
            errors.append(f'Ligne {idx + 1}: {exc}')

    return Response({
        'success': True,
        'bookstore': bookstore.store_name,
        'imported_count': imported_count,
        'errors': errors,
    })
