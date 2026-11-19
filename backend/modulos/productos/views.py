from django.db import transaction
from modulos.movimientos_inventario.models import MovimientoInventario
from modulos.movimientos_inventario.errores import ManejarErroresMovimientos
from modulos.movimientos_inventario.servicios import (
    CAMPOS_TIPO, calcular_ajuste, registrar_atributo, registrar_existencias, registrar_stock_inicial,
)
from modulos.usuarios.permisos import PermisoProductos
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



class ProductoViewSet(ManejarErroresMovimientos, viewsets.ModelViewSet):
    queryset = Producto.objects.select_related(
        'categoria', 'proveedor'
    ).all().order_by('nombre')

    serializer_class = ProductoSerializer
    permission_classes = [PermisoProductos]


    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ('update', 'partial_update', 'destroy'):
            return queryset.select_for_update(of=('self',))
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        producto = serializer.save()
        registrar_stock_inicial(producto, self.request.user, 'Existencias iniciales del producto')

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        producto = serializer.instance
        datos = serializer.validated_data
        motivo = 'Edición del producto'
        if 'stock_nuevo' in datos:
            cantidad = calcular_ajuste(producto, datos.pop('stock_nuevo'), datos.pop('stock_esperado', None))
            if cantidad:
                registrar_existencias(producto, self.request.user, 'ajuste', cantidad, motivo)
        for campo in CAMPOS_TIPO:
            if campo in datos:
                registrar_atributo(producto, self.request.user, campo, datos.pop(campo), motivo)
        serializer.save()

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        producto = self.get_object()
        if producto.stock_actual or MovimientoInventario.objects.filter(producto=producto).exists():
            return self.conflicto_eliminacion()
        try:
            with transaction.atomic():
                self.perform_destroy(producto)
        except ProtectedError:
            return self.conflicto_eliminacion()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def conflicto_eliminacion(self):
        return Response(
            {'detail': 'No se puede eliminar un producto con existencias o historial.'},
            status=status.HTTP_409_CONFLICT,
        )
