import os
import shutil
import tempfile
from io import BytesIO
from unittest import mock

import requests
from django.core.cache import cache
from django.test import TestCase, override_settings
from PIL import Image

from catalog.images import mirror_cover_image
from catalog.models import Category, Edition, Work
from common.testing import make_edition, make_work
from metadata.models import ExternalIdentifier, ProviderCache
from metadata.services import import_record, lookup_isbn, search_metadata


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def json(self):
        return self.payload


GOOGLE_PAYLOAD = {
    'totalItems': 1,
    'items': [{
        'id': 'google-karamazov',
        'volumeInfo': {
            'title': 'Les Frères Karamazov',
            'authors': ['Fiodor Dostoïevski'],
            'publisher': 'Gallimard',
            'publishedDate': '2002-05-14',
            'language': 'fr',
            'pageCount': 920,
            'industryIdentifiers': [
                {'type': 'ISBN_10', 'identifier': '2070408890'},
                {'type': 'ISBN_13', 'identifier': '9782070408894'},
            ],
            'imageLinks': {'thumbnail': 'http://books.google.com/cover.jpg'},
            'description': 'Le dernier roman de Dostoïevski.',
            'categories': ['Fiction', 'Classic Literature'],
            'canonicalVolumeLink': 'https://books.google.com/books?id=google-karamazov',
        },
    }],
}


@override_settings(
    ALLOW_ANONYMOUS_DEMO=True,
    SEND_NOTIFICATION_EMAILS=False,
    METADATA_PROVIDERS=['google_books'],
    GOOGLE_BOOKS_API_KEY='',
)
class MetadataProviderTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_local_catalog_is_checked_before_providers(self):
        work = make_work(title='Nedjma')
        edition = make_edition(work, isbn13='9789961892813')
        self.assertIsNotNone(edition)

        with mock.patch('metadata.providers.requests.get') as http:
            result = lookup_isbn('978-9961-89-281-3')

        self.assertTrue(result['found'])
        self.assertEqual(result['source'], 'local')
        self.assertEqual(result['work_id'], work.id)
        http.assert_not_called()

    def test_provider_failover_and_attribution(self):
        with mock.patch('metadata.providers.requests.get') as http:
            http.return_value = FakeResponse(GOOGLE_PAYLOAD)
            result = search_metadata('karamazov', include_external=True)

        self.assertEqual(result['providers']['google_books']['status'], 'ok')
        self.assertEqual(len(result['results']), 1)
        self.assertEqual(result['results'][0]['provider'], 'google_books')
        self.assertEqual(result['results'][0]['attribution'], 'Google Books')
        self.assertEqual(result['results'][0]['isbn13'], '9782070408894')
        self.assertEqual(
            result['results'][0]['categories'], ['Fiction', 'Classic Literature']
        )

    @override_settings(METADATA_PROVIDERS=['open_library', 'google_books'])
    def test_unavailable_provider_does_not_break_search(self):
        def fake_get(url, params=None, timeout=None):
            if 'openlibrary.org' in url:
                raise requests.RequestException('network down')
            return FakeResponse(GOOGLE_PAYLOAD)

        with mock.patch('metadata.providers.requests.get', side_effect=fake_get):
            result = search_metadata('karamazov')

        self.assertEqual(result['providers']['open_library']['status'], 'unreachable')
        self.assertEqual(result['providers']['google_books']['status'], 'ok')
        self.assertEqual(len(result['results']), 1)

    def test_provider_responses_are_cached(self):
        with mock.patch(
            'metadata.providers.requests.get', return_value=FakeResponse(GOOGLE_PAYLOAD)
        ) as http:
            search_metadata('karamazov')
            search_metadata('karamazov')

        self.assertEqual(http.call_count, 1)
        self.assertTrue(ProviderCache.objects.exists())

    def test_enough_local_results_skip_external_queries(self):
        make_work(title='Nedjma')
        with mock.patch('metadata.providers.requests.get') as http:
            result = search_metadata('nedjma', limit=1)

        self.assertEqual(result['providers']['google_books']['status'], 'skipped')
        http.assert_not_called()


