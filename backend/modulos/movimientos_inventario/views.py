# Django
from django.db import transaction

# Django REST Framework
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

# Modelos
from .models import MovimientoInventario
from modulos.productos.models import Producto

# Serializers
from .serializers import MovimientoInventarioSerializer

# Permisos
from modulos.usuarios.permisos import PermisoMovimientosInventario


class MovimientoInventarioViewSet(
    mixins.ListModelMixin, 
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet
):

    queryset = MovimientoInventario.objects.select_related(
        'producto',                                                 # Este es el query encargadod de traer el producto relacionado 
        'usuario'                                                   # con el movimiento de inventario
    ).all().order_by('-fecha')

    serializer_class = MovimientoInventarioSerializer
    permission_classes = [PermisoMovimientosInventario]

    
    def create(self, request, *args, **kwargs):

        # Recibir y validar los datos
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Obtener el producto relacionado con el movimiento
        producto = serializer.validated_data['producto']

        # Bloquear el registro del producto durante la operación
        with transaction.atomic():

            producto = Producto.objects.select_for_update().get(
                pk=producto.pk
            )

            # Obtener los datos del movimiento
            tipo_movimiento = serializer.validated_data['tipo_movimiento']
            cantidad = serializer.validated_data.get('cantidad')

            precio_anterior = None
            precio_nuevo = None

            # Guardar los valores anteriores
            stock_anterior = producto.stock_actual

            # Calcular los valores resultantes según el tipo
            if tipo_movimiento == 'ingreso':

                stock_resultante = stock_anterior + cantidad

            elif tipo_movimiento == 'ajuste':

                stock_resultante = stock_anterior + cantidad

                # Verificar que el stock no quede negativo
                if stock_resultante < 0:
                    return Response(
                        {
                            'detail': 'No se puede realizar el ajuste porque el stock resultante sería negativo.'
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

            elif tipo_movimiento == 'cambio_precio':

                precio_anterior = producto.precio
                precio_nuevo = serializer.validated_data['precio_nuevo']

                # Verificar que el precio realmente cambie
                if precio_nuevo == precio_anterior:
                    return Response(
                        {
                            'detail': 'El nuevo precio no debe ser igual al precio anterior.'
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                stock_resultante = stock_anterior

            # Actualizar el producto
            if tipo_movimiento in ['ingreso', 'ajuste']:
                producto.stock_actual = stock_resultante

            elif tipo_movimiento == 'cambio_precio':
                producto.precio = precio_nuevo

            producto.save()

            # Registrar el movimiento de inventario
            serializer.save(
                usuario=request.user,
                stock_anterior=stock_anterior,
                stock_resultante=stock_resultante,
                precio_anterior=precio_anterior,
                precio_nuevo=precio_nuevo
            )

        # Responder al frontend
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )
