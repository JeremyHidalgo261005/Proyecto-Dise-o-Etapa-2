
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, ProductoViewSet
from .views_csv import ImportarCSVProductosView

router = DefaultRouter()

router.register('categorias', CategoriaViewSet)
router.register('productos', ProductoViewSet)

urlpatterns = [
    path('productos/importar-csv/', ImportarCSVProductosView.as_view(), name='importar-csv-productos'),
    path('', include(router.urls)),
]

