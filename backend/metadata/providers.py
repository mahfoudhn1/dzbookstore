"""External book-metadata providers behind one narrow interface.

Adding another source later means implementing ``BaseMetadataProvider`` and
registering it; neither the views nor the catalog import code need to know
which provider was used.
"""
from __future__ import annotations

import os
import time
from dataclasses import asdict, dataclass, field

import requests
from django.conf import settings
from django.core.cache import cache

from common.text import isbn_digits

REQUEST_TIMEOUT = getattr(settings, 'METADATA_HTTP_TIMEOUT', 5)


class ProviderError(Exception):
    """A provider call failed in a recoverable way."""

    def __init__(self, message, code='error'):
        super().__init__(message)
        self.code = code


class ProviderUnavailable(ProviderError):
    def __init__(self, message, code='unavailable'):
        super().__init__(message, code)


@dataclass
class MetadataRecord:
    provider: str
    provider_id: str
    title: str
    subtitle: str = ''
    authors: list = field(default_factory=list)
    translators: list = field(default_factory=list)
    publisher: str = ''
    published_date: str = ''
    publication_year: int | None = None
    language: str = ''
    page_count: int | None = None
    isbn10: str = ''
    isbn13: str = ''
    cover_image: str = ''
    description: str = ''
    # Raw category / subject labels returned by the provider.  The catalog
    # layer maps them onto existing ``catalog.Category`` rows.
    categories: list = field(default_factory=list)
    source_url: str = ''
    attribution: str = ''
    license: str = ''
    raw: dict = field(default_factory=dict, repr=False)

    def to_dict(self):
        data = asdict(self)
        data.pop('raw', None)
        return data


def _safe_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _year_from_date(value):
    if not value:
        return None
    year = str(value)[:4]
    return int(year) if year.isdigit() else None


def _first_identifier(value):
    """Return the first non-empty value from an Open Library identifier field."""
    if isinstance(value, (list, tuple)):
        for entry in value:
            if isinstance(entry, dict):
                entry = entry.get('identifier') or entry.get('value')
            if entry:
                return str(entry)
        return ''
    if isinstance(value, dict):
        return str(value.get('identifier') or value.get('value') or '')
    return str(value) if value else ''


PRIMARY_LANGUAGE_CODES = ('fre', 'ara', 'eng', 'ber', 'tam', 'kab')


def _preferred_language(values):
    """Pick a language from an Open Library work's cross-edition list.

    A work's ``language`` array aggregates every edition, so the first item is
    often unrelated to the edition the user will pick. Prefer the catalogue's
    primary languages and normalise the bibliographic ``fra`` code to ``fre``.
    """
    codes = []
    for value in values or []:
        code = str(value or '').strip().lower()
        if not code:
            continue
        if code == 'fra':
            code = 'fre'
        codes.append(code)
    if not codes:
        return ''
    if codes[0] in PRIMARY_LANGUAGE_CODES:
        return codes[0]
    for code in PRIMARY_LANGUAGE_CODES:
        if code in codes:
            return code
    return codes[0]


def _subject_names(value):
    """Normalise Open Library subject payloads to a list of labels."""
    if not value:
        return []
    if isinstance(value, str):
        return [value]
    names = []
    for entry in value:
        if isinstance(entry, dict):
            entry = entry.get('name') or entry.get('title') or entry.get('subject')
        if entry:
            names.append(str(entry))
    return names


def _open_library_identifiers(item):
    """Normalise the two shapes Open Library uses for ``identifiers``.

    ``jscmd=data`` returns a mapping of identifier type to a list of values::

        {"isbn_13": ["9780385533225"], "openlibrary": ["OL24303521M"]}

    Older payloads (and some tests) use a list of objects::

        [{"type": "ISBN_13", "identifier": "9780385533225"}]

    Both are accepted so a provider change cannot crash an ISBN lookup again.
    """
    raw = item.get('identifiers') or {}
    identifiers = {}
    if isinstance(raw, dict):
        for key, value in raw.items():
            identifiers[str(key).upper()] = _first_identifier(value)
    elif isinstance(raw, list):
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            key = entry.get('type') or entry.get('name') or ''
            value = entry.get('identifier') or entry.get('value')
            if key and value:
                identifiers[str(key).upper()] = str(value)
    return identifiers


