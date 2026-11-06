from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import (
    BookstoreViewSet, IndividualSellerViewSet, LibraryViewSet,
    admin_analytics_view, admin_bookstores_verification_view,
    admin_users_management_view,
    auth_login_view, auth_logout_view, auth_me_view,
    auth_password_reset_confirm_view, auth_password_reset_request_view,
    auth_register_view, auth_resend_verification_view, auth_verify_email_view,
    bookstore_my_store_view, bookstore_order_action_view, bookstore_orders_view,
    bookstore_stats_view, library_me_view, library_order_detail_view,
    library_orders_view,
)
from backoffice.views import (
    moderate_message_view, moderate_review_view, moderation_queue_view,
    platform_analytics_view, resolve_conversation_report_view,
)
from catalog.upload_views import upload_image_view
from catalog.views import (
    AuthorViewSet, CategoryViewSet, EditionViewSet, GenreViewSet, LanguageViewSet,
    PublisherViewSet, WorkViewSet, import_catalog_csv_view, isbn_lookup_view,
)
from discovery.views import search_offers_view, search_works_view
from geo.views import CommuneViewSet, WilayaViewSet, nearby_bookstores_view
from marketplace.views import (
    BookViewSet, OfferViewSet, buyer_orders_view, buyer_wishlist_view,
    checkout_quote_view, checkout_view, delivery_options_view,
    favorite_bookstores_view, favorite_sellers_view,
    order_cancel_view, order_detail_view, order_tracking_view, order_transition_view,
    publish_offer_view, review_report_view, saved_search_detail_view, saved_searches_view,
    seller_confirm_availability_view, seller_create_listing_view,
    seller_my_listings_view, seller_suborders_view, seller_toggle_listing_status_view,
    submit_review_view,
)
from messaging.views import (
    conversation_detail_view, conversation_list_view, conversation_message_view,
    conversation_unread_count_view, message_report_view,
)
from metadata.views import (
    metadata_import_view, metadata_isbn_view, metadata_search_view, metadata_sources_view,
)
from notifications.views import (
    notification_list_view, notification_read_all_view, notification_read_view,
    notification_unread_count_view,
)

