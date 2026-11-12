
from django.db import models

class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True)

    def __str__(self):
        return self.nombre



from decimal import Decimal
from django.core.validators import MinValueValidator


class Producto(models.Model):
    nombre = models.CharField(max_length=150)
    codigo = models.CharField(max_length=50, unique=True)

    precio = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )

    stock_actual = models.PositiveIntegerField(default=0)
    stock_minimo = models.PositiveIntegerField(default=5)

    estado = models.BooleanField(default=True)

    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT
    )

    proveedor = models.ForeignKey(
        'proveedores.Proveedor',
        on_delete=models.PROTECT
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(precio__gt=0),
                name='producto_precio_positivo'
            )
        ]

    def __str__(self):
        return self.nombre
