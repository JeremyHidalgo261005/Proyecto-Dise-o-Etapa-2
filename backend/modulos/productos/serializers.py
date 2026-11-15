
from rest_framework import serializers
from .models import Categoria, Producto


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nombre', 'descripcion']


class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = [
            'id',
            'nombre',
            'codigo',
            'costo',
            'precio',
            'stock_actual',
            'stock_minimo',
            'estado',
            'categoria',
            'proveedor'
        ]
