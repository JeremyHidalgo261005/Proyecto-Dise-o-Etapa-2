
from rest_framework import serializers

from .models import Venta, DetalleVenta


class DetalleVentaSerializer(serializers.ModelSerializer):

    producto_nombre = serializers.CharField(
        source='producto.nombre',
        read_only=True
    )

    class Meta:
        model = DetalleVenta
        fields = [
            'id_detalle',
            'venta',
            'producto',
            'producto_nombre',
            'cantidad',
            'precio_unitario',
            'subtotal'
        ]
        read_only_fields = [
            'id_detalle',
            'precio_unitario',
            'subtotal',
            'producto_nombre'
        ]

    def validate(self, datos):

        cantidad = datos.get('cantidad')

        if cantidad is not None and cantidad <= 0:
            raise serializers.ValidationError(
                {
                    'cantidad': 'La cantidad debe ser mayor que cero.'
                }
            )

        return datos


class VentaSerializer(serializers.ModelSerializer):

    detalles = DetalleVentaSerializer(many=True, read_only=True)

    class Meta:
        model = Venta
        fields = [
            'id_venta',
            'fecha',
            'usuario',
            'total', 
            'detalles'
        ]

        read_only_fields = [
            'id_venta',
            'fecha',
            'usuario',
            'total', 
            'detalles'
        ]