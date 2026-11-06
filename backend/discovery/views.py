from rest_framework.decorators import api_view
from rest_framework.response import Response

from catalog.models import Work
from catalog.serializers import WorkListSerializer
from marketplace.serializers import OfferSerializer
from .search import apply_offer_filters, facets_for, improve_with_typos, log_search


def _pagination(request, default_size=24, max_size=60):
    try:
        page = max(1, int(request.query_params.get('page', 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = min(max(1, int(request.query_params.get('page_size', default_size))), max_size)
    except (TypeError, ValueError):
        page_size = default_size
    return page, page_size


@api_view(['GET'])
def search_offers_view(request):
    """Offer-level results with filters, sorting, distance and facets."""
    qs, meta = apply_offer_filters(request)
    qs, meta = improve_with_typos(request, qs, meta)
    total = qs.count()
    facets = facets_for(qs)
    log_search(request, total, meta)

    page, page_size = _pagination(request)
    offset = (page - 1) * page_size
    results = OfferSerializer(qs[offset: offset + page_size], many=True).data
    return Response({
        'count': total,
        'page': page,
        'page_size': page_size,
        'results': results,
        'facets': facets,
        'meta': meta,
    })


@api_view(['GET'])
def search_works_view(request):
    """Work-level results: every matching offer is grouped for comparison."""
    qs, meta = apply_offer_filters(request)
    qs, meta = improve_with_typos(request, qs, meta)
    facets = facets_for(qs)

    ordered_work_ids = []
    seen = set()
    for work_id in qs.values_list('work_id', flat=True):
        if work_id not in seen:
            seen.add(work_id)
            ordered_work_ids.append(work_id)

    total = len(ordered_work_ids)
    page, page_size = _pagination(request)
    offset = (page - 1) * page_size
    page_ids = ordered_work_ids[offset: offset + page_size]

    works = Work.objects.filter(id__in=page_ids).prefetch_related('authors', 'categories', 'genres')
    by_id = {work.id: work for work in works}
    results = []
    for work_id in page_ids:
        work = by_id.get(work_id)
        if work is None:
            continue
        offers = qs.filter(work_id=work_id)[:30]
        results.append({
            'work': WorkListSerializer(work).data,
            'offers': OfferSerializer(offers, many=True).data,
            'offers_count': len(offers),
        })

    log_search(request, total, meta)
    return Response({
        'count': total,
        'page': page,
        'page_size': page_size,
        'results': results,
        'facets': facets,
        'meta': meta,
    })
