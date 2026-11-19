from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from modulos.productos.models import Producto
from modulos.usuarios.permisos import PermisoMovimientosInventario

from .errores import ManejarErroresMovimientos
from .models import MovimientoInventario
from .serializers import CAMPOS_ENTRADA, MovimientoInventarioSerializer, RegistroMovimientoSerializer
from .servicios import CAMPOS_TIPO, calcular_ajuste, registrar_atributo, registrar_existencias



class MovimientoInventarioViewSet(
    ManejarErroresMovimientos,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = MovimientoInventario.objects.select_related('producto', 'usuario').order_by(
        '-fecha', '-id_movimiento'
    )
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [PermisoMovimientosInventario]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        entrada = RegistroMovimientoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        producto = get_object_or_404(Producto.objects.select_for_update(), pk=datos['producto'])
        tipo = datos['tipo_movimiento']
        if tipo in ('ingreso', 'ajuste'):
            cantidad = datos.get('cantidad')
            if 'stock_nuevo' in datos:
                cantidad = calcular_ajuste(producto, datos['stock_nuevo'], datos.get('stock_esperado'))
            if cantidad == 0:
                raise ValidationError({'stock_nuevo': 'La nueva cantidad debe ser distinta de la actual.'})
            movimiento = registrar_existencias(producto, request.user, tipo, cantidad, datos['motivo'])
        else:
            campo = next(campo for campo, tipo_campo in CAMPOS_TIPO.items() if tipo == tipo_campo)
            valor = datos[CAMPOS_ENTRADA[campo]]
            movimiento = registrar_atributo(producto, request.user, campo, valor, datos['motivo'])
            if movimiento is None:
                raise ValidationError({CAMPOS_ENTRADA[campo]: 'El valor nuevo debe ser distinto del actual.'})
        return Response(self.get_serializer(movimiento).data, status=status.HTTP_201_CREATED)
