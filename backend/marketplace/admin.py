from django.contrib import admin
from .models import Offer, Order, OrderItem, Review

@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = ('work', 'seller_name', 'price', 'condition', 'stock_quantity', 'is_in_stock', 'status')
    list_filter = ('seller_type', 'condition', 'status', 'is_in_stock')
    search_fields = ('work__title', 'bookstore__store_name', 'individual_seller__display_name')

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'buyer', 'total_amount', 'status', 'payment_method', 'payment_status', 'recipient_wilaya')
    list_filter = ('status', 'payment_method', 'payment_status', 'recipient_wilaya')
    search_fields = ('order_number', 'recipient_name', 'recipient_phone')
    inlines = [OrderItemInline]

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('buyer', 'rating', 'seller_type')
