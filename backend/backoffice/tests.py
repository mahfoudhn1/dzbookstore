from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from common.testing import authenticate, make_offer, make_user, make_work
from marketplace.models import Review


@override_settings(ALLOW_ANONYMOUS_DEMO=False, SEND_NOTIFICATION_EMAILS=False)
class AdministrationTests(TestCase):
    def setUp(self):
        self.staff = make_user(email='admin@example.dz', is_staff=True)
        self.buyer = make_user(email='moderation-buyer@example.dz')
        self.client = APIClient()

    def test_moderation_queue_requires_staff(self):
        self.assertEqual(self.client.get('/api/admin/moderation/').status_code, 401)
        authenticate(self.client, self.buyer)
        self.assertEqual(self.client.get('/api/admin/moderation/').status_code, 403)

        admin_client = authenticate(APIClient(), self.staff)
        response = admin_client.get('/api/admin/moderation/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('reviews', response.data)

    def test_reported_review_can_be_hidden(self):
        offer = make_offer()
        review = Review.objects.create(
            buyer=self.buyer,
            seller_type='BOOKSTORE',
            bookstore=offer.bookstore,
            rating=1,
            comment='Avis signalé',
            report_reason='Contenu inapproprié',
            reported_by=self.buyer,
            reported_at=timezone.now(),
        )
        admin_client = authenticate(APIClient(), self.staff)
        queue = admin_client.get('/api/admin/moderation/')
        self.assertEqual(len(queue.data['reviews']), 1)

        action = admin_client.post(
            f'/api/admin/moderation/reviews/{review.id}/', {'action': 'HIDE'}, format='json'
        )
        self.assertEqual(action.status_code, 200)
        review.refresh_from_db()
        self.assertTrue(review.is_hidden)

    def test_platform_analytics_contains_catalog_and_popularity(self):
        admin_client = authenticate(APIClient(), self.staff)
        make_offer(price=1000)

        response = admin_client.get('/api/admin/overview/')
        self.assertEqual(response.status_code, 200)
        for key in (
            'total_orders', 'total_catalog_works', 'total_catalog_editions',
            'popular_books', 'popular_searches', 'geographic_distribution',
        ):
            self.assertIn(key, response.data)
