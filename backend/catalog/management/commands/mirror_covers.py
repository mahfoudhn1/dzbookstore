"""Download remote Work/Edition covers into MEDIA_ROOT/covers."""
from django.core.management.base import BaseCommand

from catalog.images import is_local_cover, mirror_cover_image
from catalog.models import Edition, Work


def _remote_covers(queryset):
    return queryset.exclude(cover_image__isnull=True).exclude(cover_image='')


class Command(BaseCommand):
    help = (
        'Mirror provider cover URLs into local media storage so they keep '
        'loading when the metadata provider is unavailable.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report what would be downloaded without writing anything.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Maximum number of rows to process per model (0 = all).',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        limit = options['limit']

        works = _remote_covers(Work.objects.all()).order_by('pk')
        editions = _remote_covers(Edition.objects.all()).order_by('pk')
        if limit:
            works = works[:limit]
            editions = editions[:limit]

        cache = {}
        updated = 0
        failed = 0
        skipped = 0

        for label, queryset in (('Œuvre', works), ('Édition', editions)):
            for obj in queryset.iterator():
                url = (obj.cover_image or '').strip()
                if not url or is_local_cover(url) or not url.lower().startswith(
                    ('http://', 'https://')
                ):
                    skipped += 1
                    continue

                if dry_run:
                    updated += 1
                    self.stdout.write(f'{label} #{obj.pk} : {url} (à copier)')
                    continue

                if url in cache:
                    local_url = cache[url]
                else:
                    local_url = mirror_cover_image(url)
                    cache[url] = local_url

                if local_url == url:
                    failed += 1
                    self.stderr.write(
                        self.style.WARNING(f'{label} #{obj.pk} : {url} (non copiée)')
                    )
                    continue

                obj.cover_image = local_url
                obj.save(update_fields=['cover_image'])
                updated += 1
                self.stdout.write(f'{label} #{obj.pk} : {local_url}')

        verb = 'à copier' if dry_run else 'copiée(s)'
        self.stdout.write(
            self.style.SUCCESS(
                f'{updated} image(s) {verb}, {failed} échec(s), {skipped} ignorée(s).'
            )
        )
