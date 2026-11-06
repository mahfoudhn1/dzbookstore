from django.utils.text import slugify
from django.db import transaction
from django.db.models import Q
import re

from .images import mirror_cover_image
from .models import (
    Author, Category, ContributorRole, Edition, EditionContributor, Genre,
    Language, Publisher, Work, WorkContributor,
)
from common.text import isbn_digits, normalize


def unique_slug(model, value, fallback='item', max_length=300):
    base = slugify(value)[: max_length - 8] or fallback
    slug = base
    index = 1
    while model.objects.filter(slug=slug).exists():
        index += 1
        slug = f'{base}-{index}'[:max_length]
    return slug


def find_or_create_author(name, name_ar=None):
    name = (name or '').strip()
    if not name:
        return None
    normalized = normalize(name)
    exists = Author.objects.filter(normalized_name=normalized).first()
    if exists:
        return exists
    slug_base = slugify(name) or 'auteur'
    return Author.objects.create(
        name=name,
        name_ar=name_ar,
        slug=unique_slug(Author, name, 'auteur', 220),
    )


def find_or_create_publisher(name):
    name = (name or '').strip()
    if not name:
        return None
    exists = Publisher.objects.filter(name__iexact=name).first()
    if exists:
        return exists
    return Publisher.objects.create(name=name, slug=unique_slug(Publisher, name, 'editeur', 220))


LANGUAGE_ALIASES = {
    # ISO 639-1
    'fr': ('fr', 'Français', 'French'),
    'ar': ('ar', 'Arabe', 'Arabic'),
    'en': ('en', 'Anglais', 'English'),
    # ISO 639-2/B and 639-2/T codes returned by Open Library / Google Books
    'fre': ('fr', 'Français', 'French'),
    'fra': ('fr', 'Français', 'French'),
    'ara': ('ar', 'Arabe', 'Arabic'),
    'eng': ('en', 'Anglais', 'English'),
    # Names and endonyms
    'français': ('fr', 'Français', 'French'),
    'francais': ('fr', 'Français', 'French'),
    'french': ('fr', 'Français', 'French'),
    'arabe': ('ar', 'Arabe', 'Arabic'),
    'arabic': ('ar', 'Arabe', 'Arabic'),
    'العربية': ('ar', 'Arabe', 'Arabic'),
    'anglais': ('en', 'Anglais', 'English'),
    'english': ('en', 'Anglais', 'English'),
    'ber': ('ber', 'Tamazight', 'Tamazight'),
    'tam': ('ber', 'Tamazight', 'Tamazight'),
    'tamazight': ('ber', 'Tamazight', 'Tamazight'),
    'kab': ('kab', 'Kabyle', 'Kabyle'),
    'kabyle': ('kab', 'Kabyle', 'Kabyle'),
    'und': ('und', 'Indéterminé', 'Undetermined'),
}


def find_or_create_language(name_or_code):
    value = (name_or_code or '').strip()
    if not value:
        return None

    language = Language.objects.filter(
        Q(code__iexact=value) | Q(name_fr__iexact=value) | Q(name_en__iexact=value)
    ).first()
    if language:
        return language

    code, name_fr, name_en = LANGUAGE_ALIASES.get(
        value.lower(),
        (slugify(value)[:10].lower() or 'und', value, value),
    )
    language = Language.objects.filter(code__iexact=code).first()
    if language:
        return language
    return Language.objects.create(
        code=code,
        name_fr=name_fr,
        name_en=name_en,
        name_ar=value if re.search(r'[\u0600-\u06FF]', value) else None,
    )


def _same_author_set(work, author_names):
    if not author_names:
        return True
    wanted = {normalize(name) for name in author_names if name}
    existing = {normalize(author.name) for author in work.authors.all()}
    return bool(wanted & existing)


def find_work(title, author_names=None):
    """Locate a work by folded title + at least one matching contributor.

    Title-only equality is not enough in a bookstore: many different works
    share a title ("Nedjma" translations, "Poèmes", etc.).  Requiring an
    author overlap prevents collapsing distinct books into one record.
    """
    normalized_title = normalize(title)
    if not normalized_title:
        return None
    candidates = Work.objects.filter(normalized_title=normalized_title).prefetch_related('authors')
    for candidate in candidates:
        if _same_author_set(candidate, author_names):
            return candidate
    return None


