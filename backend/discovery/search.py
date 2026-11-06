"""Offer search, filtering, typo-tolerant matching and price comparison."""
from __future__ import annotations

from django.db.models import Avg, Count, Max, Min, Q
from django.utils import timezone

from common.text import isbn_digits, is_typo_match, normalize, search_variants
from geo.distance import haversine_expression
from marketplace.listing import resolve_language
from marketplace.models import Offer
from metadata.models import SearchLog


SORT_ALIASES = {
    'price_asc': ('price',),
    'price': ('price',),
    'cheapest': ('price',),
    'price_desc': ('-price',),
    'newest': ('-created_at',),
    'recent': ('-created_at',),
    'popular': ('-units_sold', '-views_count', '-created_at'),
}

TRUTHY = {'1', 'true', 'yes', 'on'}
FALSY = {'0', 'false', 'no', 'off'}
ORDERING_FIELDS = {
    'price', '-price',
    'created_at', '-created_at',
    'units_sold', '-units_sold',
    'stock_quantity', '-stock_quantity',
}


def _bool(params, name):
    return (params.get(name) or '').lower() in TRUTHY


def _float(params, name):
    value = params.get(name)
    try:
        return float(value) if value not in (None, '') else None
    except (TypeError, ValueError):
        return None


def _list_param(params, name):
    """Return all values for ``name``, accepting repeated and CSV parameters."""
    if hasattr(params, 'getlist'):
        values = params.getlist(name)
    else:
        value = params.get(name)
        values = [value] if value not in (None, '') else []
    result = []
    for value in values:
        result.extend(part.strip() for part in str(value).split(',') if part.strip())
    return result


def _base_offers():
    return Offer.objects.select_related(
        'work', 'edition', 'edition__publisher', 'edition__language_ref',
        'bookstore', 'bookstore__wilaya', 'bookstore__commune',
        'individual_seller', 'individual_seller__wilaya', 'individual_seller__commune',
    ).prefetch_related('categories')


def _text_condition(query):
    variants = search_variants(query)
    digits = isbn_digits(query)
    condition = Q()
    for variant in variants:
        condition |= (
            Q(work__normalized_title__icontains=variant)
            | Q(work__title__icontains=query)
            | Q(work__original_title__icontains=query)
            | Q(work__authors__normalized_name__icontains=variant)
            | Q(work__authors__name__icontains=query)
            | Q(work__categories__name_fr__icontains=query)
            | Q(work__genres__name_fr__icontains=query)
            | Q(edition__publisher__name__icontains=query)
            | Q(edition__language__icontains=query)
        )
    if digits:
        condition |= (
            Q(edition__isbn13__icontains=digits)
            | Q(edition__isbn10__icontains=digits)
            | Q(work__editions__isbn13__icontains=digits)
        )
    return condition


def _typo_work_ids(query, limit=800):
    from catalog.models import Work

    works = Work.objects.filter(offers__status=Offer.Status.ACTIVE).distinct().prefetch_related(
        'authors'
    )[:limit]
    matched = []
    for work in works:
        haystack = ' '.join(
            [work.title, work.original_title or '']
            + [author.name for author in work.authors.all()]
            + [author.name_ar or '' for author in work.authors.all()]
        )
        if is_typo_match(query, haystack, threshold=0.74):
            matched.append(work.id)
    return matched


