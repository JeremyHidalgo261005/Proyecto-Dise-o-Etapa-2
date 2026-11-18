from django.db import models

from django.conf import settings

from django.db.models import Q, F

from django.core.validators import MinValueValidator
from decimal import Decimal


class Venta(models.Model):
    id_venta = models.AutoField(primary_key=True)
    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT
    )
    total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(total__gte=0),
                name='venta_total_no_negativo'
            )
        ]

    def __str__(self):
        return f"Venta {self.id_venta} - {self.fecha}"

    

class DetalleVenta(models.Model):
    id_detalle = models.AutoField(primary_key=True)
    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        related_name='detalles'
    )
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.PROTECT
    )
    cantidad = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )

    precio_unitario = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )

    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(cantidad__gt=0),
                name='detalle_cantidad_positiva'
            ),
            models.CheckConstraint(
                condition=Q(precio_unitario__gt=0),
                name='detalle_precio_positivo'
            ),
            models.CheckConstraint(
                condition=Q(subtotal__gt=0),
                name='detalle_subtotal_positivo'
            ),
            models.CheckConstraint(
                condition=Q(subtotal=F('cantidad') * F('precio_unitario')),
                name='detalle_subtotal_correcto'
            )
        ]

    def __str__(self):
        return f"Detalle {self.id_detalle} - Venta {self.venta.id_venta}"