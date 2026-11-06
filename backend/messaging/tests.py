from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from common.testing import authenticate, make_bookstore, make_geo, make_user
from messaging.models import Conversation, Message


@override_settings(ALLOW_ANONYMOUS_DEMO=True, SEND_NOTIFICATION_EMAILS=False)
class MessagingTests(TestCase):
    def setUp(self):
        self.buyer = make_user(email='buyer-msg@example.dz')
        self.store = make_bookstore(
            owner=make_user(email='store-msg@example.dz', role='BOOKSTORE_SELLER')
        )
        self.outsider = make_user(email='outsider@example.dz')
        self.client = authenticate(APIClient(), self.buyer)

    def _start(self):
        response = self.client.post('/api/messages/conversations/', {
            'bookstore_id': self.store.id,
            'subject': 'Disponibilité',
            'body': 'Bonjour, ce livre est-il disponible ?',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        return response.data['id']

    def test_buyer_starts_conversation_and_seller_replies(self):
        conversation_id = self._start()
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 1)

        seller_client = authenticate(APIClient(), self.store.user)
        listing = seller_client.get('/api/messages/conversations/')
        self.assertEqual(len(listing.data), 1)

        reply = seller_client.post(
            f'/api/messages/conversations/{conversation_id}/messages/',
            {'body': 'Oui, il reste deux exemplaires.'},
            format='json',
        )
        self.assertEqual(reply.status_code, 201)

        detail = self.client.get(f'/api/messages/conversations/{conversation_id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(len(detail.data['messages']), 2)
        # Opening the thread marks the seller reply as read for the buyer.
        self.assertIsNotNone(detail.data['messages'][1]['read_at'])

    def test_outsiders_cannot_read_or_write_the_thread(self):
        conversation_id = self._start()
        outsider = authenticate(APIClient(), self.outsider)

        self.assertEqual(
            outsider.get(f'/api/messages/conversations/{conversation_id}/').status_code,
            404,
        )
        self.assertEqual(
            outsider.post(
                f'/api/messages/conversations/{conversation_id}/messages/',
                {'body': 'Intrusion'},
                format='json',
            ).status_code,
            404,
        )

    def test_message_can_be_reported(self):
        conversation_id = self._start()
        message = Message.objects.get()
        response = self.client.post(
            f'/api/messages/messages/{message.id}/report/',
            {'reason': 'Propos inappropriés'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        message.refresh_from_db()
        self.assertTrue(message.is_reported)

    def test_unread_count_tracks_incoming_messages(self):
        conversation_id = self._start()
        seller_client = authenticate(APIClient(), self.store.user)
        seller_client.post(
            f'/api/messages/conversations/{conversation_id}/messages/',
            {'body': 'Toujours disponible.'},
            format='json',
        )
        response = self.client.get('/api/messages/unread-count/')
        self.assertEqual(response.data['unread_count'], 1)

    def test_bookstore_can_start_a_conversation_with_another_bookstore(self):
        other_store = make_bookstore(
            owner=make_user(email='other-store@example.dz', role='BOOKSTORE_SELLER'),
            name='Autre Librairie',
        )
        seller_client = authenticate(APIClient(), self.store.user)
        response = seller_client.post('/api/messages/conversations/', {
            'bookstore_id': other_store.id,
            'subject': 'Commande groupée',
            'body': 'Bonjour, pouvons-nous échanger ?',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        conversation = Conversation.objects.get(id=response.data['id'])
        self.assertEqual(conversation.buyer_id, self.store.user_id)
        self.assertEqual(conversation.bookstore_id, other_store.id)
