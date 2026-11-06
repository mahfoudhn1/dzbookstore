"""Search local catalog first, then external providers, then import."""
from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify

from catalog.images import mirror_cover_image
from catalog.models import Category, Edition, Work
from catalog.services import create_edition, create_work, find_or_create_language
from common.text import isbn_digits, normalize, search_variants
from .models import ExternalIdentifier, ProviderCache
from .providers import (
    MetadataRecord, ProviderError, configured_providers, get_provider,
)

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60 * 60 * 24  # one day
# Bump when the provider payload shape changes so old sparse cached
# responses (e.g. Open Library results without ISBNs) are not reused.
CACHE_KEY_VERSION = 3


def _cache_key(field, query, limit):
    return f'v{CACHE_KEY_VERSION}:{field}:{normalize(query)}:{limit}'


def category_slugs_from_labels(labels):
    """Map provider category labels to existing catalog categories.

    External subjects are free-form ("Fiction", "Algerian literature", …), so
    they are matched by slug or localized name and silently skipped when no
    catalog category exists yet.
    """
    slugs = []
    for raw in labels or []:
        label = str(raw).strip()
        if not label:
            continue
        category = Category.objects.filter(
            Q(slug=slugify(label)[:170])
            | Q(name_fr__iexact=label)
            | Q(name_ar__iexact=label)
        ).first()
        if category is not None and category.slug not in slugs:
            slugs.append(category.slug)
    return slugs


def local_search(query, field='any', limit=10):
    """Return catalog hits in the same shape as provider results."""
    query = (query or '').strip()
    if not query:
        return []

    digits = isbn_digits(query)
    results = []
    works = Work.objects.prefetch_related('authors', 'categories', 'editions').distinct()
    for variant in search_variants(query)[:3]:
        condition = (
            Q(normalized_title__icontains=variant)
            | Q(title__icontains=query)
            | Q(original_title__icontains=query)
            | Q(authors__normalized_name__icontains=variant)
        )
        if digits:
            condition |= Q(editions__isbn13__icontains=digits) | Q(editions__isbn10__icontains=digits)
        if field == 'title':
            condition = Q(normalized_title__icontains=variant) | Q(title__icontains=query)
        elif field == 'author':
            condition = Q(authors__normalized_name__icontains=variant) | Q(authors__name__icontains=query)
        elif field == 'isbn':
            condition = Q(editions__isbn13__icontains=digits) | Q(editions__isbn10__icontains=digits)
        elif field == 'publisher':
            condition = Q(editions__publisher__name__icontains=query)
        for work in works.filter(condition)[: limit * 2]:
            if any(entry['work_id'] == work.id for entry in results):
                continue
            edition = None
            if digits:
                edition = work.editions.filter(
                    Q(isbn13__icontains=digits) | Q(isbn10__icontains=digits)
                ).first()
            edition = edition or work.editions.select_related('publisher').first()
            results.append({
                'provider': 'local',
                'provider_id': f'work:{work.id}',
                'work_id': work.id,
                'edition_id': edition.id if edition else None,
                'title': work.title,
                'subtitle': '',
                'authors': [author.name for author in work.authors.all()],
                'translators': [],
                'publisher': edition.publisher.name if edition and edition.publisher else '',
                'publication_year': edition.publication_year if edition else None,
                'language': edition.language if edition else work.original_language,
                'page_count': edition.page_count if edition else None,
                'isbn10': edition.isbn10 if edition else '',
                'isbn13': edition.isbn13 if edition else '',
                'cover_image': (edition.cover_image if edition else None) or work.cover_image or '',
                'description': work.synopsis or '',
                'categories': [category.name_fr for category in work.categories.all()],
                'source_url': '',
                'attribution': 'Catalogue BookstoreDZ',
                'license': 'Fiche interne',
                'found_locally': True,
            })
            if len(results) >= limit:
                return results
    return results


def _provider_search_cached(provider, query, field, limit):
    key = _cache_key(field, query, limit)
    cached = ProviderCache.get_fresh(provider.name, key)
    if cached is not None:
        return [MetadataRecord(**item) for item in cached], True

    records = provider.search(query, field=field, limit=limit)
    payload = [record.to_dict() for record in records]
    ProviderCache.store(provider.name, key, payload, ttl_seconds=CACHE_TTL_SECONDS)
    return records, False


