from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from common.testing import (
    make_bookstore, make_geo, make_individual_seller, make_offer, make_user, make_work,
)
from geo.models import Wilaya
from marketplace.models import Offer


@override_settings(ALLOW_ANONYMOUS_DEMO=True, SEND_NOTIFICATION_EMAILS=False)
class SearchTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        wilaya, commune = make_geo()
        oran, _ = Wilaya.objects.get_or_create(
            id=31, defaults={'code': '31', 'name_fr': 'Oran', 'name_ar': 'وهران'}
        )

        self.alger_store = make_bookstore(
            owner=make_user(email='alger@example.dz', role='BOOKSTORE_SELLER'),
            name='Librairie Alger',
            wilaya=wilaya,
            commune=commune,
            latitude=36.7538,
            longitude=3.0588,
        )
        self.oran_store = make_bookstore(
            owner=make_user(email='oran@example.dz', role='BOOKSTORE_SELLER'),
            name='Librairie Oran',
            wilaya=oran,
            commune=None,
            latitude=35.6987,
            longitude=-0.6349,
        )

        self.nedjma = make_work(title='Nedjma', author_names=['Kateb Yacine'])
        self.alger_offer = make_offer(
            work=self.nedjma, store=self.alger_store, price=1200, stock_quantity=4
        )
        self.oran_offer = make_offer(
            work=self.nedjma, store=self.oran_store, price=900, stock_quantity=2
        )

        self.arabic_work = make_work(title='نجمة', author_names=['كاتب ياسين'])
        self.seller = make_individual_seller(
            owner=make_user(email='particulier@example.dz', role='INDIVIDUAL_SELLER'),
            wilaya=oran,
            commune=None,
        )
        self.arabic_offer = make_offer(
            work=self.arabic_work, seller=self.seller, price=650, stock_quantity=1,
            condition=Offer.Condition.GOOD,
        )

    def test_q_matches_title_and_author(self):
        response = self.client.get('/api/search/offers/', {'q': 'Nedjma'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)

        by_author = self.client.get('/api/search/offers/', {'q': 'Kateb Yacine'})
        self.assertEqual(by_author.data['count'], 2)

    def test_price_and_condition_filters(self):
        response = self.client.get('/api/search/offers/', {'max_price': 1000})
        self.assertEqual(response.data['count'], 2)  # Oran 900 + Arabic 650

        cheap_new_only = self.client.get(
            '/api/search/offers/', {'max_price': 1000, 'condition': 'NEW'}
        )
        self.assertEqual(cheap_new_only.data['count'], 1)
        self.assertEqual(cheap_new_only.data['results'][0]['price'], 900)

    def test_wilaya_filter_and_price_sorting(self):
        response = self.client.get(
            '/api/search/offers/', {'q': 'Nedjma', 'sort': 'price_asc'}
        )
        prices = [row['price'] for row in response.data['results']]
        self.assertEqual(prices, [900, 1200])

        alger_only = self.client.get('/api/search/offers/', {'wilaya_id': 16})
        self.assertEqual(alger_only.data['count'], 1)
        self.assertEqual(alger_only.data['results'][0]['seller_name'], 'Librairie Alger')

    def test_arabic_diacritics_match_folded_title(self):
        response = self.client.get('/api/search/offers/', {'q': 'نَجْمَة'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['work_title'], 'نجمة')

    def test_typo_tolerance_falls_back_to_similar_titles(self):
        response = self.client.get('/api/search/offers/', {'q': 'Nedjmaa'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertTrue(response.data['meta']['typo_fallback'])
        self.assertTrue(response.data['meta']['suggestions'])

    def test_distance_radius_and_nearest_sorting(self):
        response = self.client.get('/api/search/offers/', {
            'q': 'Nedjma',
            'lat': 36.7538,
            'lng': 3.0588,
            'radius_km': 50,
            'sort': 'nearest',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        result = response.data['results'][0]
        self.assertEqual(result['seller_name'], 'Librairie Alger')
        self.assertEqual(result['distance_km'], 0.0)

    def test_facets_are_returned(self):
        response = self.client.get('/api/search/offers/', {'q': 'Nedjma'})
        facets = response.data['facets']
        self.assertEqual(facets['seller_types']['BOOKSTORE'], 2)
        self.assertEqual(facets['price_range']['min'], 900)
        self.assertIn('Alger', facets['wilayas'])

    def test_works_endpoint_groups_offers_for_comparison(self):
        response = self.client.get('/api/search/works/', {'q': 'Nedjma'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        group = response.data['results'][0]
        self.assertEqual(group['work']['title'], 'Nedjma')
        self.assertEqual(len(group['offers']), 2)
        self.assertEqual({offer['price'] for offer in group['offers']}, {900, 1200})

    def test_unavailable_offers_are_hidden_by_default(self):
        self.oran_offer.status = Offer.Status.SOLD
        self.oran_offer.stock_quantity = 0
        self.oran_offer.save()

        response = self.client.get('/api/search/offers/', {'q': 'Nedjma'})
        self.assertEqual(response.data['count'], 1)

        with_unavailable = self.client.get(
            '/api/search/offers/', {'q': 'Nedjma', 'include_unavailable': 'true'}
        )
        self.assertEqual(with_unavailable.data['count'], 2)

    def test_offers_viewset_uses_the_same_filters(self):
        response = self.client.get('/api/offers/', {'max_price': 700})
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['work_title'], 'نجمة')
