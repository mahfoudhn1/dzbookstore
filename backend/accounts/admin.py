from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, BookstoreProfile, IndividualSellerProfile

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'username', 'role', 'wilaya', 'is_staff')
    list_filter = ('role', 'wilaya', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('Profil Algérie', {'fields': ('role', 'phone', 'avatar_url', 'wilaya', 'commune')}),
    )

@admin.register(BookstoreProfile)
class BookstoreProfileAdmin(admin.ModelAdmin):
    list_display = ('store_name', 'wilaya', 'phone', 'is_verified', 'verification_status')
    list_filter = ('is_verified', 'verification_status', 'wilaya')
    search_fields = ('store_name', 'address', 'phone')

@admin.register(IndividualSellerProfile)
class IndividualSellerProfileAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'wilaya', 'phone', 'trust_score')
    list_filter = ('wilaya',)
    search_fields = ('display_name', 'phone')
