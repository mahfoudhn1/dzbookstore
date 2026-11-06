from django.contrib import admin
from .models import Wilaya, Commune

@admin.register(Wilaya)
class WilayaAdmin(admin.ModelAdmin):
    list_display = ('id', 'code', 'name_fr', 'name_ar')
    search_fields = ('code', 'name_fr', 'name_ar')

@admin.register(Commune)
class CommuneAdmin(admin.ModelAdmin):
    list_display = ('name_fr', 'name_ar', 'wilaya', 'postal_code')
    list_filter = ('wilaya',)
    search_fields = ('name_fr', 'name_ar')