@transaction.atomic
def create_work(
    *,
    title,
    synopsis='',
    original_title=None,
    original_language='fr',
    cover_image=None,
    featured=False,
    author_names=None,
    category_slugs=None,
    genre_slugs=None,
    language_code=None,
):
    title = (title or '').strip()
    if not title:
        raise ValueError('Le titre est obligatoire.')
    cover_image = mirror_cover_image(cover_image)
    author_names = [name for name in (author_names or []) if name]
    work = find_work(title, author_names)
    created = work is None
    if work is None:
        language = find_or_create_language(language_code or original_language)
        work = Work.objects.create(
            title=title,
            original_title=original_title or None,
            slug=unique_slug(Work, title, 'ouvrage', 320),
            synopsis=synopsis or '',
            original_language=(language.code if language else 'fr'),
            original_language_ref=language,
            cover_image=cover_image or None,
            featured=featured,
        )

    for index, name in enumerate(author_names):
        author = find_or_create_author(name)
        if author:
            WorkContributor.objects.get_or_create(
                work=work,
                author=author,
                role=ContributorRole.AUTHOR,
                defaults={'ordering': index},
            )

    for slug in category_slugs or []:
        category = Category.objects.filter(slug=slug).first()
        if category:
            work.categories.add(category)
    for slug in genre_slugs or []:
        genre = Genre.objects.filter(slug=slug).first()
        if genre:
            work.genres.add(genre)

    return work, created


def find_edition(*, work, isbn13=None, isbn10=None, publisher=None, language=None,
                 publication_year=None, format=None):
    isbn13 = isbn_digits(isbn13) or None
    isbn10 = isbn_digits(isbn10) or None
    if isbn13:
        existing = Edition.objects.filter(isbn13=isbn13).first()
        if existing:
            return existing
    if isbn10:
        existing = Edition.objects.filter(isbn10=isbn10).first()
        if existing:
            return existing

    candidates = Edition.objects.filter(work=work)
    if publisher is not None:
        candidates = candidates.filter(publisher=publisher)
    if language:
        candidates = candidates.filter(language__iexact=language)
    if publication_year:
        candidates = candidates.filter(publication_year=publication_year)
    if format:
        candidates = candidates.filter(format__iexact=format)
    if publisher is not None or (language and publication_year):
        existing = candidates.first()
        if existing:
            return existing
    return None


@transaction.atomic
def create_edition(
    *,
    work,
    isbn13=None,
    isbn10=None,
    publisher_name=None,
    publication_year=None,
    publication_date=None,
    edition_title=None,
    format='Poche',
    language='Français',
    page_count=None,
    cover_image=None,
    translator_names=None,
):
    isbn13 = isbn_digits(isbn13) or None
    isbn10 = isbn_digits(isbn10) or None
    cover_image = mirror_cover_image(cover_image)

    if isbn13:
        existing = Edition.objects.filter(isbn13=isbn13).first()
        if existing:
            return existing, False

    publisher = find_or_create_publisher(publisher_name) if publisher_name else None
    language_ref = find_or_create_language(language)
    existing = find_edition(
        work=work,
        isbn13=isbn13,
        isbn10=isbn10,
        publisher=publisher,
        language=language,
        publication_year=publication_year,
        format=format,
    )
    if existing is not None:
        # A second-provider result without ISBN can complete an existing
        # edition's metadata instead of creating a duplicate row.
        changed = False
        for field, value in (
            ('cover_image', cover_image),
            ('page_count', page_count),
            ('publisher', publisher),
            ('language_ref', language_ref),
        ):
            if value and not getattr(existing, field):
                setattr(existing, field, value)
                changed = True
        if changed:
            existing.save()
        return existing, False

    edition = Edition.objects.create(
        work=work,
        isbn13=isbn13,
        isbn10=isbn10,
        publisher=publisher,
        publication_year=publication_year,
        publication_date=publication_date,
        edition_title=edition_title,
        format=format or 'Poche',
        language=language or 'Français',
        language_ref=language_ref,
        page_count=page_count,
        cover_image=cover_image,
    )
    for name in translator_names or []:
        author = find_or_create_author(name)
        if author:
            EditionContributor.objects.get_or_create(
                edition=edition, author=author, role=ContributorRole.TRANSLATOR
            )
    return edition, True


def lookup_isbn_metadata(isbn):
    """Backwards-compatible entry point used by the existing seller form.

    The real provider abstraction (caching, rate limits, attribution, provider
    failures) lives in the ``metadata`` app; importing it lazily avoids a
    circular import at startup.
    """
    from metadata.services import lookup_isbn

    return lookup_isbn(isbn)
