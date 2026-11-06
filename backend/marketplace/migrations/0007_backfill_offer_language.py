from django.db import migrations


def classify_language(value):
    text = (value or '').strip().lower()
    if not text:
        return 'FRENCH'
    if text in {'ar', 'arabic', 'arabe'} or 'العربية' in text or 'عربي' in text:
        return 'ARABIC'
    if text in {'fr', 'french', 'français', 'francais'} or 'fran' in text:
        return 'FRENCH'
    if text in {'en', 'english', 'anglais'} or 'angl' in text:
        return 'ENGLISH'
    if text in {'tamazight', 'amazigh', 'berbère', 'berbere'} or 'berb' in text or 'tamaz' in text:
        return 'TAMAZIGHT'
    return 'OTHER'


def backfill_language(apps, schema_editor):
    Offer = apps.get_model('marketplace', 'Offer')
    Edition = apps.get_model('catalog', 'Edition')
    Work = apps.get_model('catalog', 'Work')

    editions = {
        edition.id: edition.language
        for edition in Edition.objects.all().only('id', 'language')
    }
    work_languages = dict(
        Work.objects.all().only('id', 'original_language').values_list('id', 'original_language')
    )

    for offer in Offer.objects.all().only('id', 'edition_id', 'work_id', 'language'):
        source = editions.get(offer.edition_id) if offer.edition_id else None
        if not source:
            source = work_languages.get(offer.work_id)
        Offer.objects.filter(pk=offer.pk).update(language=classify_language(source))


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0005_seed_expanded_categories'),
        ('marketplace', '0006_offer_language_offer_marketplace_languag_51eaf0_idx'),
    ]

    operations = [
        migrations.RunPython(backfill_language, migrations.RunPython.noop),
    ]
