import secrets
from datetime import timedelta

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from geo.models import Wilaya, Commune

class User(AbstractUser):
    class Role(models.TextChoices):
        BUYER = 'BUYER', 'Acheteur (Buyer)'
        BOOKSTORE_SELLER = 'BOOKSTORE_SELLER', 'Librairie Professionnelle (Bookstore)'
        INDIVIDUAL_SELLER = 'INDIVIDUAL_SELLER', 'Vendeur Particulier (Individual Seller)'
        ADMIN = 'ADMIN', 'Administrateur'

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.BUYER)
    phone = models.CharField(max_length=20, blank=True, null=True)
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    address = models.CharField(max_length=300, blank=True, null=True)
    wilaya = models.ForeignKey(Wilaya, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    commune = models.ForeignKey(Commune, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    is_suspended = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"

    @property
    def is_buyer(self):
        return self.role == self.Role.BUYER

    @property
    def is_bookstore(self):
        return self.role == self.Role.BOOKSTORE_SELLER

    @property
    def is_individual_seller(self):
        return self.role == self.Role.INDIVIDUAL_SELLER

    @property
    def is_admin_user(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def library(self):
        """The user's library/bookstore profile, or ``None``.

        A user without a library profile is a second-hand seller: their
        listings are attached to an individual profile instead.
        """
        return getattr(self, 'bookstore_profile', None)

    @property
    def has_library(self):
        return self.library is not None

    @property
    def account_status(self):
        if self.is_suspended or not self.is_active:
            return 'SUSPENDED'
        return 'ACTIVE'


class AuthActionToken(models.Model):
    """Single-use token for email verification and password recovery.

    The Django auth token is used for API sessions; these short-lived tokens
    are only for the two account flows and are stored hashed-by-usage (opaque
    random strings) with a strict expiry.
    """

    class Purpose(models.TextChoices):
        EMAIL_VERIFICATION = 'EMAIL_VERIFICATION', 'Vérification email'
        PASSWORD_RESET = 'PASSWORD_RESET', 'Réinitialisation du mot de passe'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='auth_action_tokens')
    purpose = models.CharField(max_length=30, choices=Purpose.choices)
    token = models.CharField(max_length=80, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_valid(self):
        return self.used_at is None and timezone.now() < self.expires_at

    @classmethod
    def issue(cls, user, purpose, ttl=timedelta(hours=24)):
        # Invalidate previous outstanding tokens for the same purpose so an old
        # email cannot be replayed after a new one was requested.
        cls.objects.filter(user=user, purpose=purpose, used_at__isnull=True).update(
            used_at=timezone.now()
        )
        return cls.objects.create(
            user=user,
            purpose=purpose,
            token=secrets.token_urlsafe(32),
            expires_at=timezone.now() + ttl,
        )

    def consume(self):
        self.used_at = timezone.now()
        self.save(update_fields=['used_at'])

    def __str__(self):
        return f"{self.purpose} · {self.user.email}"

class BookstoreProfile(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = 'PENDING', 'En attente'
        VERIFIED = 'VERIFIED', 'Vérifié'
        REJECTED = 'REJECTED', 'Refusé'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='bookstore_profile')
    store_name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    description = models.TextField(blank=True, null=True)
    address = models.CharField(max_length=300)
    wilaya = models.ForeignKey(Wilaya, on_delete=models.PROTECT, related_name='bookstores')
    commune = models.ForeignKey(Commune, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookstores')
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    phone = models.CharField(max_length=30)
    whatsapp = models.CharField(max_length=30, blank=True, null=True)
    contact_email = models.EmailField(blank=True, null=True)
    opening_hours = models.CharField(max_length=250, default="Samedi - Jeudi: 09h00 - 19h00")
    logo_url = models.URLField(max_length=500, blank=True, null=True)
    banner_url = models.URLField(max_length=500, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING
    )
    verification_document_url = models.URLField(max_length=500, blank=True, null=True)
    verification_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.store_name} ({self.wilaya.name_fr})"

class IndividualSellerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='individual_profile')
    display_name = models.CharField(max_length=150)
    bio = models.TextField(blank=True, null=True)
    wilaya = models.ForeignKey(Wilaya, on_delete=models.PROTECT, related_name='individual_sellers')
    commune = models.ForeignKey(Commune, on_delete=models.SET_NULL, null=True, blank=True, related_name='individual_sellers')
    phone = models.CharField(max_length=30)
    whatsapp = models.CharField(max_length=30, blank=True, null=True)
    # Precise coordinates are private by default.  When the seller opts in they
    # are used for distance sorting; otherwise only the wilaya/commune is
    # published and no precise home location is ever exposed.
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    show_exact_location = models.BooleanField(default=False)
    trust_score = models.FloatField(default=5.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.display_name} ({self.wilaya.name_fr})"