def apply_offer_filters(request, queryset=None, skip_text=False):
    """Apply the public search contract to an offer queryset.

    Returns ``(queryset, meta)`` where meta records whether the typo fallback
    was needed and which spellings were suggested.  ``skip_text`` is used when
    the typo fallback recomputes the filters from scratch.
    """
    params = request.query_params
    qs = queryset if queryset is not None else _base_offers()
    meta = {'typo_fallback': False, 'suggestions': [], 'text_query': ''}

    status = params.get('status')
    if status:
        qs = qs.filter(status=status.upper())
    elif not _bool(params, 'include_unavailable'):
        qs = qs.filter(status=Offer.Status.ACTIVE)

    stock_filter = params.get('is_in_stock')
    if stock_filter in (None, ''):
        stock_filter = params.get('in_stock')
    if stock_filter not in (None, ''):
        normalized_stock = str(stock_filter).strip().lower()
        if normalized_stock in TRUTHY:
            qs = qs.filter(is_in_stock=True)
        elif normalized_stock in FALSY:
            qs = qs.filter(is_in_stock=False)

    q = (params.get('q') or params.get('search') or '').strip()
    if q:
        meta['text_query'] = q
        if not skip_text:
            qs = qs.filter(_text_condition(q)).distinct()

    isbn = params.get('isbn')
    if isbn:
        digits = isbn_digits(isbn)
        if digits:
            qs = qs.filter(
                Q(edition__isbn13__icontains=digits)
                | Q(edition__isbn10__icontains=digits)
                | Q(work__editions__isbn13__icontains=digits)
            ).distinct()

    title = params.get('title')
    if title:
        qs = qs.filter(
            Q(work__normalized_title__icontains=normalize(title))
            | Q(work__title__icontains=title)
        ).distinct()
    author = params.get('author')
    if author:
        qs = qs.filter(
            Q(work__authors__normalized_name__icontains=normalize(author))
            | Q(work__authors__name__icontains=author)
        ).distinct()
    publisher = params.get('publisher')
    if publisher:
        qs = qs.filter(
            Q(edition__publisher__slug=publisher)
            | Q(edition__publisher__name__icontains=publisher)
            | Q(work__editions__publisher__name__icontains=publisher)
        ).distinct()

    category_ids = set()
    category_slugs = set()
    for key in ('category', 'category_id', 'categories__slug', 'category_slug'):
        for value in _list_param(params, key):
            if value.isdigit():
                category_ids.add(int(value))
            else:
                category_slugs.add(value)
    if category_ids or category_slugs:
        category_condition = Q()
        if category_ids:
            category_condition |= (
                Q(category_id__in=category_ids)
                | Q(categories__id__in=category_ids)
                | Q(work__categories__id__in=category_ids)
            )
        if category_slugs:
            category_condition |= (
                Q(category__slug__in=category_slugs)
                | Q(categories__slug__in=category_slugs)
                | Q(work__categories__slug__in=category_slugs)
            )
        qs = qs.filter(category_condition).distinct()
    genre = params.get('genre') or params.get('genres__slug')
    if genre:
        qs = qs.filter(work__genres__slug=genre).distinct()

    language = params.get('language')
    if language:
        qs = qs.filter(language=resolve_language(language))

    wilaya_id = params.get('wilaya_id')
    if wilaya_id:
        qs = qs.filter(
            Q(bookstore__wilaya_id=wilaya_id) | Q(individual_seller__wilaya_id=wilaya_id)
        )
    commune_id = params.get('commune_id')
    if commune_id:
        qs = qs.filter(
            Q(bookstore__commune_id=commune_id) | Q(individual_seller__commune_id=commune_id)
        )

    min_price = _float(params, 'min_price')
    if min_price is not None:
        qs = qs.filter(price__gte=min_price)
    max_price = _float(params, 'max_price')
    if max_price is not None:
        qs = qs.filter(price__lte=max_price)

    conditions = params.get('condition')
    if conditions:
        values = [value.strip().upper() for value in conditions.split(',') if value.strip()]
        if values:
            qs = qs.filter(condition__in=values)

    seller_type = params.get('seller_type')
    if seller_type:
        qs = qs.filter(seller_type=seller_type.upper())

    bookstore_id = params.get('bookstore_id') or params.get('library') or params.get('library_id')
    if bookstore_id:
        qs = qs.filter(bookstore_id=bookstore_id)

    # A listing with no delivery regions ships everywhere.
    region = params.get('region') or params.get('region_id')
    if region:
        try:
            region_id = int(region)
        except (TypeError, ValueError):
            region_id = None
        if region_id is not None:
            qs = qs.filter(Q(regions__contains=[region_id]) | Q(regions=[]))

    individual_seller_id = params.get('individual_seller_id')
    if individual_seller_id:
        qs = qs.filter(individual_seller_id=individual_seller_id)

    if _bool(params, 'pickup') or _bool(params, 'store_pickup'):
        qs = qs.filter(has_store_pickup=True)
    if _bool(params, 'home_delivery'):
        qs = qs.filter(has_home_delivery=True)
    if _bool(params, 'stop_desk'):
        qs = qs.filter(has_stop_desk_delivery=True)

    latitude = _float(params, 'lat') if params.get('lat') is not None else _float(params, 'latitude')
    longitude = _float(params, 'lng') if params.get('lng') is not None else _float(params, 'longitude')
    radius = _float(params, 'radius_km') or _float(params, 'radius')

    if latitude is not None and longitude is not None:
        from django.db.models import F, Value
        from django.db.models.functions import Coalesce
        from geo.distance import seller_coordinates

        individual_lat, individual_lng = seller_coordinates()
        lat_expr = Coalesce('bookstore__latitude', individual_lat)
        lng_expr = Coalesce('bookstore__longitude', individual_lng)
        qs = qs.annotate(distance_km=haversine_expression(lat_expr, lng_expr, latitude, longitude))
        if radius:
            qs = qs.filter(distance_km__isnull=False, distance_km__lte=radius)

    sort = params.get('sort') or params.get('ordering')
    normalized_sort = (sort or '').lower()
    ordering = SORT_ALIASES.get(normalized_sort)
    if sort in ('nearest', 'distance'):
        qs = qs.order_by('distance_km', 'price')
    elif normalized_sort in ORDERING_FIELDS:
        qs = qs.order_by(normalized_sort)
    elif ordering:
        qs = qs.order_by(*ordering)
    else:
        qs = qs.order_by('-created_at', 'price')

    return qs, meta


