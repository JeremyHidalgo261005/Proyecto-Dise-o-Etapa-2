from rest_framework import serializers

from .models import MovimientoInventario


class MovimientoInventarioSerializer(serializers.ModelSerializer):

    class Meta:
        model = MovimientoInventario

        fields = [
            'id_movimiento',
            'tipo_movimiento',
            'cantidad',
            'fecha',
            'producto',
            'usuario',
            'motivo',
            'precio_anterior',
            'precio_nuevo',
            'stock_anterior',
            'stock_resultante',
            'detalle_venta'
        ]

        read_only_fields = [
            'id_movimiento',
            'fecha',
            'usuario',
            'precio_anterior',
            'stock_anterior',
            'stock_resultante',
            'detalle_venta'
        ]

    def validate(self, datos):

        tipo = datos.get('tipo_movimiento')
        cantidad = datos.get('cantidad')
        precio_nuevo = datos.get('precio_nuevo')
        motivo = datos.get('motivo')

        # No se permiten movimientos de venta manuales
        if tipo == 'venta':
            raise serializers.ValidationError(
                'Los movimientos de venta se generan automáticamente.'
            )

        # El motivo es obligatorio para movimientos manuales
        if not motivo or not motivo.strip():
            raise serializers.ValidationError(
                {'motivo': 'Debés indicar el motivo del movimiento.'}
            )

        # Validaciones para ingresos
        if tipo == 'ingreso':
            if cantidad is None or cantidad <= 0:
                raise serializers.ValidationError(
                    {'cantidad': 'La cantidad del ingreso debe ser mayor que cero.'}
                )

        # Validaciones para ajustes
        elif tipo == 'ajuste':
            if cantidad is None or cantidad == 0:
                raise serializers.ValidationError(
                    {'cantidad': 'El ajuste debe tener una cantidad distinta de cero.'}
                )

        # Validaciones para cambios de precio
        elif tipo == 'cambio_precio':

            if cantidad is not None:
                raise serializers.ValidationError(
                    {'cantidad': 'Un cambio de precio no debe tener cantidad.'}
                )

            if precio_nuevo is None or precio_nuevo <= 0:
                raise serializers.ValidationError(
                    {'precio_nuevo': 'El nuevo precio debe ser mayor que cero.'}
                )

            producto = datos.get('producto')

            if producto and precio_nuevo == producto.precio:
                raise serializers.ValidationError(
                    {'precio_nuevo': 'El nuevo precio debe ser diferente al precio actual.'}
                )

        return datos