def check_rate_limit(provider_name: str, per_minute: int):
    """Per-provider sliding minute bucket kept in the configured cache.

    This is intentionally process-local (Django's default cache); in a
    multi-worker deployment the cache backend is shared and the limit applies
    across workers.  The point is to fail gracefully instead of hammering a
    provider until it bans the server.
    """
    if per_minute <= 0:
        return
    bucket = int(time.time() // 60)
    key = f'metadata:rate:{provider_name}:{bucket}'
    used = cache.get(key, 0)
    if used >= per_minute:
        raise ProviderUnavailable(
            f'Limite de requêtes atteinte pour {provider_name}.', code='rate_limited'
        )
    cache.set(key, used + 1, timeout=120)


class BaseMetadataProvider:
    name = 'base'
    label = 'Provider'
    attribution = ''
    license = ''
    docs_url = ''
    per_minute = 60

    def is_available(self) -> bool:
        return True

    # -- helpers ---------------------------------------------------------
    def _get(self, url, params=None):
        check_rate_limit(self.name, self.per_minute)
        if not self.is_available():
            raise ProviderUnavailable(f"{self.label} n'est pas configuré.", code='not_configured')
        try:
            response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as exc:
            raise ProviderUnavailable(f'{self.label} est injoignable.', code='unreachable') from exc

        if response.status_code == 429:
            raise ProviderUnavailable(
                f'{self.label} limite les requêtes (HTTP 429).', code='rate_limited'
            )
        if response.status_code in (401, 403):
            raise ProviderUnavailable(
                f'{self.label} a refusé la requête (HTTP {response.status_code}).',
                code='forbidden',
            )
        if response.status_code >= 500:
            raise ProviderUnavailable(
                f'{self.label} est temporairement indisponible (HTTP {response.status_code}).',
                code='unavailable',
            )
        if response.status_code != 200:
            raise ProviderError(
                f'{self.label} a renvoyé HTTP {response.status_code}.', code='bad_response'
            )
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderError(f'{self.label} a renvoyé une réponse illisible.', code='bad_json') from exc

    # -- interface -------------------------------------------------------
    def search(self, query, field='any', limit=10) -> list[MetadataRecord]:
        raise NotImplementedError

    def lookup(self, identifier) -> MetadataRecord | None:
        return self.lookup_isbn(identifier) if isbn_digits(identifier) else None

    def lookup_isbn(self, isbn) -> MetadataRecord | None:
        raise NotImplementedError


class GoogleBooksProvider(BaseMetadataProvider):
    name = 'google_books'
    label = 'Google Books'
    attribution = 'Google Books'
    license = 'Google Books API Terms of Service'
    docs_url = 'https://developers.google.com/books/docs/v1/using'
    per_minute = 60
    endpoint = 'https://www.googleapis.com/books/v1/volumes'

    def is_available(self):
        # Google Books works without a key (lower quota); a key raises the limit.
        return True

    def _params(self, **extra):
        params = dict(extra)
        api_key = getattr(settings, 'GOOGLE_BOOKS_API_KEY', '') or os.getenv('GOOGLE_BOOKS_API_KEY', '')
        if api_key:
            params['key'] = api_key
        return params

    def _build_query(self, query, field):
        query = (query or '').strip()
        if field == 'isbn':
            return f'isbn:{isbn_digits(query)}'
        if field == 'title':
            return f'intitle:{query}'
        if field == 'author':
            return f'inauthor:{query}'
        if field == 'publisher':
            return f'inpublisher:{query}'
        return query

    def _parse(self, item):
        info = item.get('volumeInfo', {}) or {}
        identifiers = info.get('industryIdentifiers', []) or []
        isbn10 = next((x.get('identifier') for x in identifiers if x.get('type') == 'ISBN_10'), '')
        isbn13 = next((x.get('identifier') for x in identifiers if x.get('type') == 'ISBN_13'), '')
        image = (info.get('imageLinks') or {}).get('thumbnail', '')
        # Google requires the https variant of thumbnail URLs when embedding.
        if image.startswith('http://'):
            image = 'https://' + image[len('http://'):]
        volume_id = item.get('id', '')
        return MetadataRecord(
            provider=self.name,
            provider_id=volume_id,
            title=info.get('title', '') or '',
            subtitle=info.get('subtitle', '') or '',
            authors=list(info.get('authors', []) or []),
            publisher=info.get('publisher', '') or '',
            published_date=info.get('publishedDate', '') or '',
            publication_year=_year_from_date(info.get('publishedDate')),
            language=info.get('language', '') or '',
            page_count=_safe_int(info.get('pageCount')),
            isbn10=isbn10 or '',
            isbn13=isbn13 or '',
            cover_image=image or '',
            description=info.get('description', '') or '',
            categories=[str(item) for item in (info.get('categories') or [])][:10],
            source_url=info.get('canonicalVolumeLink') or info.get('infoLink') or '',
            attribution=self.attribution,
            license=self.license,
            raw=item,
        )

    def search(self, query, field='any', limit=10):
        data = self._get(
            self.endpoint,
            params=self._params(q=self._build_query(query, field), maxResults=max(1, min(limit, 20)), printType='books'),
        )
        return [self._parse(item) for item in data.get('items', []) or []]

    def lookup_isbn(self, isbn):
        results = self.search(isbn, field='isbn', limit=5)
        wanted = isbn_digits(isbn)
        for record in results:
            if wanted and wanted in (record.isbn13, record.isbn10):
                return record
        return results[0] if results else None


class OpenLibraryProvider(BaseMetadataProvider):
    name = 'open_library'
    label = 'Open Library'
    attribution = 'Open Library (Internet Archive)'
    license = 'Open Library data is published under the CC0 licence'
    docs_url = 'https://openlibrary.org/developers/api'
    per_minute = 90
    search_endpoint = 'https://openlibrary.org/search.json'
    books_endpoint = 'https://openlibrary.org/api/books'
    # Without an explicit field list, Open Library's search API omits ISBNs,
    # publishers and page counts from its default response.
    search_fields = ','.join([
        'key',
        'title',
        'subtitle',
        'author_name',
        'first_publish_year',
        'publish_date',
        'publisher',
        'isbn',
        'language',
        'number_of_pages_median',
        'cover_i',
        'subject',
        'edition_key',
    ])

    def _record_from_search_doc(self, doc):
        isbns = list(doc.get('isbn', []) or [])
        isbn13 = next((i for i in isbns if len(str(i)) == 13), '')
        isbn10 = next((i for i in isbns if len(str(i)) == 10), '')
        covers = doc.get('cover_i')
        key = doc.get('key', '') or ''
        return MetadataRecord(
            provider=self.name,
            provider_id=key,
            title=doc.get('title', '') or '',
            subtitle=doc.get('subtitle', '') or '',
            authors=list(doc.get('author_name', []) or []),
            publisher=(list(doc.get('publisher', []) or []) or [''])[0],
            published_date=str(doc.get('first_publish_year', '') or ''),
            publication_year=_safe_int(doc.get('first_publish_year')),
            language=_preferred_language(doc.get('language')),
            page_count=_safe_int((list(doc.get('number_of_pages_median', []) or [None]))[0])
            if isinstance(doc.get('number_of_pages_median'), list)
            else _safe_int(doc.get('number_of_pages_median')),
            isbn10=isbn10,
            isbn13=isbn13,
            cover_image=f'https://covers.openlibrary.org/b/id/{covers}-L.jpg' if covers else '',
            description='',
            categories=_subject_names(doc.get('subject') or doc.get('subjects'))[:10],
            source_url=f'https://openlibrary.org{key}' if key else '',
            attribution=self.attribution,
            license=self.license,
            raw={'key': key, 'title': doc.get('title'), 'isbn': isbns[:5]},
        )

    def search(self, query, field='any', limit=10):
        params = {
            'limit': max(1, min(limit, 20)),
            'fields': self.search_fields,
        }
        if field == 'title':
            params['title'] = query
        elif field == 'author':
            params['author'] = query
        elif field == 'isbn':
            params['isbn'] = isbn_digits(query)
        elif field == 'publisher':
            params['publisher'] = query
        else:
            params['q'] = query
        data = self._get(self.search_endpoint, params=params)
        return [self._record_from_search_doc(doc) for doc in data.get('docs', []) or []]

    def lookup_isbn(self, isbn):
        wanted = isbn_digits(isbn)
        data = self._get(
            self.books_endpoint,
            params={'bibkeys': f'ISBN:{wanted}', 'jscmd': 'data', 'format': 'json'},
        )
        item = data.get(f'ISBN:{wanted}') if isinstance(data, dict) else None
        if not item:
            return None

        authors = [a.get('name') for a in item.get('authors', []) or [] if a.get('name')]
        publishers = [p.get('name') for p in item.get('publishers', []) or [] if p.get('name')]
        cover = (item.get('cover') or {}).get('large') or (item.get('cover') or {}).get('medium')
        publish_date = item.get('publish_date', '') or ''
        identifiers = _open_library_identifiers(item)
        return MetadataRecord(
            provider=self.name,
            provider_id=item.get('key', '') or wanted,
            title=item.get('title', '') or '',
            subtitle=item.get('subtitle', '') or '',
            authors=authors,
            publisher=publishers[0] if publishers else '',
            published_date=publish_date,
            publication_year=_year_from_date(publish_date),
            language='',
            page_count=_safe_int(item.get('number_of_pages')),
            isbn10=identifiers.get('ISBN_10', '') or (wanted if len(wanted) == 10 else ''),
            isbn13=identifiers.get('ISBN_13', '') or (wanted if len(wanted) == 13 else ''),
            cover_image=cover or '',
            description=item.get('notes', '') or item.get('subtitle', '') or '',
            categories=_subject_names(item.get('subjects'))[:10],
            source_url=item.get('url', '') or f'https://openlibrary.org/isbn/{wanted}',
            attribution=self.attribution,
            license=self.license,
            raw=item,
        )


PROVIDER_CLASSES = {
    GoogleBooksProvider.name: GoogleBooksProvider,
    OpenLibraryProvider.name: OpenLibraryProvider,
}


def get_provider(name):
    cls = PROVIDER_CLASSES.get(name)
    return cls() if cls else None


def configured_providers():
    """Provider order is configurable via METADATA_PROVIDERS."""
    names = getattr(settings, 'METADATA_PROVIDERS', ['open_library', 'google_books'])
    providers = []
    for name in names:
        provider = get_provider(name)
        if provider is not None:
            providers.append(provider)
    return providers