def improve_with_typos(request, qs, meta):
    """If strict matching found nothing, retry with typo-tolerant work ids."""
    q = meta.get('text_query')
    if not q or qs.exists():
        return qs, meta
    ids = _typo_work_ids(q)
    if not ids:
        return qs, meta
    meta['typo_fallback'] = True
    from catalog.models import Work

    meta['suggestions'] = list(
        Work.objects.filter(id__in=ids).values_list('title', flat=True)[:5]
    )
    # The strict text condition is guaranteed to match nothing at this point,
    # so rebuild the other filters and keep only the typo-matched works.
    base, _ = apply_offer_filters(request, skip_text=True)
    return base.filter(work_id__in=ids), meta


def log_search(request, results_count, meta, filters=None):
    user = request.user if getattr(request, 'user', None) is not None and request.user.is_authenticated else None
    SearchLog.objects.create(
        user=user,
        query=(meta.get('text_query') or '')[:300],
        normalized_query=normalize(meta.get('text_query') or '')[:300],
        result_count=results_count,
        had_typo_fallback=meta.get('typo_fallback', False),
        filters=filters or {},
    )


def facets_for(qs):
    """Cheap facet summary for the search sidebar."""
    # ORDER BY columns would otherwise leak into the GROUP BY of every facet.
    qs = qs.order_by()
    price = qs.aggregate(min_price=Min('price'), max_price=Max('price'), average=Avg('price'))
    seller_types = {
        row['seller_type']: row['count']
        for row in qs.values('seller_type').annotate(count=Count('id'))
    }
    conditions = {
        row['condition']: row['count']
        for row in qs.values('condition').annotate(count=Count('id'))
    }
    languages = {
        (row['edition__language'] or 'Inconnue'): row['count']
        for row in qs.values('edition__language').annotate(count=Count('id'))
    }
    wilayas = {}
    for row in qs.values('bookstore__wilaya__name_fr').annotate(count=Count('id')):
        key = row['bookstore__wilaya__name_fr']
        if key:
            wilayas[key] = wilayas.get(key, 0) + row['count']
    for row in qs.values('individual_seller__wilaya__name_fr').annotate(count=Count('id')):
        key = row['individual_seller__wilaya__name_fr']
        if key:
            wilayas[key] = wilayas.get(key, 0) + row['count']

    return {
        'seller_types': seller_types,
        'conditions': conditions,
        'languages': languages,
        'wilayas': dict(sorted(wilayas.items(), key=lambda item: item[1], reverse=True)[:15]),
        'price_range': {
            'min': price['min_price'],
            'max': price['max_price'],
            'average': round(price['average'], 2) if price['average'] is not None else None,
        },
    }
