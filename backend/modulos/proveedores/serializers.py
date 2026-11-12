from rest_framework import serializers
from .models import Proveedor


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = [
            'id',
            'nombre',
            'telefono',
            'correo',
            'direccion'
        ]

    
    def validate_telefono(self, value):
        import re

        if value and not re.fullmatch(r'[0-9]{4}-[0-9]{4}', value):
            raise serializers.ValidationError(
                'El teléfono debe tener el formato 2222-1234.'
            )

        return value