def _provider_lookup_cached(provider, isbn):
    key = f'isbn-lookup:{isbn}'
    cached = ProviderCache.get_fresh(provider.name, key)
    if cached is not None:
        return MetadataRecord(**cached), True

    record = provider.lookup_isbn(isbn)
    if record is not None:
        ProviderCache.store(provider.name, key, record.to_dict(), ttl_seconds=CACHE_TTL_SECONDS)
    return record, False


def dedupe_records(records):
    """Merge the same edition found in several providers."""
    merged = []
    index = {}
    for record in records:
        isbn = record.get('isbn13') or record.get('isbn10')
        key = isbn or (normalize(record.get('title')) + '|' + normalize(
            (record.get('authors') or [''])[0]
        ))
        if key and key in index:
            existing = index[key]
            # Keep the richer description/cover while recording provenance.
            if not existing.get('description') and record.get('description'):
                existing['description'] = record['description']
            if not existing.get('cover_image') and record.get('cover_image'):
                existing['cover_image'] = record['cover_image']
            merged_categories = existing.setdefault('categories', [])
            for label in record.get('categories') or []:
                if label not in merged_categories:
                    merged_categories.append(label)
            existing.setdefault('sources', []).append({
                'provider': record.get('provider'),
                'provider_id': record.get('provider_id'),
                'attribution': record.get('attribution'),
            })
            continue
        record.setdefault('sources', [{
            'provider': record.get('provider'),
            'provider_id': record.get('provider_id'),
            'attribution': record.get('attribution'),
        }])
        index[key] = record
        merged.append(record)
    return merged


def search_metadata(query, field='any', include_external=True, limit=20):
    """Local catalog first; external providers only when it is necessary."""
    query = (query or '').strip()
    local_results = local_search(query, field=field, limit=limit)

    providers_status = {}
    records = list(local_results)
    if include_external and len(local_results) < limit:
        for provider in configured_providers():
            try:
                found, from_cache = _provider_search_cached(
                    provider, query, field, limit - len(local_results)
                )
            except ProviderError as exc:
                providers_status[provider.name] = {
                    'status': exc.code,
                    'message': str(exc),
                    'label': provider.label,
                }
                continue
            except Exception as exc:  # noqa: BLE001 - never fail the whole search
                logger.exception('Unexpected metadata provider failure: %s', provider.name)
                providers_status[provider.name] = {
                    'status': 'error', 'message': str(exc), 'label': provider.label,
                }
                continue

            providers_status[provider.name] = {
                'status': 'cached' if from_cache else 'ok',
                'count': len(found),
                'label': provider.label,
                'attribution': provider.attribution,
            }
            records.extend(record.to_dict() for record in found)
    else:
        for provider in configured_providers():
            providers_status[provider.name] = {
                'status': 'skipped',
                'message': 'Le catalogue local contient déjà assez de résultats.',
                'label': provider.label,
                'attribution': provider.attribution,
            }

    return {
        'query': query,
        'field': field,
        'local_count': len(local_results),
        'results': dedupe_records(records)[:limit],
        'providers': providers_status,
    }


def _flat_local_edition(edition):
    work = edition.work
    return {
        'found': True,
        'source': 'local',
        'title': work.title,
        'original_title': work.original_title,
        'work_id': work.id,
        'work_slug': work.slug,
        'edition_id': edition.id,
        'authors': [author.name for author in work.authors.all()],
        'publisher': edition.publisher.name if edition.publisher else '',
        'publication_year': edition.publication_year,
        'format': edition.format,
        'language': edition.language,
        'page_count': edition.page_count,
        'isbn13': edition.isbn13,
        'isbn10': edition.isbn10,
        'cover_image': edition.cover_image or work.cover_image,
        'synopsis': work.synopsis,
        'categories': [category.name_fr for category in work.categories.all()],
    }


