from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('modulos.productos.urls')),
    path('api/', include('modulos.proveedores.urls')),
    path('api/', include('modulos.movimientos_inventario.urls')),
    path('api/', include('modulos.ventas.urls')),
    path('api/', include('modulos.agente_ia.urls')),
    path('api/auth/', include('modulos.usuarios.urls')),
]