router = DefaultRouter()
router.register(r'wilayas', WilayaViewSet, basename='wilaya')
router.register(r'communes', CommuneViewSet, basename='commune')
router.register(r'bookstores', BookstoreViewSet, basename='bookstore')
router.register(r'libraries', LibraryViewSet, basename='library')
router.register(r'books', BookViewSet, basename='book')
router.register(r'individual-sellers', IndividualSellerViewSet, basename='individual-seller')
router.register(r'authors', AuthorViewSet, basename='author')
router.register(r'publishers', PublisherViewSet, basename='publisher')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'genres', GenreViewSet, basename='genre')
router.register(r'languages', LanguageViewSet, basename='language')
router.register(r'works', WorkViewSet, basename='work')
router.register(r'editions', EditionViewSet, basename='edition')
router.register(r'offers', OfferViewSet, basename='offer')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth & profiles
    path('api/auth/login/', auth_login_view, name='auth-login'),
    path('api/auth/logout/', auth_logout_view, name='auth-logout'),
    path('api/auth/register/', auth_register_view, name='auth-register'),
    path('api/auth/me/', auth_me_view, name='auth-me'),
    path('api/auth/verify-email/', auth_verify_email_view, name='auth-verify-email'),
    path('api/auth/resend-verification/', auth_resend_verification_view, name='auth-resend-verification'),
    path('api/auth/password-reset/request/', auth_password_reset_request_view, name='auth-password-reset-request'),
    path('api/auth/password-reset/confirm/', auth_password_reset_confirm_view, name='auth-password-reset-confirm'),

    # Catalog, ISBN & external metadata
    path('api/catalog/lookup/', isbn_lookup_view, name='isbn-lookup'),
    path('api/catalog/upload-csv/', import_catalog_csv_view, name='catalog-upload-csv'),
    path('api/catalog/metadata/search/', metadata_search_view, name='metadata-search'),
    path('api/catalog/metadata/isbn/', metadata_isbn_view, name='metadata-isbn'),
    path('api/catalog/metadata/import/', metadata_import_view, name='metadata-import'),
    path('api/catalog/metadata/sources/', metadata_sources_view, name='metadata-sources'),
    path('api/upload/image/', upload_image_view, name='upload-image'),
    path('api/offers/publish/', publish_offer_view, name='publish-offer'),

    # Discovery
    path('api/search/offers/', search_offers_view, name='search-offers'),
    path('api/search/works/', search_works_view, name='search-works'),

    # Cart, checkout & delivery
    path('api/checkout/quote/', checkout_quote_view, name='checkout-quote'),
    path('api/checkout/', checkout_view, name='checkout'),
    path('api/orders/', checkout_view, name='orders-create'),
    path('api/delivery/options/', delivery_options_view, name='delivery-options'),

    # Buyer
    path('api/buyer/orders/', buyer_orders_view, name='buyer-orders'),
    path('api/buyer/wishlist/', buyer_wishlist_view, name='buyer-wishlist'),
    path('api/buyer/favorites/bookstores/', favorite_bookstores_view, name='favorite-bookstores'),
    path('api/buyer/favorites/sellers/', favorite_sellers_view, name='favorite-sellers'),
    path('api/buyer/saved-searches/', saved_searches_view, name='saved-searches'),
    path('api/buyer/saved-searches/<int:saved_search_id>/', saved_search_detail_view, name='saved-search-detail'),
    path('api/buyer/reviews/', submit_review_view, name='buyer-reviews'),
    path('api/buyer/reviews/<int:review_id>/report/', review_report_view, name='review-report'),

    # Library profile (must be declared before the router's <slug> detail route)
    path('api/libraries/me/', library_me_view, name='library-me'),
    path('api/libraries/me/orders/', library_orders_view, name='library-orders'),
    path(
        'api/libraries/me/orders/<int:order_id>/',
        library_order_detail_view,
        name='library-order-detail',
    ),

    # Bookstore portal
    path('api/bookstore/my-store/', bookstore_my_store_view, name='bookstore-my-store'),
    path('api/bookstore/stats/', bookstore_stats_view, name='bookstore-stats'),
    path('api/bookstore/orders/', bookstore_orders_view, name='bookstore-orders'),
    path('api/bookstore/orders/<int:order_id>/action/', bookstore_order_action_view, name='bookstore-order-action'),

    # Individual seller portal
    path('api/seller/my-listings/', seller_my_listings_view, name='seller-my-listings'),
    path('api/seller/create-listing/', seller_create_listing_view, name='seller-create-listing'),
    path('api/seller/listings/<int:offer_id>/status/', seller_toggle_listing_status_view, name='seller-listing-status'),
    path('api/seller/listings/<int:offer_id>/confirm-availability/', seller_confirm_availability_view, name='seller-confirm-availability'),
    path('api/seller/suborders/', seller_suborders_view, name='seller-suborders'),

    # Orders & tracking
    path('api/orders/<int:order_id>/', order_detail_view, name='order-detail'),
    path('api/orders/<int:order_id>/tracking/', order_tracking_view, name='order-tracking'),
    path('api/orders/<int:order_id>/transition/', order_transition_view, name='order-transition'),
    path('api/orders/<int:order_id>/cancel/', order_cancel_view, name='order-cancel'),

    # Messaging
    path('api/messages/conversations/', conversation_list_view, name='conversation-list'),
    path('api/messages/conversations/<int:conversation_id>/', conversation_detail_view, name='conversation-detail'),
    path('api/messages/conversations/<int:conversation_id>/messages/', conversation_message_view, name='conversation-messages'),
    path('api/messages/messages/<int:message_id>/report/', message_report_view, name='message-report'),
    path('api/messages/unread-count/', conversation_unread_count_view, name='messages-unread-count'),

    # Notifications
    path('api/notifications/', notification_list_view, name='notification-list'),
    path('api/notifications/read-all/', notification_read_all_view, name='notification-read-all'),
    path('api/notifications/unread-count/', notification_unread_count_view, name='notification-unread-count'),
    path('api/notifications/<int:notification_id>/read/', notification_read_view, name='notification-read'),

    # Geography & distance
    path('api/geo/nearby-bookstores/', nearby_bookstores_view, name='nearby-bookstores'),

    # Administration
    path('api/admin/analytics/', admin_analytics_view, name='admin-analytics'),
    path('api/admin/overview/', platform_analytics_view, name='admin-overview'),
    path('api/admin/bookstores/', admin_bookstores_verification_view, name='admin-bookstores'),
    path('api/admin/bookstores/<int:store_id>/verify/', admin_bookstores_verification_view, name='admin-bookstore-verify'),
    path('api/admin/users/', admin_users_management_view, name='admin-users'),
    path('api/admin/users/<int:user_id>/toggle-suspend/', admin_users_management_view, name='admin-user-suspend'),
    path('api/admin/moderation/', moderation_queue_view, name='admin-moderation'),
    path('api/admin/moderation/reviews/<int:review_id>/', moderate_review_view, name='admin-moderate-review'),
    path('api/admin/moderation/messages/<int:message_id>/', moderate_message_view, name='admin-moderate-message'),
    path('api/admin/moderation/conversations/<int:report_id>/', resolve_conversation_report_view, name='admin-resolve-report'),

    path('api/', include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
