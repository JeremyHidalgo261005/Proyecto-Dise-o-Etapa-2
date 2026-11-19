from decimal import Decimal

from rest_framework import serializers

from modulos.productos.models import Categoria
from modulos.proveedores.models import Proveedor

from .models import MovimientoInventario
from .servicios import CAMPOS_TIPO


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()

    def get_usuario_nombre(self, movimiento):
        usuario = movimiento.usuario
        return usuario.get_full_name() or usuario.get_username()

    class Meta:
        model = MovimientoInventario
        fields = [
            'id_movimiento', 'tipo_movimiento', 'cantidad', 'fecha', 'producto',
            'producto_nombre', 'usuario', 'usuario_nombre', 'motivo', 'precio_anterior',
            'precio_nuevo', 'valor_anterior', 'valor_nuevo', 'stock_anterior',
            'stock_resultante', 'detalle_venta',
        ]
        read_only_fields = fields


CAMPOS_ENTRADA = {
    'precio': 'precio_nuevo',
    'costo': 'costo_nuevo',
    'proveedor': 'proveedor_nuevo',
    'categoria': 'categoria_nueva',
}


class RegistroMovimientoSerializer(serializers.Serializer):
    tipo_movimiento = serializers.ChoiceField(choices=['ingreso', 'ajuste', *CAMPOS_TIPO.values()])
    producto = serializers.IntegerField(min_value=1, max_value=2**31 - 1)
    motivo = serializers.CharField()
    cantidad = serializers.IntegerField(required=False, min_value=-(2**31), max_value=2**31 - 1)
    stock_nuevo = serializers.IntegerField(required=False, min_value=0, max_value=2**31 - 1)
    stock_esperado = serializers.IntegerField(required=False, min_value=0, max_value=2**31 - 1)
    precio_nuevo = serializers.DecimalField(
        required=False, max_digits=10, decimal_places=2, min_value=Decimal('0.01')
    )
    costo_nuevo = serializers.DecimalField(
        required=False, max_digits=10, decimal_places=2, min_value=Decimal('0.01')
    )
    proveedor_nuevo = serializers.PrimaryKeyRelatedField(required=False, queryset=Proveedor.objects.all())
    categoria_nueva = serializers.PrimaryKeyRelatedField(required=False, queryset=Categoria.objects.all())

    def validate(self, datos):
        tipo = datos['tipo_movimiento']
        valores = set(datos) - {'producto', 'tipo_movimiento', 'motivo'}
        if tipo == 'ingreso' and valores == {'cantidad'} and datos['cantidad'] > 0:
            return datos
        if tipo == 'ajuste':
            if valores == {'cantidad'} and datos['cantidad'] != 0:
                return datos
            if 'stock_nuevo' in valores and valores <= {'stock_nuevo', 'stock_esperado'}:
                return datos
        for campo, tipo_campo in CAMPOS_TIPO.items():
            if tipo == tipo_campo and valores == {CAMPOS_ENTRADA[campo]}:
                return datos
        raise serializers.ValidationError({'detail': 'Indicá un valor válido para el tipo de movimiento.'})