OPEN_LIBRARY_BOOKS_PAYLOAD = {
    'ISBN:9780385533225': {
        'url': 'https://openlibrary.org/books/OL24303521M/The_Particular_Sadness_of_Lemon_Cake',
        'key': '/books/OL24303521M',
        'title': 'The Particular Sadness of Lemon Cake',
        'authors': [{'url': 'https://openlibrary.org/authors/OL34266A', 'name': 'Aimee Bender'}],
        'identifiers': {
            'isbn_13': ['9780385533225'],
            'openlibrary': ['OL24303521M'],
        },
        'publishers': [{'name': 'Knopf Doubleday Publishing Group'}],
        'publish_date': '2010',
        'number_of_pages': 320,
        'cover': {
            'medium': 'https://covers.openlibrary.org/b/id/6429406-M.jpg',
            'large': 'https://covers.openlibrary.org/b/id/6429406-L.jpg',
        },
        'subjects': [{'name': 'Fiction'}, {'name': 'Family Life'}],
    },
}


@override_settings(
    ALLOW_ANONYMOUS_DEMO=True,
    SEND_NOTIFICATION_EMAILS=False,
    METADATA_PROVIDERS=['open_library'],
)
class OpenLibraryLookupTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_isbn_lookup_accepts_open_library_identifier_mapping(self):
        # Open Library's books API returns identifiers as an object whose values
        # are arrays, not as a list of {type, identifier} objects.
        with mock.patch(
            'metadata.providers.requests.get',
            return_value=FakeResponse(OPEN_LIBRARY_BOOKS_PAYLOAD),
        ):
            result = lookup_isbn('978-0-385-53322-5')

        self.assertTrue(result['found'])
        self.assertEqual(result['source'], 'open_library')
        self.assertEqual(result['isbn13'], '9780385533225')
        self.assertEqual(result['isbn10'], '')
        self.assertEqual(result['authors'], ['Aimee Bender'])
        self.assertEqual(result['publisher'], 'Knopf Doubleday Publishing Group')
        self.assertEqual(result['categories'], ['Fiction', 'Family Life'])

    def test_isbn_lookup_still_accepts_legacy_identifier_list(self):
        payload = {
            'ISBN:9780385533225': {
                **OPEN_LIBRARY_BOOKS_PAYLOAD['ISBN:9780385533225'],
                'identifiers': [
                    {'type': 'ISBN_10', 'identifier': '0385533221'},
                    {'type': 'ISBN_13', 'identifier': '9780385533225'},
                ],
            }
        }
        with mock.patch(
            'metadata.providers.requests.get', return_value=FakeResponse(payload)
        ):
            result = lookup_isbn('9780385533225')

        self.assertEqual(result['isbn10'], '0385533221')
        self.assertEqual(result['isbn13'], '9780385533225')


@override_settings(
    ALLOW_ANONYMOUS_DEMO=True,
    SEND_NOTIFICATION_EMAILS=False,
    MIRROR_REMOTE_COVERS=False,
)
class MetadataImportTests(TestCase):
    payload = {
        'provider': 'google_books',
        'provider_id': 'google-karamazov',
        'title': 'Les Frères Karamazov',
        'authors': ['Fiodor Dostoïevski'],
        'translators': ['André Markowicz'],
        'publisher': 'Gallimard',
        'publication_year': 2002,
        'language': 'fr',
        'page_count': 920,
        'isbn10': '2070408890',
        'isbn13': '9782070408894',
        'cover_image': 'https://books.google.com/cover.jpg',
        'description': 'Le dernier roman de Dostoïevski.',
        'categories': ['Roman'],
        'source_url': 'https://books.google.com/books?id=google-karamazov',
        'attribution': 'Google Books',
    }

    def test_import_maps_categories_to_existing_catalog_taxonomy(self):
        category = Category.objects.create(
            name_fr='Roman', name_ar='رواية', slug='roman'
        )
        result = import_record(payload=self.payload)
        self.assertIn(category, result['work'].categories.all())

    def test_import_creates_work_and_edition_with_provenance(self):
        result = import_record(payload=self.payload)
        self.assertTrue(result['created_work'])
        self.assertTrue(result['created_edition'])
        self.assertEqual(Work.objects.count(), 1)
        self.assertEqual(Edition.objects.count(), 1)
        self.assertEqual(result['work'].genres.count(), 0)

        provenance = ExternalIdentifier.objects.get(provider='google_books', identifier='google-karamazov')
        self.assertEqual(provenance.edition_id, result['edition'].id)
        self.assertIn('Les Frères Karamazov', provenance.work.title)
        self.assertEqual(result['edition'].contributions.count(), 1)

    def test_reimport_links_instead_of_duplicating(self):
        first = import_record(payload=self.payload)
        second = import_record(payload=self.payload)

        self.assertTrue(second['existing'])
        self.assertFalse(second['created_work'])
        self.assertEqual(second['work'].id, first['work'].id)
        self.assertEqual(Work.objects.filter(title='Les Frères Karamazov').count(), 1)
        self.assertEqual(Edition.objects.count(), 1)

    def test_import_requires_a_title(self):
        with self.assertRaises(ValueError):
            import_record(payload={'provider': 'google_books', 'provider_id': 'x', 'title': ''})

    def test_translation_editions_stay_separate_from_the_work(self):
        french = import_record(payload=self.payload)
        arabic = import_record(payload={
            **self.payload,
            'provider_id': 'arabic-1',
            'isbn13': '9789953000000',
            'language': 'ar',
            'title': 'الإخوة كارامازوف',
        })
        self.assertNotEqual(french['work'].id, arabic['work'].id)
        self.assertEqual(Work.objects.count(), 2)


