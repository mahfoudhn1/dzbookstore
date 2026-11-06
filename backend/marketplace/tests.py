from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from catalog.models import Category
from common.testing import (
    authenticate, make_bookstore, make_geo, make_individual_seller, make_offer,
    make_user, make_work,
)
from geo.models import Wilaya
from marketplace.models import Order, Offer, Review, SubOrder
from notifications.models import Notification


@override_settings(ALLOW_ANONYMOUS_DEMO=True, SEND_NOTIFICATION_EMAILS=False)
class CheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        wilaya, commune = make_geo()
        self.wilaya = wilaya
        self.buyer = make_user(email='acheteur@example.dz')
        self.store = make_bookstore(
            owner=make_user(email='store-checkout@example.dz', role='BOOKSTORE_SELLER'),
            name='Librairie Checkout',
            wilaya=wilaya,
            commune=commune,
        )
        self.seller = make_individual_seller(
            owner=make_user(email='seller-checkout@example.dz', role='INDIVIDUAL_SELLER')
        )
        self.work = make_work(title='Nedjma')
        self.store_offer = make_offer(
            work=self.work, store=self.store, price=1000, stock_quantity=3
        )
        self.seller_offer = make_offer(
            work=self.work, seller=self.seller, price=700, stock_quantity=2
        )

    def _items(self):
        return [
            {'offer_id': self.store_offer.id, 'quantity': 2},
            {'offer_id': self.seller_offer.id, 'quantity': 1},
        ]

    def _delivery(self):
        return {
            f'BOOKSTORE-{self.store.id}': 'HOME_DELIVERY',
            f'INDIVIDUAL-{self.seller.id}': 'STOP_DESK',
        }

    def test_quote_splits_cart_per_seller(self):
        response = self.client.post('/api/checkout/quote/', {
            'items': self._items(),
            'delivery': self._delivery(),
        }, format='json')

        self.assertEqual(response.status_code, 200)
        quote = response.data
        self.assertTrue(quote['valid'])
        self.assertEqual(len(quote['sellers']), 2)
        self.assertEqual(quote['subtotal'], 2700)
        self.assertEqual(quote['delivery_total'], 500 + 300)
        self.assertEqual(quote['grand_total'], 3500)

    def test_quote_reports_insufficient_stock(self):
        response = self.client.post('/api/checkout/quote/', {
            'items': [{'offer_id': self.store_offer.id, 'quantity': 99}],
            'delivery': self._delivery(),
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data['valid'])
        self.assertEqual(response.data['issues'][0]['reason'], 'Stock insuffisant.')

    def test_checkout_creates_suborders_and_reserves_stock(self):
        authenticate(self.client, self.buyer)
        response = self.client.post('/api/checkout/', {
            'items': self._items(),
            'delivery': self._delivery(),
            'recipient_name': 'Amina B.',
            'recipient_phone': '0550112233',
            'recipient_wilaya': self.wilaya.id,
            'recipient_address': '12 Rue Didouche Mourad',
            'payment_method': 'CASH_ON_DELIVERY',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get()
        self.assertEqual(order.suborders.count(), 2)
        self.assertEqual(order.status, Order.Status.PENDING_CONFIRMATION)
        self.assertEqual(order.total_amount, 3500)
        self.assertEqual(order.items.count(), 2)

        self.store_offer.refresh_from_db()
        self.seller_offer.refresh_from_db()
        self.assertEqual(self.store_offer.stock_quantity, 1)
        self.assertEqual(self.seller_offer.stock_quantity, 1)

        # Both sellers and the buyer are notified, explicitly not "completed".
        self.assertTrue(Notification.objects.filter(user=self.buyer).exists())
        self.assertTrue(
            Notification.objects.filter(type=Notification.Type.ORDER).count() >= 3
        )

    def test_checkout_rejects_stale_price(self):
        authenticate(self.client, self.buyer)
        response = self.client.post('/api/checkout/', {
            'items': [{
                'offer_id': self.store_offer.id,
                'quantity': 1,
                'expected_price': 800,
            }],
            'recipient_name': 'Amina B.',
            'recipient_phone': '0550112233',
            'recipient_wilaya': self.wilaya.id,
        }, format='json')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(response.data['issues'][0]['current_price'], 1000)

    def test_checkout_requires_a_phone(self):
        authenticate(self.client, self.buyer)
        response = self.client.post('/api/checkout/', {
            'items': [{'offer_id': self.store_offer.id, 'quantity': 1}],
            'recipient_wilaya': self.wilaya.id,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('téléphone', response.data['error'])


@override_settings(ALLOW_ANONYMOUS_DEMO=True, SEND_NOTIFICATION_EMAILS=False)
class OrderTransitionAndReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        wilaya, commune = make_geo()
        self.wilaya = wilaya
        self.buyer = make_user(email='buyer-flow@example.dz')
        self.store = make_bookstore(
            owner=make_user(email='store-flow@example.dz', role='BOOKSTORE_SELLER'),
            name='Librairie Flow',
            wilaya=wilaya,
            commune=commune,
        )
        self.work = make_work(title='Le Fils du pauvre', author_names=['Mouloud Feraoun'])
        self.offer = make_offer(work=self.work, store=self.store, price=800, stock_quantity=2)
        authenticate(self.client, self.buyer)
        self.order_id = self._checkout()
        self.suborder = SubOrder.objects.get(order_id=self.order_id)

    def _checkout(self):
        response = self.client.post('/api/checkout/', {
            'items': [{'offer_id': self.offer.id, 'quantity': 1}],
            'delivery': {f'BOOKSTORE-{self.store.id}': 'HOME_DELIVERY'},
            'recipient_name': 'Yacine',
            'recipient_phone': '0660000000',
            'recipient_wilaya': self.wilaya.id,
            'recipient_address': 'Alger',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        return response.data['order']['id']

    def _advance(self, status, user=None, suborder_id=None):
        client = APIClient()
        authenticate(client, user or self.store.user)
        return client.post(
            f'/api/orders/{self.order_id}/transition/',
            {'status': status, 'suborder_id': suborder_id or self.suborder.id},
            format='json',
        )

    def test_invalid_transition_is_rejected(self):
        response = self._advance('SHIPPED')
        self.assertEqual(response.status_code, 409)
        self.suborder.refresh_from_db()
        self.assertEqual(self.suborder.status, Order.Status.PENDING_CONFIRMATION)

    def test_seller_confirms_then_ships_and_order_aggregates(self):
        response = self._advance('CONFIRMED')
        self.assertEqual(response.status_code, 200)
        self.assertIn('PREPARING', response.data['allowed_next'])

        self.assertEqual(self._advance('PREPARING').status_code, 200)
        self.assertEqual(self._advance('SHIPPED').status_code, 200)
        delivered = self._advance('DELIVERED')
        self.assertEqual(delivered.status_code, 200)

        order = Order.objects.get(id=self.order_id)
        self.assertEqual(order.status, Order.Status.DELIVERED)
        self.assertTrue(order.events.filter(status=Order.Status.DELIVERED).exists())

    def test_buyer_can_only_cancel(self):
        response = self._advance('CONFIRMED', user=self.buyer)
        self.assertEqual(response.status_code, 403)

        cancelled = self.client.post(
            f'/api/orders/{self.order_id}/cancel/', {'reason': 'Changement d’avis'},
            format='json',
        )
        self.assertEqual(cancelled.status_code, 200)
        order = Order.objects.get(id=self.order_id)
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.offer.refresh_from_db()
        self.assertEqual(self.offer.stock_quantity, 2)

    def test_review_requires_a_delivered_suborder(self):
        denied = self.client.post('/api/buyer/reviews/', {
            'suborder_id': self.suborder.id, 'rating': 5, 'comment': 'Top',
        }, format='json')
        self.assertEqual(denied.status_code, 403)

    def test_review_is_allowed_once_after_delivery(self):
        for status in ('CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'):
            self.assertEqual(self._advance(status).status_code, 200)

        response = self.client.post('/api/buyer/reviews/', {
            'suborder_id': self.suborder.id,
            'rating': 4,
            'comment': 'Livre conforme, envoi rapide.',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Review.objects.count(), 1)

        duplicate = self.client.post('/api/buyer/reviews/', {
            'suborder_id': self.suborder.id, 'rating': 1, 'comment': 'Encore ?',
        }, format='json')
        self.assertEqual(duplicate.status_code, 403)


@override_settings(ALLOW_ANONYMOUS_DEMO=True, SEND_NOTIFICATION_EMAILS=False)
class FavoritesAndDeliveryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        wilaya, commune = make_geo()
        self.user = make_user(email='fav@example.dz')
        self.store = make_bookstore(wilaya=wilaya, commune=commune)
        self.work = make_work(title='Nedjma')
        self.offer = make_offer(work=self.work, store=self.store, stock_quantity=2)
        authenticate(self.client, self.user)

    def test_favorite_bookstore_toggle(self):
        first = self.client.post('/api/buyer/favorites/bookstores/', {
            'bookstore_id': self.store.id,
        }, format='json')
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data['saved'])

        listing = self.client.get('/api/buyer/favorites/bookstores/')
        self.assertEqual(len(listing.data), 1)

        second = self.client.post('/api/buyer/favorites/bookstores/', {
            'bookstore_id': self.store.id,
        }, format='json')
        self.assertFalse(second.data['saved'])

    def test_saved_search_crud(self):
        created = self.client.post('/api/buyer/saved-searches/', {
            'label': 'Nedjma Alger',
            'query_params': {'q': 'Nedjma', 'wilaya_id': 16},
        }, format='json')
        self.assertEqual(created.status_code, 201)

        listing = self.client.get('/api/buyer/saved-searches/')
        self.assertEqual(len(listing.data), 1)

        deleted = self.client.delete(f"/api/buyer/saved-searches/{created.data['id']}/")
        self.assertEqual(deleted.status_code, 204)

    def test_delivery_options_are_seller_defined(self):
        response = self.client.get('/api/delivery/options/', {'offer_id': self.offer.id})
        self.assertEqual(response.status_code, 200)
        methods = {option['method'] for option in response.data['options']}
        self.assertIn('STORE_PICKUP', methods)
        self.assertIn('HOME_DELIVERY', methods)
        self.assertEqual(len(methods), 3)


@override_settings(ALLOW_ANONYMOUS_DEMO=False, SEND_NOTIFICATION_EMAILS=False)
class BookListingApiTests(TestCase):
    """The seller type is derived from the account, never from the payload."""

    def setUp(self):
        self.client = APIClient()
        wilaya, commune = make_geo()
        self.wilaya = wilaya
        self.store_owner = make_user(
            email='librairie-api@example.dz', role='BOOKSTORE_SELLER'
        )
        self.store = make_bookstore(
            owner=self.store_owner,
            name='Librairie API',
            wilaya=wilaya,
            commune=commune,
        )
        self.reader = make_user(email='lecteur-api@example.dz')
        self.buyer = make_user(email='acheteur-api@example.dz')
        Wilaya.objects.get_or_create(
            id=31, defaults={'code': '31', 'name_fr': 'Oran', 'name_ar': 'وهران'}
        )

    def _publish(self, user, payload):
        client = APIClient()
        authenticate(client, user)
        return client.post('/api/books/', payload, format='json')

    def test_library_owner_listing_is_linked_to_its_library(self):
        response = self._publish(self.store_owner, {
            'title': 'Nedjma',
            'author': 'Kateb Yacine',
            'price': 1200,
            'stock_quantity': 4,
            'regions': [16, 31],
            'condition': 'NEW',
        })

        self.assertEqual(response.status_code, 201)
        offer = Offer.objects.get(id=response.data['id'])
        self.assertEqual(offer.bookstore_id, self.store.id)
        self.assertIsNone(offer.individual_seller_id)
        self.assertEqual(offer.seller_id, self.store_owner.id)
        self.assertEqual(offer.stock_quantity, 4)
        self.assertTrue(offer.is_in_stock)
        self.assertEqual(offer.regions, [16, 31])

    def test_listing_persists_imported_bibliographic_fields(self):
        response = self._publish(self.store_owner, {
            'title': 'Nedjma',
            'author': 'Kateb Yacine',
            'authors': ['Kateb Yacine'],
            'price': 1200,
            'stock_quantity': 1,
            'condition': 'NEW',
            'isbn': '9782020286800',
            'publisher': 'Seuil',
            'publication_year': 1996,
            'publication_date': '1996-01-01',
            'page_count': 286,
            'language': 'FRENCH',
            'translators': ['Un Traducteur'],
        })

        self.assertEqual(response.status_code, 201)
        offer = Offer.objects.get(id=response.data['id'])
        self.assertIsNotNone(offer.edition)
        self.assertEqual(offer.edition.isbn13, '9782020286800')
        self.assertEqual(offer.edition.publisher.name, 'Seuil')
        self.assertEqual(offer.edition.publication_year, 1996)
        self.assertEqual(offer.edition.page_count, 286)
        self.assertEqual(offer.edition.contributions.count(), 1)

    def test_isbn10_is_stored_in_its_own_field(self):
        response = self._publish(self.store_owner, {
            'title': 'Le Fils du pauvre',
            'price': 700,
            'stock_quantity': 1,
            'condition': 'NEW',
            'isbn': '2070408890',
        })

        self.assertEqual(response.status_code, 201)
        offer = Offer.objects.get(id=response.data['id'])
        self.assertIsNotNone(offer.edition)
        self.assertEqual(offer.edition.isbn10, '2070408890')
        self.assertIsNone(offer.edition.isbn13)

    def test_normal_user_listing_is_second_hand_with_a_single_copy(self):
        response = self._publish(self.reader, {
            'title': 'Le Fils du pauvre',
            'author': 'Mouloud Feraoun',
            'price': 600,
            'condition': 'GOOD',
            'stock_quantity': 7,  # ignored: one physical second-hand copy
        })

        self.assertEqual(response.status_code, 201)
        offer = Offer.objects.get(id=response.data['id'])
        self.assertIsNone(offer.bookstore_id)
        self.assertIsNotNone(offer.individual_seller_id)
        self.assertEqual(offer.seller_id, self.reader.id)
        self.assertEqual(offer.seller_type, Offer.SellerType.INDIVIDUAL)
        self.assertEqual(offer.stock_quantity, 1)

    def test_listing_requires_authentication(self):
        response = self.client.post(
            '/api/books/', {'title': 'Nedjma', 'price': 900}, format='json'
        )
        self.assertEqual(response.status_code, 401)

    def test_owner_can_update_stock_price_and_regions(self):
        created = self._publish(self.store_owner, {
            'title': 'Nedjma', 'price': 900, 'stock_quantity': 3, 'condition': 'NEW',
        })
        offer_id = created.data['id']

        response = self._patch(
            offer_id, {'stock_quantity': 0, 'price': 850, 'regions': [16]}
        )
        self.assertEqual(response.status_code, 200)

        offer = Offer.objects.get(id=offer_id)
        self.assertEqual(offer.stock_quantity, 0)
        self.assertFalse(offer.is_in_stock)
        self.assertEqual(offer.price, 850)
        self.assertEqual(offer.regions, [16])

    def _patch(self, offer_id, payload):
        client = APIClient()
        authenticate(client, self.store_owner)
        return client.patch(f'/api/books/{offer_id}/', payload, format='json')

    def test_other_users_cannot_edit_a_listing(self):
        created = self._publish(self.store_owner, {
            'title': 'Nedjma', 'price': 900, 'condition': 'NEW',
        })
        client = APIClient()
        authenticate(client, self.reader)
        response = client.patch(
            f"/api/books/{created.data['id']}/", {'price': 1}, format='json'
        )
        self.assertEqual(response.status_code, 403)

    def test_second_hand_condition_and_stock_are_preserved_on_edit(self):
        created = self._publish(self.reader, {
            'title': 'Poèmes', 'price': 500, 'condition': 'ACCEPTABLE',
        })
        offer_id = created.data['id']
        client = APIClient()
        authenticate(client, self.reader)
        response = client.patch(
            f'/api/books/{offer_id}/', {'condition': 'GOOD', 'description': 'Pages propres.'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        offer = Offer.objects.get(id=offer_id)
        self.assertEqual(offer.condition, Offer.Condition.GOOD)
        self.assertEqual(offer.description, 'Pages propres.')
        self.assertIsNone(offer.bookstore_id)

    def test_owner_can_delete_an_unordered_listing(self):
        created = self._publish(self.store_owner, {
            'title': 'Nedjma', 'price': 900, 'condition': 'NEW',
        })
        client = APIClient()
        authenticate(client, self.store_owner)
        response = client.delete(f"/api/books/{created.data['id']}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Offer.objects.filter(id=created.data['id']).exists())

    def test_listing_with_an_order_cannot_be_deleted(self):
        created = self._publish(self.store_owner, {
            'title': 'Nedjma', 'price': 900, 'condition': 'NEW', 'stock_quantity': 2,
        })
        authenticate(self.client, self.buyer)
        checkout = self.client.post('/api/checkout/', {
            'items': [{'offer_id': created.data['id'], 'quantity': 1}],
            'delivery': {f'BOOKSTORE-{self.store.id}': 'HOME_DELIVERY'},
            'recipient_name': 'Amina',
            'recipient_phone': '0550112233',
            'recipient_wilaya': self.wilaya.id,
        }, format='json')
        self.assertEqual(checkout.status_code, 201)

        client = APIClient()
        authenticate(client, self.store_owner)
        response = client.delete(f"/api/books/{created.data['id']}/")
        self.assertEqual(response.status_code, 409)
        self.assertTrue(Offer.objects.filter(id=created.data['id']).exists())

    def test_library_filter_returns_the_library_catalog(self):
        self._publish(self.store_owner, {
            'title': 'Nedjma', 'price': 900, 'condition': 'NEW', 'stock_quantity': 2,
        })
        self._publish(self.reader, {'title': 'Autre livre', 'price': 400})

        response = self.client.get('/api/books/', {'library': self.store.id})
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['bookstore']['id'], self.store.id)
        self.assertEqual(results[0]['stock_quantity'], 2)

    def test_listing_category_is_saved_and_shared_on_the_work(self):
        category = Category.objects.create(
            name_fr='Roman', name_ar='رواية', slug='roman'
        )
        response = self._publish(self.store_owner, {
            'title': 'Nedjma',
            'price': 900,
            'condition': 'NEW',
            'category_slug': 'roman',
        })
        self.assertEqual(response.status_code, 201)

        offer = Offer.objects.get(id=response.data['id'])
        self.assertEqual(offer.category_id, category.id)
        self.assertEqual(response.data['category_slug'], 'roman')
        self.assertIn(category, offer.work.categories.all())

    def test_listing_accepts_multiple_categories_and_filters_by_all_of_them(self):
        roman = Category.objects.create(name_fr='Roman', name_ar='رواية', slug='roman')
        history = Category.objects.create(name_fr='Histoire', name_ar='تاريخ', slug='histoire')
        poetry = Category.objects.create(name_fr='Poésie', name_ar='شعر', slug='poesie')

        response = self._publish(self.store_owner, {
            'title': 'Nedjma',
            'price': 900,
            'condition': 'NEW',
            'categories': [roman.id, history.id],
        })
        self.assertEqual(response.status_code, 201)
        offer = Offer.objects.get(id=response.data['id'])
        self.assertEqual(offer.category_id, roman.id)
        self.assertCountEqual(
            offer.categories.values_list('slug', flat=True), ['roman', 'histoire']
        )

        only_poetry = self._publish(self.store_owner, {
            'title': 'Poèmes',
            'price': 500,
            'condition': 'NEW',
            'categories': [poetry.id],
        })
        self.assertEqual(only_poetry.status_code, 201)

        single = self.client.get('/api/books/', {
            'library': self.store.id, 'category': 'histoire',
        })
        rows = single.data.get('results', single.data)
        self.assertEqual([row['work_title'] for row in rows], ['Nedjma'])

        multiple = self.client.get('/api/books/', {
            'library': self.store.id, 'category': 'histoire,poesie',
        })
        rows = multiple.data.get('results', multiple.data)
        self.assertCountEqual([row['work_title'] for row in rows], ['Nedjma', 'Poèmes'])

    def test_library_catalog_filters_by_category_search_stock_and_ordering(self):
        category = Category.objects.create(
            name_fr='Roman', name_ar='رواية', slug='roman'
        )
        self._publish(self.store_owner, {
            'title': 'Nedjma',
            'author': 'Kateb Yacine',
            'price': 500,
            'condition': 'NEW',
            'stock_quantity': 2,
            'category_slug': category.slug,
        })
        self._publish(self.store_owner, {
            'title': 'Poèmes',
            'author': 'Jean Sénac',
            'price': 900,
            'condition': 'NEW',
            'stock_quantity': 0,
            'category_slug': category.slug,
        })

        filtered = self.client.get('/api/books/', {
            'library': self.store.id,
            'category': 'roman',
            'search': 'Nedjma',
            'is_in_stock': 'true',
            'ordering': '-price',
        })
        self.assertEqual(filtered.status_code, 200)
        rows = filtered.data.get('results', filtered.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['work_title'], 'Nedjma')

        out_of_stock = self.client.get('/api/books/', {
            'library': self.store.id,
            'is_in_stock': 'false',
        })
        rows = out_of_stock.data.get('results', out_of_stock.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['work_title'], 'Poèmes')

        sorted_rows = self.client.get('/api/books/', {
            'library': self.store.id,
            'ordering': '-price',
        }).data.get('results', [])
        self.assertEqual([row['price'] for row in sorted_rows], [900, 500])

    def test_book_language_is_saved_and_filterable(self):
        self._publish(self.store_owner, {
            'title': 'Nedjma',
            'price': 900,
            'condition': 'NEW',
            'language': 'ARABIC',
        })
        self._publish(self.store_owner, {
            'title': 'Le Fils du pauvre',
            'price': 600,
            'condition': 'GOOD',
            'language': 'Français',
        })

        arabic = self.client.get('/api/books/', {
            'library': self.store.id,
            'language': 'ARABIC',
        })
        self.assertEqual(arabic.status_code, 200)
        rows = arabic.data.get('results', arabic.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['work_title'], 'Nedjma')
        self.assertEqual(rows[0]['language'], 'ARABIC')

        french = self.client.get('/api/books/', {
            'library': self.store.id,
            'language': 'fr',
        })
        rows = french.data.get('results', french.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['language'], 'FRENCH')

    def test_owner_can_change_book_language(self):
        created = self._publish(self.store_owner, {
            'title': 'Nedjma', 'price': 900, 'condition': 'NEW',
        })
        self.assertEqual(created.data['language'], 'FRENCH')

        response = self._patch(created.data['id'], {'language': 'ENGLISH'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Offer.objects.get(id=created.data['id']).language, 'ENGLISH')

    def test_category_can_be_cleared_on_update(self):
        category = Category.objects.create(
            name_fr='Essai', name_ar='مقالة', slug='essai'
        )
        created = self._publish(self.store_owner, {
            'title': 'Nedjma',
            'price': 900,
            'condition': 'NEW',
            'category_slug': category.slug,
        })
        offer_id = created.data['id']

        response = self._patch(offer_id, {'category': None})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(Offer.objects.get(id=offer_id).category_id)

    def test_publishing_ignores_client_supplied_seller_type(self):
        client = APIClient()
        authenticate(client, self.reader)
        response = client.post('/api/offers/publish/', {
            'title': 'Nedjma',
            'price': 700,
            'seller_type': 'BOOKSTORE',
            'bookstore_id': self.store.id,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        offer = Offer.objects.get(id=response.data['offer_id'])
        self.assertEqual(offer.seller_type, Offer.SellerType.INDIVIDUAL)
        self.assertIsNone(offer.bookstore_id)


@override_settings(ALLOW_ANONYMOUS_DEMO=True, SEND_NOTIFICATION_EMAILS=False)
class LibraryOrderApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        wilaya, commune = make_geo()
        self.wilaya = wilaya
        self.owner = make_user(
            email='library-orders@example.dz', role='BOOKSTORE_SELLER'
        )
        self.store = make_bookstore(
            owner=self.owner,
            name='Librairie des Commandes',
            wilaya=wilaya,
            commune=commune,
        )
        self.buyer = make_user(email='library-buyer@example.dz')
        self.other = make_user(email='library-outsider@example.dz')
        self.work = make_work(title='Nedjma')
        self.offer = make_offer(
            work=self.work, store=self.store, price=1200, stock_quantity=3
        )

    def _place_order(self, url='/api/checkout/'):
        client = APIClient()
        authenticate(client, self.buyer)
        return client.post(url, {
            'items': [{'offer_id': self.offer.id, 'quantity': 1}],
            'delivery': {f'BOOKSTORE-{self.store.id}': 'HOME_DELIVERY'},
            'recipient_name': 'Amina',
            'recipient_phone': '0550112233',
            'recipient_wilaya': self.wilaya.id,
            'recipient_address': '12 Rue des Livres',
        }, format='json')

    def _owner_client(self):
        client = APIClient()
        authenticate(client, self.owner)
        return client

    def test_library_orders_list_and_order_links(self):
        created = self._place_order('/api/orders/')
        self.assertEqual(created.status_code, 201)

        order = Order.objects.get(id=created.data['order']['id'])
        suborder = order.suborders.get()
        item = order.items.get()
        self.assertEqual(suborder.bookstore_id, self.store.id)
        self.assertEqual(item.offer.bookstore_id, self.store.id)
        self.assertEqual(item.seller_id, str(self.store.id))

        response = self._owner_client().get('/api/libraries/me/orders/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        row = response.data[0]
        self.assertEqual(row['order_number'], order.order_number)
        self.assertEqual(row['status'], 'PENDING')
        self.assertEqual(row['items'][0]['title'], 'Nedjma')
        self.assertIn('CONFIRMED', row['allowed_statuses'])

    def test_library_can_advance_order_status(self):
        created = self._place_order()
        order_id = created.data['order']['id']
        client = self._owner_client()

        shipped = client.patch(
            f'/api/libraries/me/orders/{order_id}/',
            {'status': 'SHIPPED', 'tracking_number': 'YAL-12345'},
            format='json',
        )
        self.assertEqual(shipped.status_code, 200)
        self.assertEqual(shipped.data['status'], 'SHIPPED')
        self.assertEqual(shipped.data['tracking_number'], 'YAL-12345')
        suborder = SubOrder.objects.get(order_id=order_id, bookstore=self.store)
        self.assertEqual(suborder.status, Order.Status.SHIPPED)

        delivered = client.patch(
            f'/api/libraries/me/orders/{order_id}/',
            {'status': 'DELIVERED'},
            format='json',
        )
        self.assertEqual(delivered.status_code, 200)
        self.assertEqual(delivered.data['status'], 'DELIVERED')
        suborder.refresh_from_db()
        self.assertEqual(suborder.status, Order.Status.DELIVERED)

    def test_library_can_cancel_and_restore_stock(self):
        created = self._place_order()
        order_id = created.data['order']['id']
        self.offer.refresh_from_db()
        self.assertEqual(self.offer.stock_quantity, 2)

        response = self._owner_client().patch(
            f'/api/libraries/me/orders/{order_id}/',
            {'status': 'CANCELLED'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'CANCELLED')
        self.offer.refresh_from_db()
        self.assertEqual(self.offer.stock_quantity, 3)

    def test_other_users_cannot_manage_library_orders(self):
        created = self._place_order()
        order_id = created.data['order']['id']
        client = APIClient()
        authenticate(client, self.other)

        self.assertEqual(client.get('/api/libraries/me/orders/').status_code, 404)
        response = client.patch(
            f'/api/libraries/me/orders/{order_id}/',
            {'status': 'CONFIRMED'},
            format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_library_orders_require_authentication(self):
        self.assertEqual(self.client.get('/api/libraries/me/orders/').status_code, 401)
