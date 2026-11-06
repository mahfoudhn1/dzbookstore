"""Test factories shared by the app test suites (not used at runtime)."""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token

from accounts.models import BookstoreProfile, IndividualSellerProfile
from catalog.models import Edition, Work
from catalog.services import create_edition, create_work
from geo.models import Commune, Wilaya
from marketplace.models import Offer

User = get_user_model()


def make_geo():
    wilaya, _ = Wilaya.objects.get_or_create(
        id=16, defaults={'code': '16', 'name_fr': 'Alger', 'name_ar': 'الجزائر'}
    )
    commune, _ = Commune.objects.get_or_create(
        wilaya=wilaya, name_fr='Alger Centre',
        defaults={'name_ar': 'الجزائر الوسطى', 'postal_code': '16000'},
    )
    return wilaya, commune


def make_user(email='buyer@example.dz', role=User.Role.BUYER, password='secret1234', **extra):
    wilaya = extra.pop('wilaya', None) or make_geo()[0]
    user = User.objects.create(
        email=email,
        username=email.split('@')[0],
        role=role,
        wilaya=wilaya,
        first_name=extra.pop('first_name', 'Test'),
        **extra,
    )
    user.set_password(password)
    user.save()
    return user


def make_bookstore(owner=None, name='Librairie Test', **overrides):
    wilaya, commune = make_geo()
    owner = owner or make_user(email='store@example.dz', role=User.Role.BOOKSTORE_SELLER)
    defaults = {
        'store_name': name,
        'slug': name.lower().replace(' ', '-'),
        'address': '1 Rue des Livres',
        'wilaya': wilaya,
        'commune': commune,
        'phone': '0550000000',
        'is_verified': True,
        'verification_status': BookstoreProfile.VerificationStatus.VERIFIED,
        'latitude': 36.7538,
        'longitude': 3.0588,
    }
    defaults.update(overrides)
    store = BookstoreProfile.objects.create(user=owner, **defaults)
    return store


def make_individual_seller(owner=None, name='Vendeur Test', **overrides):
    wilaya, commune = make_geo()
    owner = owner or make_user(email='seller@example.dz', role=User.Role.INDIVIDUAL_SELLER)
    defaults = {
        'display_name': name,
        'wilaya': wilaya,
        'commune': commune,
        'phone': '0660000000',
    }
    defaults.update(overrides)
    return IndividualSellerProfile.objects.create(user=owner, **defaults)


def make_work(title='Nedjma', author_names=('Kateb Yacine',), **overrides):
    work, _ = create_work(title=title, synopsis=overrides.pop('synopsis', 'Roman.'), author_names=list(author_names), **overrides)
    return work


def make_edition(work, isbn13='9789961892813', **overrides):
    edition, _ = create_edition(work=work, isbn13=isbn13, **overrides)
    return edition


def make_offer(*, work=None, store=None, seller=None, price=1000.0, stock_quantity=3, **overrides):
    work = work or make_work()
    if store is None and seller is None:
        store = make_bookstore()
    defaults = {
        'work': work,
        'seller_type': Offer.SellerType.BOOKSTORE if store else Offer.SellerType.INDIVIDUAL,
        'bookstore': store,
        'individual_seller': seller,
        'price': price,
        'stock_quantity': stock_quantity,
        'condition': Offer.Condition.NEW,
        'status': Offer.Status.ACTIVE,
        'has_store_pickup': store is not None,
        'has_home_delivery': True,
        'has_stop_desk_delivery': True,
        'home_delivery_fee': 500.0,
        'stop_desk_fee': 300.0,
        'last_availability_confirmed_at': timezone.now(),
    }
    defaults.update(overrides)
    return Offer.objects.create(**defaults)


def token_for(user):
    return Token.objects.get_or_create(user=user)[0].key


def authenticate(client, user):
    client.credentials(HTTP_AUTHORIZATION=f'Token {token_for(user)}')
    return client