class FakeImageDownload:
    def __init__(self, payload):
        self.payload = payload

    def iter_content(self, chunk_size=64 * 1024):
        for start in range(0, len(self.payload), chunk_size):
            yield self.payload[start:start + chunk_size]

    def close(self):
        return None


class CoverMirrorTests(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, True)
        buffer = BytesIO()
        Image.new('RGB', (4, 4), color=(20, 40, 60)).save(buffer, format='PNG')
        self.image_bytes = buffer.getvalue()
        self.override = {
            'MEDIA_ROOT': self.media_root,
            'MEDIA_PUBLIC_BASE_URL': 'https://api.bookstoredz.test',
            'MIRROR_REMOTE_COVERS': True,
        }

    def test_remote_cover_is_saved_locally_and_deduplicated(self):
        with self.settings(**self.override):
            with mock.patch(
                'catalog.images._download',
                return_value=FakeImageDownload(self.image_bytes),
            ):
                first = mirror_cover_image('https://covers.example.test/book.png')
                second = mirror_cover_image('https://covers.example.test/book.png')

        self.assertTrue(first.startswith('https://api.bookstoredz.test/media/covers/'))
        self.assertEqual(first, second)
        filename = first.rsplit('/', 1)[1]
        self.assertTrue(os.path.exists(os.path.join(self.media_root, 'covers', filename)))

    def test_failed_download_keeps_the_original_url(self):
        url = 'https://covers.example.test/missing.png'
        with self.settings(**self.override):
            with mock.patch('catalog.images._download', side_effect=ValueError('offline')):
                self.assertEqual(mirror_cover_image(url), url)

    def test_import_record_downloads_the_cover_once(self):
        payload = {
            'provider': 'manual',
            'provider_id': 'cover-import-1',
            'title': 'Le Livre du couvert',
            'authors': ['Auteur Inconnu'],
            'cover_image': 'https://covers.example.test/cover.png',
        }
        with self.settings(**self.override):
            with mock.patch(
                'catalog.images._download',
                return_value=FakeImageDownload(self.image_bytes),
            ) as download:
                result = import_record(payload=payload)

        self.assertEqual(download.call_count, 1)
        self.assertTrue(
            result['work'].cover_image.startswith('https://api.bookstoredz.test/media/covers/')
        )
        self.assertEqual(result['work'].cover_image, result['edition'].cover_image)


OPEN_LIBRARY_SEARCH_PAYLOAD = {
    'docs': [{
        'key': '/works/OL123W',
        'title': 'Nedjma',
        'author_name': ['Kateb Yacine'],
        'first_publish_year': 1956,
        'publisher': ['Seuil', 'Gallimard'],
        'isbn': ['9782020286800', '2020286809'],
        'language': ['ita', 'fre'],
        'number_of_pages_median': 256,
        'cover_i': 4242,
        'subject': ['Fiction'],
    }],
}


@override_settings(
    ALLOW_ANONYMOUS_DEMO=True,
    SEND_NOTIFICATION_EMAILS=False,
    METADATA_PROVIDERS=['open_library'],
)
class OpenLibrarySearchTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_search_requests_and_exposes_isbn_publisher_and_pages(self):
        with mock.patch(
            'metadata.providers.requests.get',
            return_value=FakeResponse(OPEN_LIBRARY_SEARCH_PAYLOAD),
        ) as http:
            result = search_metadata('Nedjma')

        params = http.call_args.kwargs.get('params') or {}
        self.assertIn('fields', params)
        self.assertIn('isbn', params['fields'])
        self.assertIn('publisher', params['fields'])
        self.assertIn('number_of_pages_median', params['fields'])

        record = result['results'][0]
        self.assertEqual(record['isbn13'], '9782020286800')
        self.assertEqual(record['isbn10'], '2020286809')
        self.assertEqual(record['publisher'], 'Seuil')
        self.assertEqual(record['page_count'], 256)
        self.assertEqual(record['language'], 'fre')
