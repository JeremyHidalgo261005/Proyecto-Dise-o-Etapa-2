
import re

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
            'id_venta', 'fecha', 'usuario', 'total', 'detalles',
            'porcentaje_descuento', 'descuento', 'metodo_pago',
            'dinero_aportado', 'vuelto', 'referencia_tarjeta',
        ]
        read_only_fields = fields


class VentaHistorialSerializer(serializers.ModelSerializer):
    cajero = serializers.SerializerMethodField()
    cantidad_articulos = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=22, decimal_places=2, read_only=True)

    def get_cajero(self, venta):
        return venta.usuario.get_full_name() or venta.usuario.get_username()

    class Meta:
        model = Venta
        fields = [
            'id_venta', 'fecha', 'cajero', 'cantidad_articulos', 'subtotal',
            'descuento', 'total', 'metodo_pago',
        ]
        read_only_fields = fields


class FiltrosHistorialSerializer(serializers.Serializer):
    factura = serializers.RegexField(r'(?i)^(?:FAC-)?[0-9]{1,10}$', required=False, allow_blank=True)
    fecha = serializers.DateField(required=False)
    metodo_pago = serializers.ChoiceField(choices=['efectivo', 'tarjeta'], required=False)

    def validate_factura(self, valor):
        if not valor:
            return None
        numero = int(valor.upper().removeprefix('FAC-'))
        if not 0 < numero <= 2**31 - 1:
            raise serializers.ValidationError('Ingresá un número de factura válido.')
        return numero


class LineaVentaSerializer(serializers.Serializer):
    producto = serializers.IntegerField(min_value=1, max_value=2**31 - 1)
    cantidad = serializers.IntegerField(min_value=1, max_value=2**31 - 1)


class RegistroVentaSerializer(serializers.Serializer):
    detalles = LineaVentaSerializer(many=True, allow_empty=False)
    clave_solicitud = serializers.UUIDField(required=False)
    metodo_pago = serializers.ChoiceField(choices=['efectivo', 'tarjeta'], required=False)
    dinero_aportado = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, required=False
    )
    referencia_tarjeta = serializers.RegexField(
        regex=r'^[A-Za-z0-9 _./-]*$', max_length=64, allow_blank=True, required=False
    )
    porcentaje_descuento = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=0, max_value=100, default=0
    )
    autorizacion = serializers.CharField(required=False, max_length=512)
    total_esperado = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, required=False
    )

    def validate_detalles(self, detalles):
        ids = [item['producto'] for item in detalles]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('No podés incluir el mismo producto más de una vez.')
        return detalles

    def validate_referencia_tarjeta(self, valor):
        if re.search(r'[0-9]{13,}', re.sub(r'[ _./-]', '', valor)):
            raise serializers.ValidationError('Ingresá únicamente la referencia del comprobante.')
        return valor

    def validate(self, datos):
        metodo = datos.get('metodo_pago')
        if (metodo or datos['porcentaje_descuento']) and 'clave_solicitud' not in datos:
            raise serializers.ValidationError({'clave_solicitud': 'Indicá la clave de la solicitud.'})
        if metodo == 'efectivo' and 'dinero_aportado' not in datos:
            raise serializers.ValidationError({'dinero_aportado': 'Indicá el monto recibido.'})
        if metodo != 'efectivo' and 'dinero_aportado' in datos:
            raise serializers.ValidationError({'dinero_aportado': 'Solo se usa para efectivo.'})
        if metodo != 'tarjeta' and datos.get('referencia_tarjeta'):
            raise serializers.ValidationError({'referencia_tarjeta': 'Solo se usa para tarjeta.'})
        return datos


class AutorizacionVentaSerializer(serializers.Serializer):
    pin = serializers.CharField(max_length=128, write_only=True, trim_whitespace=False)
    accion = serializers.ChoiceField(choices=['descuento'], default='descuento')
    clave_solicitud = serializers.UUIDField()
    porcentaje_descuento = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=0, max_value=100
    )
