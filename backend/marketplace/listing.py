"""Create and update seller listings (offers) for the authenticated user.

The seller type is never chosen by the client: a user who owns a library
profile publishes into that library, and every other account publishes a
second-hand copy with ``bookstore=None`` and a single unit in stock.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date

from accounts.models import IndividualSellerProfile
from catalog.images import mirror_cover_image
from catalog.models import Category, Edition, Work
from catalog.services import create_edition, create_work
from common.text import isbn_digits
from geo.models import Wilaya

from .models import Offer

_MISSING = object()

LANGUAGE_LABELS = {
    Offer.Language.ARABIC: 'Arabe',
    Offer.Language.FRENCH: 'Français',
    Offer.Language.ENGLISH: 'Anglais',
    Offer.Language.TAMAZIGHT: 'Tamazight',
    Offer.Language.OTHER: 'Autre',
}

LANGUAGE_ALIASES = {
    'ar': Offer.Language.ARABIC,
    'arabic': Offer.Language.ARABIC,
    'arabe': Offer.Language.ARABIC,
    'العربية': Offer.Language.ARABIC,
    'fr': Offer.Language.FRENCH,
    'french': Offer.Language.FRENCH,
    'français': Offer.Language.FRENCH,
    'francais': Offer.Language.FRENCH,
    'en': Offer.Language.ENGLISH,
    'english': Offer.Language.ENGLISH,
    'anglais': Offer.Language.ENGLISH,
    'tamazight': Offer.Language.TAMAZIGHT,
    'amazigh': Offer.Language.TAMAZIGHT,
    'berbère': Offer.Language.TAMAZIGHT,
    'berbere': Offer.Language.TAMAZIGHT,
    'other': Offer.Language.OTHER,
    'autre': Offer.Language.OTHER,
}


def resolve_language(value):
    """Normalise an API/manual language value to an ``Offer.Language`` code."""
    text = str(value or '').strip()
    if not text:
        return Offer.Language.FRENCH
    if text in Offer.Language.values:
        return text
    normalized = text.lower()
    if normalized in LANGUAGE_ALIASES:
        return LANGUAGE_ALIASES[normalized]
    if 'arab' in normalized or 'عربي' in normalized or 'العربية' in normalized:
        return Offer.Language.ARABIC
    if 'fran' in normalized:
        return Offer.Language.FRENCH
    if 'angl' in normalized or 'english' in normalized:
        return Offer.Language.ENGLISH
    if 'tamaz' in normalized or 'berb' in normalized or 'amazigh' in normalized:
        return Offer.Language.TAMAZIGHT
    return Offer.Language.OTHER


def edition_language_value(data):
    raw = (data.get('edition_language') or '').strip()
    if raw:
        return raw
    source = (data.get('language') or '').strip()
    if source and source not in Offer.Language.values:
        return source
    return LANGUAGE_LABELS[resolve_language(source)]


LANGUAGE_CODES = {
    Offer.Language.ARABIC: 'ar',
    Offer.Language.FRENCH: 'fr',
    Offer.Language.ENGLISH: 'en',
    Offer.Language.TAMAZIGHT: 'ber',
    Offer.Language.OTHER: 'und',
}


def _work_language_code(data):
    source = data.get('language_code') or data.get('language')
    return LANGUAGE_CODES.get(resolve_language(source), 'fr')


def _translator_names(data):
    if data.get('translators'):
        return [str(name).strip() for name in data['translators'] if str(name).strip()]
    translator = (data.get('translator') or '').strip()
    return [translator] if translator else []

CONDITION_VALUES = {choice for choice, _label in Offer.Condition.choices}
DELIVERY_FLAGS = (
    'has_store_pickup', 'has_home_delivery', 'has_stop_desk_delivery',
)
FEE_FIELDS = ('home_delivery_fee', 'stop_desk_fee')


class ListingError(Exception):
    """Invalid listing payload or seller state; rendered as HTTP 400."""

    def __init__(self, message, details=None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


def can_manage(user, offer):
    """Whether ``user`` may edit or delete this listing."""
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if user.is_staff or getattr(user, 'is_admin_user', False):
        return True
    return offer.owner_user_id == user.id


def resolve_seller(user):
    """Return ``(library, individual_seller)`` for the user publishing."""
    library = getattr(user, 'bookstore_profile', None)
    if library is not None:
        return library, None

    individual = getattr(user, 'individual_profile', None)
    if individual is None:
        # A reader selling a used book gets a second-hand profile on the fly;
        # the account keeps its current role so the dashboard routing is stable.
        if user.wilaya_id is None:
            raise ListingError(
                'Renseignez votre wilaya avant de publier un livre.',
                {'wilaya_id': 'Wilaya requise pour vendre un livre d’occasion.'},
            )
        individual = IndividualSellerProfile.objects.create(
            user=user,
            display_name=(user.get_full_name() or '').strip() or user.username,
            wilaya=user.wilaya,
            commune=user.commune,
            phone=(user.phone or '').strip(),
        )
    return None, individual


def _as_float(value):
    if value in (None, ''):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _price(data):
    price = _as_float(data.get('price'))
    if price is None or price <= 0:
        raise ListingError(
            'Le prix doit être supérieur à 0 DA.', {'price': 'Prix invalide.'}
        )
    return price


def _stock(data, library):
    if library is None:
        return 1  # one second-hand copy per listing
    raw = data.get('stock_quantity', data.get('quantity', 1))
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        raise ListingError(
            'La quantité en stock doit être un entier positif.',
            {'stock_quantity': 'Quantité invalide.'},
        )


def _condition(data, library):
    condition = (data.get('condition') or '').upper()
    if condition not in CONDITION_VALUES:
        return Offer.Condition.NEW if library else Offer.Condition.VERY_GOOD
    return condition


def normalize_regions(value):
    """Coerce a list of wilaya ids, rejecting unknown ones.

    An empty list means the listing ships to every wilaya.
    """
    if value in (None, ''):
        return []
    if isinstance(value, (int, str)):
        value = [value]
    if not isinstance(value, (list, tuple)):
        raise ListingError(
            'Les régions doivent être une liste de wilayas.',
            {'regions': 'Liste de wilayas attendue.'},
        )

    cleaned = []
    for raw in value:
        try:
            wilaya_id = int(raw)
        except (TypeError, ValueError):
            raise ListingError(
                'Chaque région doit être un identifiant de wilaya.',
                {'regions': f'Wilaya invalide : {raw}'},
            )
        if wilaya_id not in cleaned:
            cleaned.append(wilaya_id)

    known = set(
        Wilaya.objects.filter(id__in=cleaned).values_list('id', flat=True)
    )
    unknown = [wilaya_id for wilaya_id in cleaned if wilaya_id not in known]
    if unknown:
        raise ListingError(
            'Certaines wilayas de livraison sont inconnues.',
            {'regions': f'Wilayas inconnues : {unknown}'},
        )
    return cleaned


def resolve_category(data):
    """Resolve an optional listing category from id or slug.

    Returns ``_MISSING`` when the payload did not mention a category so that
    PATCH requests leave the current value untouched, and ``None`` when the
    client explicitly clears it.
    """
    if 'category_slug' in data:
        slug = (data.get('category_slug') or '').strip()
        if not slug:
            return None
        category = Category.objects.filter(slug=slug).first()
        if category is None:
            raise ListingError(
                'Catégorie inconnue.', {'category_slug': f'Catégorie inconnue : {slug}'}
            )
        return category

    if 'category_id' in data or 'category' in data:
        raw = data.get('category_id', data.get('category'))
        if raw in (None, ''):
            return None
        try:
            category_id = int(raw)
        except (TypeError, ValueError):
            raise ListingError(
                'Catégorie invalide.', {'category': 'Identifiant de catégorie invalide.'}
            )
        category = Category.objects.filter(id=category_id).first()
        if category is None:
            raise ListingError(
                'Catégorie inconnue.', {'category': f'Catégorie inconnue : {category_id}'}
            )
        return category

    return _MISSING


CATEGORY_LIST_KEYS = ('categories', 'category_ids')


def resolve_categories(data):
    """Resolve a multi-category payload into ``Category`` instances.

    ``categories`` / ``category_ids`` accept a list of ids.  When neither is
    present the legacy single ``category`` / ``category_id`` / ``category_slug``
    fields are used, so older clients keep working.
    """
    list_key = next((key for key in CATEGORY_LIST_KEYS if key in data), None)
    if list_key is None:
        return resolve_category(data)

    raw = data.get(list_key) or []
    if isinstance(raw, (int, str)):
        raw = [raw]
    if not isinstance(raw, (list, tuple)):
        raise ListingError(
            'Les catégories doivent être une liste.', {'categories': 'Liste attendue.'}
        )

    ids = []
    for value in raw:
        try:
            category_id = int(value)
        except (TypeError, ValueError):
            raise ListingError(
                'Catégorie invalide.', {'categories': f'Identifiant invalide : {value}'}
            )
        if category_id not in ids:
            ids.append(category_id)

    if not ids:
        return []

    found = {category.id: category for category in Category.objects.filter(id__in=ids)}
    unknown = [category_id for category_id in ids if category_id not in found]
    if unknown:
        raise ListingError(
            'Catégorie inconnue.', {'categories': f'Catégories inconnues : {unknown}'}
        )
    return [found[category_id] for category_id in ids]


def normalize_photos(value):
    if value in (None, ''):
        return []
    if isinstance(value, str):
        value = [part.strip() for part in value.split(',')]
    if not isinstance(value, (list, tuple)):
        raise ListingError(
            'Les photos doivent être une liste d’URLs.', {'photos': 'Liste attendue.'}
        )
    return [str(item).strip() for item in value if str(item).strip()][:10]


def _author_names(data):
    if data.get('authors'):
        return [str(name).strip() for name in data['authors'] if str(name).strip()]
    author = (data.get('author') or '').strip()
    return [author] if author else []


def _resolve_work(user, data, title, cover_image, description):
    work_id = data.get('work_id')
    if work_id:
        work = Work.objects.filter(id=work_id).first()
        if work is None:
            raise ListingError('Livre introuvable.', {'work_id': 'Œuvre inconnue.'})
        return work

    seller_name = getattr(user, 'bookstore_profile', None)
    seller_name = seller_name.store_name if seller_name else (
        user.get_full_name() or user.username
    )
    work, _created = create_work(
        title=title,
        synopsis=description or f'Ouvrage répertorié par {seller_name}.',
        cover_image=cover_image or None,
        original_language=_work_language_code(data),
        author_names=_author_names(data),
    )
    if cover_image and not work.cover_image:
        work.cover_image = cover_image
        work.save(update_fields=['cover_image'])
    return work


def _resolve_edition(data, work, cover_image):
    edition_id = data.get('edition_id')
    if edition_id:
        return Edition.objects.filter(id=edition_id).first()

    isbn = (data.get('isbn') or '').strip()
    isbn13 = (data.get('isbn13') or '').strip()
    isbn10 = (data.get('isbn10') or '').strip()
    if isbn and not (isbn13 or isbn10):
        digits = isbn_digits(isbn)
        if len(digits) == 13:
            isbn13 = digits
        elif len(digits) == 10:
            isbn10 = digits

    publisher = (data.get('publisher') or '').strip()
    year = data.get('publication_year')
    try:
        year = int(year) if year not in (None, '') else None
    except (TypeError, ValueError):
        year = None

    page_count = data.get('page_count')
    try:
        page_count = int(page_count) if page_count not in (None, '') else None
    except (TypeError, ValueError):
        page_count = None

    raw_date = str(data.get('publication_date') or '').strip()
    publication_date = parse_date(raw_date[:10]) if raw_date else None

    if not (isbn13 or isbn10 or publisher or year):
        return None

    edition, _created = create_edition(
        work=work,
        isbn13=isbn13 or None,
        isbn10=isbn10 or None,
        publisher_name=publisher or None,
        publication_year=year,
        publication_date=publication_date,
        edition_title=(data.get('edition_title') or '').strip() or None,
        format=(data.get('format') or 'Poche'),
        language=edition_language_value(data),
        page_count=page_count,
        cover_image=cover_image or None,
        translator_names=_translator_names(data),
    )
    return edition


@transaction.atomic
def create_listing(user, data):
    """Create a listing owned by ``user`` and return the saved ``Offer``."""
    library, individual = resolve_seller(user)

    title = (data.get('title') or '').strip()
    if not title:
        raise ListingError('Le titre est obligatoire.', {'title': 'Titre requis.'})

    price = _price(data)
    stock = _stock(data, library)
    condition = _condition(data, library)
    regions = normalize_regions(data.get('regions'))
    language = resolve_language(data.get('language'))
    categories = resolve_categories(data)
    if categories is _MISSING or categories is None:
        categories = []
    elif isinstance(categories, Category):
        categories = [categories]
    category = categories[0] if categories else None

    condition_description = (data.get('condition_description') or '').strip()
    description = (data.get('description') or '').strip() or condition_description or None

    raw_cover = (data.get('cover_image') or '').strip()
    photos = normalize_photos(data.get('photos'))
    cover_image = mirror_cover_image(raw_cover)
    if cover_image:
        # Drop the original hotlink now that the cover is stored locally.
        photos = [cover_image] + [
            item for item in photos if item not in (cover_image, raw_cover)
        ]
    elif photos:
        photos[0] = mirror_cover_image(photos[0])
        cover_image = photos[0]

    work = _resolve_work(user, data, title, cover_image, description)
    edition = _resolve_edition(data, work, cover_image)
    if categories:
        work.categories.add(*categories)

    stop_desk_fee = _as_float(data.get('stop_desk_fee'))
    home_delivery_fee = _as_float(data.get('home_delivery_fee'))
    days = data.get('estimated_delivery_days')

    offer = Offer.objects.create(
        work=work,
        edition=edition,
        seller=user,
        seller_type=(
            Offer.SellerType.BOOKSTORE if library else Offer.SellerType.INDIVIDUAL
        ),
        bookstore=library,
        individual_seller=individual,
        title=(data.get('listing_title') or '').strip() or None,
        description=description,
        price=price,
        original_price=_as_float(data.get('original_price')),
        language=language,
        stock_quantity=stock,
        condition=condition,
        condition_description=condition_description or None,
        photos=photos,
        regions=regions,
        category=category,
        has_store_pickup=bool(data.get('has_store_pickup', library is not None)),
        has_home_delivery=bool(data.get('has_home_delivery', True)),
        has_stop_desk_delivery=bool(data.get('has_stop_desk_delivery', True)),
        stop_desk_fee=350.0 if stop_desk_fee is None else stop_desk_fee,
        home_delivery_fee=550.0 if home_delivery_fee is None else home_delivery_fee,
        estimated_delivery_days=int(days) if str(days or '').isdigit() else 3,
        status=Offer.Status.ACTIVE,
        last_availability_confirmed_at=timezone.now(),
    )
    if categories:
        offer.categories.set(categories)
    return offer


@transaction.atomic
def update_listing(offer, data):
    """Apply an owner's edits (title, description, price, stock, regions…)."""
    if 'title' in data or 'listing_title' in data:
        raw = data.get('title', data.get('listing_title'))
        title = (raw or '').strip()
        if not title:
            raise ListingError(
                'Le titre ne peut pas être vide.', {'title': 'Titre requis.'}
            )
        offer.title = title

    if 'description' in data:
        offer.description = (data.get('description') or '').strip() or None

    if 'price' in data:
        offer.price = _price(data)

    if 'language' in data:
        offer.language = resolve_language(data.get('language'))

    if 'stock_quantity' in data or 'quantity' in data:
        raw = data.get('stock_quantity', data.get('quantity'))
        try:
            offer.stock_quantity = max(0, int(raw))
        except (TypeError, ValueError):
            raise ListingError(
                'La quantité en stock doit être un entier positif.',
                {'stock_quantity': 'Quantité invalide.'},
            )
    elif 'is_in_stock' in data:
        # The availability toggle is a shortcut for the stock, never an
        # independent flag: is_in_stock is always derived from stock_quantity.
        if data.get('is_in_stock'):
            if offer.stock_quantity == 0:
                raise ListingError(
                    'Indiquez une quantité en stock supérieure à 0.',
                    {'stock_quantity': 'Stock requis.'},
                )
        else:
            offer.stock_quantity = 0

    if 'condition' in data:
        condition = (data.get('condition') or '').upper()
        if condition not in CONDITION_VALUES:
            raise ListingError(
                'État du livre invalide.', {'condition': 'État inconnu.'}
            )
        offer.condition = condition

    if 'condition_description' in data:
        offer.condition_description = (
            data.get('condition_description') or ''
        ).strip() or None

    if 'regions' in data:
        offer.regions = normalize_regions(data.get('regions'))

    categories = resolve_categories(data)
    if categories is not _MISSING:
        if categories is None:
            categories = []
        elif isinstance(categories, Category):
            categories = [categories]
        offer.category = categories[0] if categories else None
        offer.categories.set(categories)
        if categories:
            offer.work.categories.add(*categories)

    if 'photos' in data:
        offer.photos = normalize_photos(data.get('photos'))

    for field in DELIVERY_FLAGS:
        if field in data:
            setattr(offer, field, bool(data.get(field)))

    for field in FEE_FIELDS:
        if field in data:
            value = _as_float(data.get(field))
            if value is not None:
                setattr(offer, field, value)

    if 'estimated_delivery_days' in data:
        raw = data.get('estimated_delivery_days')
        if str(raw or '').isdigit():
            offer.estimated_delivery_days = max(1, int(raw))

    if offer.stock_quantity > 0 and offer.status == Offer.Status.SOLD:
        # Restocking a sold listing brings it back to the storefront.
        offer.status = Offer.Status.ACTIVE
        offer.last_availability_confirmed_at = timezone.now()

    offer.save()
    return offer
