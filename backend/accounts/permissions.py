"""Role and demo-mode permissions shared by the API."""
from django.conf import settings
from rest_framework import permissions


class IsAdminOrDemo(permissions.BasePermission):
    """Staff/admin only, unless the deployment explicitly enables demo access."""

    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and (user.is_staff or user.is_admin_user):
            return True
        return bool(getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False))


class IsCatalogEditorOrDemo(permissions.BasePermission):
    """Admins and verified bookstores may curate the shared catalog."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if user and user.is_authenticated:
            if user.is_staff or user.is_admin_user:
                return True
            if user.role == user.Role.BOOKSTORE_SELLER:
                profile = getattr(user, 'bookstore_profile', None)
                if profile is not None and profile.is_verified:
                    return True
        return bool(getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False))


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Anyone may read; only the owning user (or staff) may write.

    Object ownership is resolved through ``owner_user_id`` when available,
    then through the usual ``user`` / ``seller`` / ``buyer`` attributes, so
    listings, profiles and orders can share one class.
    """

    message = 'Vous ne pouvez modifier que vos propres ressources.'

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_admin_user:
            return True

        owner_id = getattr(obj, 'owner_user_id', None)
        if owner_id is None:
            for attribute in ('seller_id', 'user_id', 'buyer_id'):
                value = getattr(obj, attribute, None)
                if value:
                    owner_id = value
                    break
        return owner_id == user.id


class IsOwnerOrAdmin(permissions.BasePermission):
    """Object-level check for resources that carry a ``user`` attribute."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return bool(getattr(settings, 'ALLOW_ANONYMOUS_DEMO', False))
        owner = getattr(obj, 'user', None) or getattr(obj, 'buyer', None)
        return owner == user or user.is_staff or user.is_admin_user
