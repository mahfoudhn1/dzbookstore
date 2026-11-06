from django.db import migrations


CATEGORIES = [
    {
        'slug': 'classic-literature',
        'name_fr': 'Littérature classique',
        'name_en': 'Classic Literature',
        'name_ar': 'الأدب الكلاسيكي',
    },
    {
        'slug': 'contemporary-fiction',
        'name_fr': 'Fiction contemporaine',
        'name_en': 'Contemporary Fiction',
        'name_ar': 'الرواية المعاصرة',
    },
    {
        'slug': 'philosophy',
        'name_fr': 'Philosophie',
        'name_en': 'Philosophy',
        'name_ar': 'الفلسفة',
    },
    {
        'slug': 'psychology',
        'name_fr': 'Psychologie',
        'name_en': 'Psychology',
        'name_ar': 'علم النفس',
    },
    {
        'slug': 'history-politics',
        'name_fr': 'Histoire & Politique',
        'name_en': 'History & Politics',
        'name_ar': 'التاريخ والسياسة',
    },
    {
        'slug': 'sociology-thought',
        'name_fr': 'Sociologie & Pensée',
        'name_en': 'Sociology & Thought',
        'name_ar': 'علم الاجتماع والفكر',
    },
    {
        'slug': 'religion-spirituality',
        'name_fr': 'Religion & Spiritualité',
        'name_en': 'Religion & Spirituality',
        'name_ar': 'الدين والروحانية',
    },
    {
        'slug': 'science-medicine',
        'name_fr': 'Sciences & Médecine',
        'name_en': 'Science & Medicine',
        'name_ar': 'العلوم والطب',
    },
    {
        'slug': 'computer-science-tech',
        'name_fr': 'Informatique & Technologie',
        'name_en': 'Computer Science & Tech',
        'name_ar': 'علوم الحاسوب والتقنية',
    },
    {
        'slug': 'business-economics',
        'name_fr': 'Économie & Gestion',
        'name_en': 'Business & Economics',
        'name_ar': 'الأعمال والاقتصاد',
    },
    {
        'slug': 'biography-memoir',
        'name_fr': 'Biographies & Mémoires',
        'name_en': 'Biography & Memoir',
        'name_ar': 'السير والذكريات',
    },
    {
        'slug': 'poetry',
        'name_fr': 'Poésie',
        'name_en': 'Poetry',
        'name_ar': 'الشعر',
    },
    {
        'slug': 'children-ya',
        'name_fr': 'Jeunesse & Young Adult',
        'name_en': 'Children & YA',
        'name_ar': 'الأطفال والناشئة',
    },
    {
        'slug': 'comics-manga',
        'name_fr': 'BD & Manga',
        'name_en': 'Comics & Manga',
        'name_ar': 'القصص المصورة والمانغا',
    },
    {
        'slug': 'university-school',
        'name_fr': 'Manuels scolaires & universitaires',
        'name_en': 'University & School Textbooks',
        'name_ar': 'الكتب المدرسية والجامعية',
    },
    {
        'slug': 'language-learning',
        'name_fr': 'Apprentissage des langues',
        'name_en': 'Language Learning',
        'name_ar': 'تعلم اللغات',
    },
]

EXISTING_ENGLISH_NAMES = {
    'litterature-algerienne': 'Algerian Literature',
    'histoire-et-revolution': 'History & Revolution',
    'pensee-et-philosophie': 'Thought & Philosophy',
    'romans-et-fictions': 'Novels & Fiction',
    'scolaire-universitaire': 'School & University',
}


def seed_categories(apps, schema_editor):
    Category = apps.get_model('catalog', 'Category')
    for slug, name_en in EXISTING_ENGLISH_NAMES.items():
        Category.objects.filter(slug=slug).update(name_en=name_en)
    for entry in CATEGORIES:
        Category.objects.update_or_create(
            slug=entry['slug'],
            defaults={
                'name_fr': entry['name_fr'],
                'name_en': entry['name_en'],
                'name_ar': entry['name_ar'],
            },
        )


def unseed_categories(apps, schema_editor):
    Category = apps.get_model('catalog', 'Category')
    Category.objects.filter(slug__in=[entry['slug'] for entry in CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0004_category_name_en'),
    ]

    operations = [
        migrations.RunPython(seed_categories, unseed_categories),
    ]
