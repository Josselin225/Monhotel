from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Seuls les administrateurs."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class IsAdminOrManager(permissions.BasePermission):
    """Admins et managers."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in ('admin', 'manager')
        )


class IsStaff(permissions.BasePermission):
    """Tout le personnel connecté (admin, manager, receptionist)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Lecture pour tout le staff, écriture réservée aux admins."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role == 'admin'
