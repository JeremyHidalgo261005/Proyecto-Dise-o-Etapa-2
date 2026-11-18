# Django
from django.db import transaction
from decimal import Decimal

# Django REST Framework
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Sum

# Modelos
from .models import Venta, DetalleVenta
from modulos.productos.models import Producto
from modulos.movimientos_inventario.models import MovimientoInventario

# Serializers
from .serializers import VentaSerializer

# Permisos
from modulos.usuarios.permisos import PermisoVentas

class VentaViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet
):

    queryset = Venta.objects.select_related(
        'usuario'
    ).prefetch_related(
        'detalles__producto'
    ).all().order_by('-fecha')

    serializer_class = VentaSerializer
    permission_classes = [PermisoVentas]

    def create(self, request, *args, **kwargs):

        detalles = request.data.get('detalles') 

        if not isinstance(detalles, list) or not detalles:
            return Response(
                {'detail': 'Debés incluir al menos un producto en la venta.'},
                status=status.HTTP_400_BAD_REQUEST 
            )

        ids_productos = []

        for item in detalles:

            if not isinstance(item, dict):
                raise ValidationError(
                    {'detail': 'Cada detalle debe contener un producto y una cantidad.'}
                )

            id_producto = item.get('producto')

            if isinstance(id_producto, bool) or not isinstance(id_producto, int) or id_producto <= 0:
                raise ValidationError(
                    {'detail': 'Cada producto debe tener un ID entero positivo.'}
                )

            ids_productos.append(id_producto)

        if len(ids_productos) != len(set(ids_productos)):
            raise ValidationError(
                {'detail': 'No podés incluir el mismo producto más de una vez en una venta.'}
            )

        with transaction.atomic():

            venta = Venta.objects.create(
                usuario=request.user,
                total=Decimal('0.00')
            )

            for item in detalles:

                id_producto = item.get('producto')
                cantidad = item.get('cantidad')

                if isinstance(cantidad, bool) or not isinstance(cantidad, int) or cantidad <= 0:
                    raise ValidationError(
                        {'detail': 'La cantidad debe ser un número entero mayor que cero.'}
                    )

                try:
                    producto = Producto.objects.select_for_update().get(
                        pk=id_producto
                    )
                except (Producto.DoesNotExist, ValueError, TypeError):
                    raise ValidationError(
                        {'detail': f'No existe un producto con el ID {id_producto}.'}
                    )

                if not producto.estado:
                    raise ValidationError(
                        {'detail': f'El producto {producto.nombre} no está disponible para la venta.'}
                    )

                if producto.stock_actual < cantidad:
                    raise ValidationError(
                        {'detail': f'No hay suficiente stock para el producto {producto.nombre}.'}
                    )

                stock_anterior = producto.stock_actual
                stock_resultante = stock_anterior - cantidad

                producto.stock_actual = stock_resultante
                producto.save(update_fields=['stock_actual'])

                subtotal = producto.precio * Decimal(cantidad)
                precio_unitario = producto.precio

                detalle = DetalleVenta.objects.create(
                    venta=venta,
                    producto=producto,
                    cantidad=cantidad,
                    precio_unitario=precio_unitario,
                    subtotal=subtotal
                )

                MovimientoInventario.objects.create(
                    producto=producto,
                    tipo_movimiento='venta',
                    cantidad=cantidad,
                    motivo=f'Venta ID: {venta.id_venta}',
                    stock_anterior=stock_anterior,
                    stock_resultante=stock_resultante,
                    detalle_venta=detalle,
                    usuario=request.user
                )

            venta.total = venta.detalles.aggregate(
                total_venta=Sum('subtotal')
            )['total_venta'] or Decimal('0.00')

            venta.save(update_fields=['total'])
            venta = self.get_queryset().get(pk=venta.pk)

            serializer = VentaSerializer(venta)

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
            

    