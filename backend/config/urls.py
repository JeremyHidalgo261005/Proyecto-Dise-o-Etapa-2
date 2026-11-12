
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('modulos.productos.urls')),
    path('api/', include('modulos.proveedores.urls')),
]
