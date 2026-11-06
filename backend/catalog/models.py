from django.db import models
from common.text import normalize


class Genre(models.Model):
    """Fine-grained literary genre, distinct from a marketing category."""

    name_fr = models.CharField(max_length=150)
    name_ar = models.CharField(max_length=150, blank=True, null=True)
    slug = models.SlugField(max_length=170, unique=True)

    class Meta:
        ordering = ['name_fr']

    def __str__(self):
        return self.name_fr


class Language(models.Model):
    code = models.CharField(max_length=10, unique=True)  # ISO 639-1 / 639-3
    name_fr = models.CharField(max_length=80)
    name_ar = models.CharField(max_length=80, blank=True, null=True)
    name_en = models.CharField(max_length=80, blank=True, null=True)

    class Meta:
        ordering = ['name_fr']

    def __str__(self):
        return f'{self.name_fr} ({self.code})'


class Author(models.Model):
    name = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True, null=True)
    slug = models.SlugField(max_length=220, unique=True)
    normalized_name = models.CharField(max_length=220, blank=True, default='', db_index=True)
    biography = models.TextField(blank=True, null=True)
    nationality = models.CharField(max_length=100, default='Algérienne')
    photo_url = models.URLField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def save(self, *args, **kwargs):
        self.normalized_name = normalize(f'{self.name} {self.name_ar or ""}')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Publisher(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    country = models.CharField(max_length=100, default='Algérie')
    logo_url = models.URLField(max_length=500, blank=True, null=True)
    website = models.URLField(max_length=300, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Category(models.Model):
    name_fr = models.CharField(max_length=150)
    name_ar = models.CharField(max_length=150)
    name_en = models.CharField(max_length=150, blank=True, default='')
    slug = models.SlugField(max_length=170, unique=True)
    icon = models.CharField(max_length=50, blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name_fr']

    def __str__(self):
        return f"{self.name_fr} ({self.name_ar})"

class Work(models.Model):
    """A literary work, independent of any particular edition.

    ``The Brothers Karamazov`` is one Work; its English, French, Arabic and
    Russian printings are separate Editions attached to it.
    """

    title = models.CharField(max_length=300)
    original_title = models.CharField(max_length=300, blank=True, null=True)
    slug = models.SlugField(max_length=320, unique=True)
    normalized_title = models.CharField(max_length=320, blank=True, default='', db_index=True)
    synopsis = models.TextField()
    original_language = models.CharField(max_length=10, default='fr')
    original_language_ref = models.ForeignKey(
        Language, on_delete=models.SET_NULL, null=True, blank=True, related_name='original_works'
    )
    cover_image = models.URLField(max_length=500, blank=True, null=True)
    featured = models.BooleanField(default=False)
    authors = models.ManyToManyField(Author, through='WorkContributor', related_name='works')
    categories = models.ManyToManyField(Category, related_name='works')
    genres = models.ManyToManyField(Genre, blank=True, related_name='works')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['title']

    def save(self, *args, **kwargs):
        self.normalized_title = normalize(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class ContributorRole(models.TextChoices):
    AUTHOR = 'AUTHOR', 'Auteur'
    CO_AUTHOR = 'CO_AUTHOR', 'Co-auteur'
    TRANSLATOR = 'TRANSLATOR', 'Traducteur'
    EDITOR = 'EDITOR', 'Éditeur scientifique'
    ILLUSTRATOR = 'ILLUSTRATOR', 'Illustrateur'
    NARRATOR = 'NARRATOR', 'Narrateur'
    PREFACE = 'PREFACE', 'Préfacier'


class WorkContributor(models.Model):
    work = models.ForeignKey(Work, on_delete=models.CASCADE, related_name='contributions')
    author = models.ForeignKey(Author, on_delete=models.CASCADE, related_name='work_contributions')
    role = models.CharField(max_length=20, choices=ContributorRole.choices, default=ContributorRole.AUTHOR)
    ordering = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['ordering', 'id']
        unique_together = ('work', 'author', 'role')

    def __str__(self):
        return f'{self.author.name} ({self.get_role_display()}) — {self.work.title}'


class EditionContributor(models.Model):
    """A translator or illustrator attached to one specific edition."""

    edition = models.ForeignKey('Edition', on_delete=models.CASCADE, related_name='contributions')
    author = models.ForeignKey(Author, on_delete=models.CASCADE, related_name='edition_contributions')
    role = models.CharField(max_length=20, choices=ContributorRole.choices, default=ContributorRole.TRANSLATOR)

    class Meta:
        unique_together = ('edition', 'author', 'role')

    def __str__(self):
        return f'{self.author.name} ({self.get_role_display()}) — {self.edition}'

class Edition(models.Model):
    work = models.ForeignKey(Work, on_delete=models.CASCADE, related_name='editions')
    isbn10 = models.CharField(max_length=20, blank=True, null=True, db_index=True)
    isbn13 = models.CharField(max_length=30, blank=True, null=True, unique=True)
    publisher = models.ForeignKey(Publisher, on_delete=models.SET_NULL, null=True, blank=True, related_name='editions')
    publication_year = models.IntegerField(blank=True, null=True)
    publication_date = models.DateField(blank=True, null=True)
    edition_title = models.CharField(max_length=200, blank=True, null=True)
    format = models.CharField(max_length=80, default='Poche')  # Poche, Broché, Relié, etc.
    language = models.CharField(max_length=50, default='Français')
    language_ref = models.ForeignKey(
        Language, on_delete=models.SET_NULL, null=True, blank=True, related_name='editions'
    )
    page_count = models.IntegerField(blank=True, null=True)
    cover_image = models.URLField(max_length=500, blank=True, null=True)
    translators = models.ManyToManyField(
        Author, blank=True, through='EditionContributor', related_name='translated_editions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['work', 'publisher', 'language']),
        ]

    def __str__(self):
        pub = self.publisher.name if self.publisher else "Inconnu"
        return f"{self.work.title} - {pub} ({self.publication_year or 'N/A'}) [{self.language}]"
