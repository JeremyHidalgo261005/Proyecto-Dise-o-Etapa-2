
from rest_framework import serializers
from .models import Categoria, Producto


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nombre', 'descripcion']


class ProductoSerializer(serializers.ModelSerializer):
    stock_nuevo = serializers.IntegerField(write_only=True, required=False, min_value=0, max_value=2**31 - 1)
    stock_esperado = serializers.IntegerField(write_only=True, required=False, min_value=0, max_value=2**31 - 1)

    class Meta:
        model = Producto
        fields = [
            'id',
            'nombre',
            'codigo',
            'costo',
            'precio',
            'stock_actual',
            'stock_nuevo',
            'stock_esperado',
            'stock_minimo',
            'estado',
            'categoria',
            'proveedor'
        ]


    def validate_stock_actual(self, valor):
        if self.instance is not None and valor != self.instance.stock_actual:
            raise serializers.ValidationError('Modificá las existencias desde Movimientos.')
        return valor


    def validate(self, datos):
        if 'stock_nuevo' in datos and (self.instance is None or 'stock_actual' in datos):
            raise serializers.ValidationError({'stock_nuevo': 'Disponible únicamente al editar el producto.'})
        if 'stock_esperado' in datos and 'stock_nuevo' not in datos:
            raise serializers.ValidationError({'stock_esperado': 'Indicá también la nueva cantidad.'})
        return datos
