
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

from .models import Categoria, Producto
from .serializers import CategoriaSerializer, ProductoSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all().order_by('nombre')
    serializer_class = CategoriaSerializer
    permission_classes = [IsAdminUser]


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.select_related(
        'categoria', 'proveedor'
    ).all().order_by('nombre')

    serializer_class = ProductoSerializer
    permission_classes = [IsAdminUser]
