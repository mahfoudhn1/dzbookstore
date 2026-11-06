from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from common.testing import authenticate, make_bookstore, make_geo, make_offer, make_user, make_work
from marketplace.models import SavedSearch, Wishlist
from notifications.models import Notification


@override_settings(ALLOW_ANONYMOUS_DEMO=True, SEND_NOTIFICATION_EMAILS=False)
class NotificationTests(TestCase):
    def setUp(self):
        self.buyer = make_user(email='notif-buyer@example.dz')
        self.user_client = authenticate(APIClient(), self.buyer)
        self.store = make_bookstore(
            owner=make_user(email='notif-store@example.dz', role='BOOKSTORE_SELLER')
        )
        self.work = make_work(title='Nedjma')

    def test_new_offer_notifies_wishlist_owner(self):
        Wishlist.objects.create(user=self.buyer, work=self.work)
        with self.captureOnCommitCallbacks(execute=True):
            make_offer(work=self.work, store=self.store, price=900)

        notification = Notification.objects.filter(
            user=self.buyer, type=Notification.Type.WISHLIST
        ).first()
        self.assertIsNotNone(notification)
        self.assertIn('disponible', notification.title.lower())

    def test_price_drop_creates_price_notification(self):
        Wishlist.objects.create(user=self.buyer, work=self.work)
        with self.captureOnCommitCallbacks(execute=True):
            offer = make_offer(work=self.work, store=self.store, price=1000)
            offer.price = 800
            offer.save()

        self.assertTrue(
            Notification.objects.filter(
                user=self.buyer, type=Notification.Type.PRICE
            ).exists()
        )

    def test_saved_search_receives_matching_listing(self):
        SavedSearch.objects.create(
            user=self.buyer,
            label='Nedjma',
            query_params={'q': 'Nedjma'},
            notify=True,
        )
        with self.captureOnCommitCallbacks(execute=True):
            make_offer(work=self.work, store=self.store, price=1100)

        self.assertTrue(
            Notification.objects.filter(
                user=self.buyer, type=Notification.Type.LISTING
            ).exists()
        )

    def test_listing_is_scoped_to_its_owner(self):
        other = make_user(email='other-notif@example.dz')
        Notification.objects.create(user=other, title='Privé', type=Notification.Type.SYSTEM)

        response = self.user_client.get('/api/notifications/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)

    def test_mark_read_and_unread_count(self):
        notification = Notification.objects.create(
            user=self.buyer, title='Commande', type=Notification.Type.ORDER
        )
        unread = self.user_client.get('/api/notifications/unread-count/')
        self.assertEqual(unread.data['unread_count'], 1)

        read = self.user_client.post(f'/api/notifications/{notification.id}/read/')
        self.assertEqual(read.status_code, 200)
        self.assertTrue(read.data['is_read'])

        self.assertEqual(
            self.user_client.get('/api/notifications/unread-count/').data['unread_count'],
            0,
        )

    def test_message_notifications_are_hidden_from_the_feed(self):
        Notification.objects.create(
            user=self.buyer,
            title='Nouveau message',
            type=Notification.Type.MESSAGE,
        )
        response = self.user_client.get('/api/notifications/')
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['unread_count'], 0)
        self.assertEqual(response.data['results'], [])

        unread = self.user_client.get('/api/notifications/unread-count/')
        self.assertEqual(unread.data['unread_count'], 0)
