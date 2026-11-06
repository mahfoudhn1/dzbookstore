from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from catalog.models import Category, Edition, Genre, Language, Work
from common.testing import authenticate, make_bookstore, make_edition, make_geo, make_user, make_work


@override_settings(ALLOW_ANONYMOUS_DEMO=False, SEND_NOTIFICATION_EMAILS=False)
class ManualCatalogEntryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        wilaya, commune = make_geo()
        self.store = make_bookstore(wilaya=wilaya, commune=commune)
        self.staff = make_user(email='catalog-admin@example.dz', is_staff=True)

    def test_anonymous_cannot_create_catalog_entries(self):
        response = self.client.post('/api/works/', {
            'title': 'Nouveau livre', 'author_names': ['Auteur Inconnu'],
        }, format='json')
        self.assertEqual(response.status_code, 401)

    def test_staff_can_create_work_with_authors_and_genres(self):
        Genre.objects.create(name_fr='Roman', slug='roman')
        authenticate(self.client, self.staff)
        response = self.client.post('/api/works/', {
            'title': 'La Colline oubliée',
            'author_names': ['Mouloud Mammeri'],
            'genre_slugs': ['roman'],
            'synopsis': 'Un village kabyle.',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['created'])
        work = Work.objects.get(title='La Colline oubliée')
        self.assertEqual([author.name for author in work.authors.all()], ['Mouloud Mammeri'])
        self.assertEqual([genre.slug for genre in work.genres.all()], ['roman'])

    def test_duplicate_work_is_reused_instead_of_forked(self):
        authenticate(self.client, self.staff)
        first = self.client.post('/api/works/', {
            'title': 'Nedjma', 'author_names': ['Kateb Yacine'],
        }, format='json')
        second = self.client.post('/api/works/', {
            'title': '  NEDJMA ', 'author_names': ['Kateb Yacine'],
        }, format='json')

        self.assertEqual(first.status_code, 201)
        self.assertFalse(second.data['created'])
        self.assertEqual(Work.objects.filter(normalized_title='nedjma').count(), 1)

    def test_same_title_different_author_creates_a_distinct_work(self):
        authenticate(self.client, self.staff)
        self.client.post('/api/works/', {'title': 'Poèmes', 'author_names': ['Auteur A']})
        response = self.client.post('/api/works/', {'title': 'Poèmes', 'author_names': ['Auteur B']})
        self.assertTrue(response.data['created'])
        self.assertEqual(Work.objects.filter(title='Poèmes').count(), 2)

    def test_verified_bookstore_can_add_a_missing_edition(self):
        work = make_work(title='Nedjma')
        store_client = authenticate(APIClient(), self.store.user)
        response = store_client.post('/api/editions/', {
            'work': work.id,
            'isbn13': '9782220000001',
            'publication_year': 2020,
            'format': 'Poche',
            'language': 'Français',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['created'])
        self.assertEqual(Edition.objects.filter(work=work).count(), 1)

    def test_edition_import_is_deduplicated_by_isbn(self):
        work = make_work(title='Nedjma')
        make_edition(work, isbn13='9789961892813')
        authenticate(self.client, self.staff)

        response = self.client.post('/api/editions/', {
            'work': work.id,
            'isbn13': '978-9961-89-281-3',
            'format': 'Poche',
            'language': 'Français',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['created'])
        self.assertEqual(Edition.objects.count(), 1)

    def test_public_catalog_reads_remain_open(self):
        make_work(title='Nedjma')
        response = self.client.get('/api/works/')
        self.assertEqual(response.status_code, 200)

    def test_languages_and_genres_endpoints(self):
        Language.objects.create(code='ar', name_fr='Arabe')
        Genre.objects.create(name_fr='Poésie', slug='poesie')
        self.assertEqual(self.client.get('/api/languages/').status_code, 200)
        self.assertEqual(self.client.get('/api/genres/').status_code, 200)

    def test_expanded_category_taxonomy_is_seeded(self):
        expected = {
            'classic-literature',
            'contemporary-fiction',
            'philosophy',
            'psychology',
            'history-politics',
            'sociology-thought',
            'religion-spirituality',
            'science-medicine',
            'computer-science-tech',
            'business-economics',
            'biography-memoir',
            'poetry',
            'children-ya',
            'comics-manga',
            'university-school',
            'language-learning',
        }
        self.assertSetEqual(
            set(Category.objects.filter(slug__in=expected).values_list('slug', flat=True)),
            expected,
        )
