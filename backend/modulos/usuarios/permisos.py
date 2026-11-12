
from rest_framework.permissions import BasePermission, SAFE_METHODS


class PermisoProductos(BasePermission):
    message = 'No tenés permiso para realizar esta operación.'

    def has_permission(self, request, view):
        usuario = request.user

        if not usuario.is_authenticated or not usuario.is_active:
            return False

        # Administrador: acceso completo
        if usuario.is_staff:
            return True

        # Cajero: solo puede consultar productos
        es_cajero = usuario.groups.filter(
            name='Cajero'
        ).exists()

        if es_cajero and request.method in SAFE_METHODS:
            return True

        return False
