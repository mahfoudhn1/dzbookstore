from django.conf import settings
from django.db import models


class Conversation(models.Model):
    """Buyer ↔ seller thread, optionally attached to one suborder."""

    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations'
    )
    bookstore = models.ForeignKey(
        'accounts.BookstoreProfile', on_delete=models.CASCADE, null=True, blank=True,
        related_name='conversations',
    )
    individual_seller = models.ForeignKey(
        'accounts.IndividualSellerProfile', on_delete=models.CASCADE, null=True, blank=True,
        related_name='conversations',
    )
    suborder = models.ForeignKey(
        'marketplace.SubOrder', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='conversations',
    )
    subject = models.CharField(max_length=200, blank=True, default='')
    last_message_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_message_at', '-created_at']

    @property
    def seller_user(self):
        if self.bookstore_id:
            return self.bookstore.user
        if self.individual_seller_id:
            return self.individual_seller.user
        return None

    def participants(self):
        people = [self.buyer]
        seller = self.seller_user
        if seller is not None:
            people.append(seller)
        return people

    def is_participant(self, user):
        return user is not None and (
            user.id == self.buyer_id or user.id == getattr(self.seller_user, 'id', None)
        )

    def __str__(self):
        return f'Conversation #{self.id} — {self.buyer.email}'


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages'
    )
    body = models.TextField()
    read_at = models.DateTimeField(blank=True, null=True)
    is_hidden = models.BooleanField(default=False)
    is_reported = models.BooleanField(default=False)
    report_reason = models.TextField(blank=True, null=True)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reported_messages',
    )
    reported_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender.email}: {self.body[:60]}'


class ConversationReport(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='reports')
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversation_reports'
    )
    reason = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Signalement conversation #{self.conversation_id}'
