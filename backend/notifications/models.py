from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        ORDER = 'ORDER', 'Commande'
        MESSAGE = 'MESSAGE', 'Message'
        WISHLIST = 'WISHLIST', 'Liste de souhaits'
        PRICE = 'PRICE', 'Changement de prix'
        LISTING = 'LISTING', 'Annonce'
        MODERATION = 'MODERATION', 'Modération'
        SYSTEM = 'SYSTEM', 'Système'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications'
    )
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.SYSTEM)
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default='')
    data = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(blank=True, null=True)
    email_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'read_at'])]

    @property
    def is_read(self):
        return self.read_at is not None

    def __str__(self):
        return f'{self.user.email}: {self.title}'
