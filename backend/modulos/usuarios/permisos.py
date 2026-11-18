
from rest_framework.permissions import BasePermission, SAFE_METHODS

#Permisos para los productos 
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

# Permisos para los movimietos de inventario
class PermisoMovimientosInventario(BasePermission):

    message = 'No tenés permiso para realizar esta operación.'

    def has_permission(self, request, view):

        usuario = request.user

        if not usuario.is_authenticated or not usuario.is_active:
            return False

        # Administrador: puede consultar y registrar movimientos
        if usuario.is_staff:
            return True

        # Cajero: solamente puede consultar movimientos
        es_cajero = usuario.groups.filter(
            name='Cajero'
        ).exists()

        if es_cajero and request.method in SAFE_METHODS:
            return True

        return False



# Permisos para las ventas
class PermisoVentas(BasePermission):

    message = 'No tenés permiso para realizar esta operación.'

    def has_permission(self, request, view):

        usuario = request.user

        # Verificar que el usuario esté autenticado y activo
        if not usuario.is_authenticated or not usuario.is_active:
            return False

        # Administradores y cajeros pueden consultar y registrar ventas
        if usuario.is_staff:
            return True

        es_cajero = usuario.groups.filter(name='Cajero').exists()

        if es_cajero:
            return request.method in SAFE_METHODS or request.method == 'POST'

        return False
