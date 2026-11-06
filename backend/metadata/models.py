from django.db import models
from django.utils import timezone


class ProviderCache(models.Model):
    """Cached provider response, so repeated searches never hit rate limits."""

    provider = models.CharField(max_length=40)
    cache_key = models.CharField(max_length=300)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        unique_together = ('provider', 'cache_key')
        ordering = ['-created_at']

    @classmethod
    def get_fresh(cls, provider, cache_key):
        entry = cls.objects.filter(
            provider=provider, cache_key=cache_key, expires_at__gt=timezone.now()
        ).first()
        return entry.payload if entry else None

    @classmethod
    def store(cls, provider, cache_key, payload, ttl_seconds=86400):
        entry, _ = cls.objects.update_or_create(
            provider=provider,
            cache_key=cache_key,
            defaults={
                'payload': payload,
                'expires_at': timezone.now() + timezone.timedelta(seconds=ttl_seconds),
            },
        )
        return entry

    def __str__(self):
        return f'{self.provider}:{self.cache_key}'


class ExternalIdentifier(models.Model):
    """Attribution and provenance for imported metadata.

    Keeping the provider + provider identifier lets the catalog re-link to the
    original record later, respect attribution requirements, and avoid
    importing the same edition twice under different provider ids.
    """

    provider = models.CharField(max_length=40)
    identifier = models.CharField(max_length=120)
    work = models.ForeignKey(
        'catalog.Work', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='external_identifiers',
    )
    edition = models.ForeignKey(
        'catalog.Edition', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='external_identifiers',
    )
    source_url = models.URLField(max_length=600, blank=True, null=True)
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('provider', 'identifier')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.provider}:{self.identifier}'


class SearchLog(models.Model):
    """Aggregated search telemetry for the analytics module."""

    user = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='search_logs',
    )
    query = models.CharField(max_length=300, blank=True, default='')
    normalized_query = models.CharField(max_length=300, blank=True, default='', db_index=True)
    result_count = models.PositiveIntegerField(default=0)
    had_typo_fallback = models.BooleanField(default=False)
    filters = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.normalized_query or '(filtres)'
