"""Preserve existing work↔author links when moving to the contributor model."""
from django.db import migrations


def forwards(apps, schema_editor):
    Work = apps.get_model('catalog', 'Work')
    Author = apps.get_model('catalog', 'Author')
    WorkContributor = apps.get_model('catalog', 'WorkContributor')
    connection = schema_editor.connection

    tables = connection.introspection.table_names()
    if 'catalog_work_authors' in tables:
        with connection.cursor() as cursor:
            cursor.execute('SELECT work_id, author_id, id FROM catalog_work_authors ORDER BY id')
            rows = cursor.fetchall()
        for work_id, author_id, _row_id in rows:
            WorkContributor.objects.get_or_create(
                work_id=work_id,
                author_id=author_id,
                role='AUTHOR',
            )

    # Populate the folded search columns that were added in this release.
    from common.text import normalize

    for work in Work.objects.all().iterator():
        normalized = normalize(work.title)
        if work.normalized_title != normalized:
            Work.objects.filter(pk=work.pk).update(normalized_title=normalized)

    for author in Author.objects.all().iterator():
        normalized = normalize(f'{author.name} {author.name_ar or ""}')
        if author.normalized_name != normalized:
            Author.objects.filter(pk=author.pk).update(normalized_name=normalized)


def backwards(apps, schema_editor):
    # The old implicit table is restored by the previous migration's state, but
    # its rows are not re-created; the contributor rows remain the source of
    # truth.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0002_genre_language_workcontributor_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.RunSQL(
            'DROP TABLE IF EXISTS catalog_work_authors CASCADE;',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
