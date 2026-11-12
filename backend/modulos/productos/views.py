from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

from .models import Categoria, Producto
from .serializers import CategoriaSerializer, ProductoSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all().order_by('nombre')
    serializer_class = CategoriaSerializer
    permission_classes = [IsAdminUser]

    def destroy(self, request, *args, **kwargs):
        categoria = self.get_object()

        try:
            self.perform_destroy(categoria)

        except ProtectedError:
            return Response(
                {
                    "detail": (
                        f'No se puede eliminar la categoría '
                        f'"{categoria.nombre}" porque tiene '
                        f'productos asociados. Primero debés '
                        f'cambiar esos productos a otra categoría.'
                    )
                },
                status=status.HTTP_409_CONFLICT
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )



class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.select_related(
        'categoria', 'proveedor'
    ).all().order_by('nombre')

    serializer_class = ProductoSerializer
    permission_classes = [IsAdminUser]
