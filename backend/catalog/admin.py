from django.contrib import admin
from .models import (
    Author, Publisher, Category, Work, Edition, Genre, Language,
    WorkContributor, EditionContributor,
)

@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ('name', 'nationality')
    search_fields = ('name', 'name_ar')

@admin.register(Publisher)
class PublisherAdmin(admin.ModelAdmin):
    list_display = ('name', 'country')
    search_fields = ('name',)

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name_fr', 'name_ar', 'parent')
    search_fields = ('name_fr', 'name_ar')

class EditionInline(admin.TabularInline):
    model = Edition
    extra = 1

@admin.register(Work)
class WorkAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'original_language', 'featured')
    list_display_links = ('id', 'title')
    list_editable = ('featured',)
    list_filter = ('featured', 'original_language')
    search_fields = ('title', 'synopsis')
    inlines = [EditionInline]

@admin.register(Edition)
class EditionAdmin(admin.ModelAdmin):
    list_display = ('work', 'publisher', 'isbn13', 'format', 'language', 'publication_year')
    list_filter = ('format', 'language', 'publisher')
    search_fields = ('work__title', 'isbn13', 'isbn10')


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    list_display = ('name_fr', 'name_ar', 'slug')
    search_fields = ('name_fr', 'name_ar')


@admin.register(Language)
class LanguageAdmin(admin.ModelAdmin):
    list_display = ('code', 'name_fr', 'name_ar', 'name_en')
    search_fields = ('code', 'name_fr', 'name_ar')


@admin.register(WorkContributor)
class WorkContributorAdmin(admin.ModelAdmin):
    list_display = ('work', 'author', 'role', 'ordering')
    list_filter = ('role',)


@admin.register(EditionContributor)
class EditionContributorAdmin(admin.ModelAdmin):
    list_display = ('edition', 'author', 'role')
    list_filter = ('role',)
