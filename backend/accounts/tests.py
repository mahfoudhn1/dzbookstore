from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import AuthActionToken, BookstoreProfile, User
from common.testing import authenticate, make_bookstore, make_geo, make_user


@override_settings(
    ALLOW_ANONYMOUS_DEMO=True,
    SEND_NOTIFICATION_EMAILS=False,
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class AuthenticationTests(TestCase):
    def setUp(self):
        make_geo()
        self.client = APIClient()

    def test_register_creates_unverified_account_and_verification_token(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'lecteur@example.dz',
            'password': 'motdepasse123',
            'name': 'Amine',
            'role': User.Role.BUYER,
            'wilaya_id': None,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email='lecteur@example.dz')
        self.assertFalse(user.email_verified)
        self.assertIn('token', response.data)
        self.assertIn('verification_token', response.data)
        self.assertTrue(
            AuthActionToken.objects.filter(
                user=user, purpose=AuthActionToken.Purpose.EMAIL_VERIFICATION
            ).exists()
        )

    def test_register_bookstore_creates_profile_with_unique_slug(self):
        payload = {
            'email': 'librairie@example.dz',
            'password': 'motdepasse123',
            'name': 'Nadia',
            'role': User.Role.BOOKSTORE_SELLER,
            'store_name': 'Librairie El Feth',
            'wilaya_id': 16,
        }
        first = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(first.status_code, 201)
        payload['email'] = 'librairie2@example.dz'
        second = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(second.status_code, 201)

        slugs = list(BookstoreProfile.objects.values_list('slug', flat=True))
        self.assertEqual(len(slugs), len(set(slugs)))

    def test_short_password_is_rejected(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'court@example.dz', 'password': 'abc',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_login_rejects_wrong_password_and_returns_token(self):
        make_user(email='login@example.dz', password='secret1234')

        wrong = self.client.post('/api/auth/login/', {
            'email': 'login@example.dz', 'password': 'wrong-password',
        }, format='json')
        self.assertEqual(wrong.status_code, 401)

        ok = self.client.post('/api/auth/login/', {
            'email': 'login@example.dz', 'password': 'secret1234',
        }, format='json')
        self.assertEqual(ok.status_code, 200)
        self.assertIn('token', ok.data)

    def test_suspended_account_cannot_login(self):
        make_user(email='suspendu@example.dz', password='secret1234', is_suspended=True)
        response = self.client.post('/api/auth/login/', {
            'email': 'suspendu@example.dz', 'password': 'secret1234',
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_email_verification_consumes_token(self):
        user = make_user(email='verif@example.dz')
        action = AuthActionToken.issue(user, AuthActionToken.Purpose.EMAIL_VERIFICATION)

        response = self.client.post('/api/auth/verify-email/', {'token': action.token}, format='json')
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

        replay = self.client.post('/api/auth/verify-email/', {'token': action.token}, format='json')
        self.assertEqual(replay.status_code, 400)

    def test_password_reset_changes_password_and_revokes_tokens(self):
        user = make_user(email='reset@example.dz', password='secret1234')
        token_key = authenticate(self.client, user)
        self.assertIsNotNone(token_key)

        request = self.client.post('/api/auth/password-reset/request/', {
            'email': 'reset@example.dz',
        }, format='json')
        self.assertEqual(request.status_code, 200)
        reset_token = request.data['reset_token']

        confirm = self.client.post('/api/auth/password-reset/confirm/', {
            'token': reset_token, 'new_password': 'nouveaumotdepasse',
        }, format='json')
        self.assertEqual(confirm.status_code, 200)

        self.assertEqual(
            self.client.post('/api/auth/login/', {
                'email': 'reset@example.dz', 'password': 'secret1234',
            }, format='json').status_code,
            401,
        )
        self.assertEqual(
            self.client.post('/api/auth/login/', {
                'email': 'reset@example.dz', 'password': 'nouveaumotdepasse',
            }, format='json').status_code,
            200,
        )

    def test_logout_revokes_the_current_token(self):
        user = make_user(email='logout@example.dz')
        authenticate(self.client, user)
        response = self.client.post('/api/auth/logout/')
        self.assertEqual(response.status_code, 200)

        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.status_code, 401)

    def test_expired_action_token_is_rejected(self):
        user = make_user(email='expire@example.dz')
        action = AuthActionToken.issue(user, AuthActionToken.Purpose.PASSWORD_RESET)
        AuthActionToken.objects.filter(id=action.id).update(
            expires_at=action.expires_at.replace(year=2000)
        )
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'token': action.token, 'new_password': 'motdepasse123',
        }, format='json')
        self.assertEqual(response.status_code, 400)


@override_settings(ALLOW_ANONYMOUS_DEMO=False, SEND_NOTIFICATION_EMAILS=False)
class LibraryProfileApiTests(TestCase):
    def setUp(self):
        make_geo()
        self.client = APIClient()
        self.reader = make_user(email='future-librairie@example.dz')

    def test_reader_can_open_a_library_profile(self):
        authenticate(self.client, self.reader)
        response = self.client.post('/api/libraries/me/', {
            'store_name': 'Librairie El Amel',
            'address': '12 Rue Didouche Mourad',
            'wilaya_id': 16,
            'phone': '0550112233',
            'description': 'Livres en arabe et en français.',
            'logo_url': 'https://example.dz/logo.png',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'librairie-el-amel')
        self.assertEqual(response.data['logo_url'], 'https://example.dz/logo.png')

        self.reader.refresh_from_db()
        self.assertEqual(self.reader.role, User.Role.BOOKSTORE_SELLER)
        self.assertEqual(self.reader.library.store_name, 'Librairie El Amel')

    def test_library_profile_is_readable_and_editable(self):
        store = make_bookstore(
            owner=self.reader, name='Librairie El Amel', slug='librairie-el-amel'
        )
        authenticate(self.client, self.reader)

        current = self.client.get('/api/libraries/me/')
        self.assertEqual(current.status_code, 200)
        self.assertEqual(current.data['id'], store.id)

        updated = self.client.patch('/api/libraries/me/', {
            'store_name': 'Librairie El Amel & Fils',
            'phone': '0661445566',
            'address': '5 Place des Martyrs',
        }, format='json')
        self.assertEqual(updated.status_code, 200)
        store.refresh_from_db()
        self.assertEqual(store.store_name, 'Librairie El Amel & Fils')
        self.assertEqual(store.phone, '0661445566')

    def test_opening_a_second_library_is_rejected(self):
        make_bookstore(owner=self.reader, name='Premiere', slug='premiere')
        authenticate(self.client, self.reader)
        response = self.client.post('/api/libraries/me/', {
            'store_name': 'Deuxieme',
        }, format='json')
        self.assertEqual(response.status_code, 409)

    def test_library_profile_requires_authentication(self):
        self.assertEqual(self.client.get('/api/libraries/me/').status_code, 401)

    def test_public_library_directory_and_detail_by_id_or_slug(self):
        store = make_bookstore(name='Librairie Publique')

        listing = self.client.get('/api/libraries/')
        self.assertEqual(listing.status_code, 200)
        results = listing.data.get('results', listing.data)
        self.assertIn(store.slug, [row['slug'] for row in results])

        by_slug = self.client.get(f'/api/libraries/{store.slug}/')
        by_id = self.client.get(f'/api/libraries/{store.id}/')
        self.assertEqual(by_slug.status_code, 200)
        self.assertEqual(by_id.status_code, 200)
        self.assertEqual(by_slug.data['id'], store.id)
        self.assertEqual(by_id.data['id'], store.id)

    def test_suspended_library_is_hidden_from_the_directory(self):
        store = make_bookstore(name='Librairie Suspendue')
        store.user.is_suspended = True
        store.user.save(update_fields=['is_suspended'])

        listing = self.client.get('/api/libraries/')
        results = listing.data.get('results', listing.data)
        self.assertNotIn(store.id, [row['id'] for row in results])