def lookup_isbn(isbn):
    """Flat result used by the seller form and the legacy catalog endpoint."""
    digits = isbn_digits(isbn)
    if not digits:
        return {'found': False, 'isbn': isbn, 'error': 'ISBN invalide'}

    local_edition = Edition.objects.filter(
        Q(isbn13__iexact=digits) | Q(isbn10__iexact=digits)
    ).select_related('work', 'publisher').prefetch_related('work__authors').first()
    if local_edition is not None:
        return _flat_local_edition(local_edition)

    providers_status = {}
    for provider in configured_providers():
        try:
            record, from_cache = _provider_lookup_cached(provider, digits)
        except ProviderError as exc:
            providers_status[provider.name] = {'status': exc.code, 'message': str(exc)}
            continue
        except Exception:  # noqa: BLE001
            logger.exception('Unexpected ISBN lookup failure: %s', provider.name)
            providers_status[provider.name] = {'status': 'error'}
            continue

        if record is None:
            providers_status[provider.name] = {'status': 'not_found'}
            continue

        providers_status[provider.name] = {
            'status': 'cached' if from_cache else 'ok',
            'attribution': provider.attribution,
        }
        data = record.to_dict()
        data.update({
            'found': True,
            'source': provider.name,
            'source_url': record.source_url,
            'attribution': provider.attribution,
            'license': record.license,
            'providers': providers_status,
        })
        return data

    return {'found': False, 'isbn': digits, 'providers': providers_status}


def _record_from_payload(payload, provider_name):
    allowed = {
        'provider_id', 'title', 'subtitle', 'authors', 'translators', 'publisher',
        'published_date', 'publication_year', 'language', 'page_count', 'isbn10',
        'isbn13', 'cover_image', 'description', 'categories', 'source_url',
        'attribution', 'license', 'raw',
    }
    data = {key: value for key, value in payload.items() if key in allowed}
    data['provider'] = provider_name
    data.setdefault('provider_id', '')
    data.setdefault('title', '')
    return MetadataRecord(**data)


@transaction.atomic
def import_record(*, provider=None, identifier=None, payload=None):
    """Create or link the catalog records described by a selected result.

    Idempotent: a previously imported provider identifier returns the same
    edition instead of forking a duplicate book.
    """
    if payload and payload.get('title'):
        record = _record_from_payload(payload, payload.get('provider') or provider or 'manual')
    else:
        if not provider or not identifier:
            raise ValueError('provider et identifier sont requis.')
        provider_instance = get_provider(provider)
        if provider_instance is None:
            raise ValueError(f'Fournisseur inconnu : {provider}')
        record = provider_instance.lookup(identifier)
        if record is None:
            raise LookupError('Aucune métadonnée trouvée pour cet identifiant.')

    if not (record.title or '').strip():
        raise ValueError('La métadonnée ne contient aucun titre.')

    provenance_key = record.provider_id or record.isbn13 or record.isbn10
    if provenance_key:
        existing = ExternalIdentifier.objects.filter(
            provider=record.provider, identifier=provenance_key
        ).select_related('work', 'edition').first()
        if existing and existing.edition is not None:
            return {
                'created_work': False,
                'created_edition': False,
                'work': existing.work,
                'edition': existing.edition,
                'existing': True,
            }

    # Mirror once: both Work and Edition should point at the same local file.
    cover_image = mirror_cover_image(record.cover_image)

    work, created_work = create_work(
        title=record.title,
        synopsis=(record.description or '')[:5000],
        original_title=record.subtitle or None,
        original_language=record.language or 'fr',
        cover_image=cover_image or None,
        author_names=record.authors,
        category_slugs=category_slugs_from_labels(record.categories),
    )

    language_name = record.language or 'Français'
    language_ref = find_or_create_language(language_name)
    edition, created_edition = create_edition(
        work=work,
        isbn13=record.isbn13,
        isbn10=record.isbn10,
        publisher_name=record.publisher,
        publication_year=record.publication_year,
        edition_title=record.subtitle or None,
        format='Broché',
        language=language_ref.name_fr if language_ref else language_name,
        page_count=record.page_count,
        cover_image=cover_image,
        translator_names=record.translators,
    )

    if provenance_key:
        ExternalIdentifier.objects.update_or_create(
            provider=record.provider,
            identifier=provenance_key,
            defaults={
                'work': work,
                'edition': edition,
                'source_url': record.source_url or None,
                'raw': record.raw or {},
            },
        )

    return {
        'created_work': created_work,
        'created_edition': created_edition,
        'work': work,
        'edition': edition,
        'existing': False,
    }


def provider_catalog():
    """Public description of the provider layer, including attribution."""
    items = []
    for provider in configured_providers():
        items.append({
            'name': provider.name,
            'label': provider.label,
            'attribution': provider.attribution,
            'license': provider.license,
            'docs_url': provider.docs_url,
            'per_minute': provider.per_minute,
            'available': provider.is_available(),
        })
    return items
