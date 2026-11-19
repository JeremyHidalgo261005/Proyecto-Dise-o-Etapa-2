from django.db import models

from django.conf import settings

from django.db.models import Q, F

TIPOS_CON_VALOR = ['cambio_costo', 'cambio_proveedor', 'cambio_categoria']

class MovimientoInventario(models.Model):

    id_movimiento = models.AutoField(primary_key=True)

    tipo_movimiento = models.CharField(max_length=20, choices=[
        ('venta', 'Venta'),
        ('ingreso', 'Ingreso'),
        ('ajuste', 'Ajuste'), 
        ('cambio_precio', 'Cambio de Precio'),
        ('cambio_costo', 'Cambio de Costo'),
        ('cambio_proveedor', 'Cambio de Proveedor'),
        ('cambio_categoria', 'Cambio de Categoría'),
    ])

    cantidad = models.IntegerField(null=True, blank=True)

    fecha = models.DateTimeField(auto_now_add=True)

    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.PROTECT
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT
    )

    motivo = models.TextField(blank=True, null=True)

    precio_anterior = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    precio_nuevo = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    valor_anterior = models.TextField(null=True, blank=True)
    valor_nuevo = models.TextField(null=True, blank=True)

    stock_anterior = models.PositiveIntegerField(null=True, blank=True)

    stock_resultante = models.PositiveIntegerField(null=True, blank=True)

    detalle_venta = models.ForeignKey(
        'ventas.DetalleVenta',
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )

    class Meta:
        constraints = [

            models.CheckConstraint(
                condition=(
                    Q(tipo_movimiento='cambio_precio') &
                    Q(cantidad__isnull=True) &
                    Q(precio_anterior__gt=0) &
                    Q(precio_nuevo__gt=0) &
                    ~Q(precio_anterior=F('precio_nuevo'))
                ) |
                (
                    ~Q(tipo_movimiento__in=['cambio_precio', *TIPOS_CON_VALOR]) &
                    Q(cantidad__isnull=False) &
                    ~Q(cantidad=0) &
                    Q(precio_anterior__isnull=True) &
                    Q(precio_nuevo__isnull=True)
                ) |
                (
                    Q(tipo_movimiento__in=TIPOS_CON_VALOR, cantidad__isnull=True) &
                    Q(precio_anterior__isnull=True, precio_nuevo__isnull=True) &
                    Q(valor_anterior__isnull=False, valor_nuevo__isnull=False)
                ),
                name='movimiento_datos_segun_tipo'
            ),

            models.CheckConstraint(
                condition=(
                    Q(tipo_movimiento='ingreso', cantidad__gt=0) |
                    Q(tipo_movimiento='venta', cantidad__gt=0) |
                    Q(tipo_movimiento='ajuste') |
                    Q(tipo_movimiento__in=['cambio_precio', *TIPOS_CON_VALOR])
                ),
                name='movimiento_cantidad_valida'
            ),

            models.CheckConstraint(
                condition=(
                    Q(tipo_movimiento='venta', detalle_venta__isnull=False) |
                    (
                        ~Q(tipo_movimiento='venta') &
                        Q(detalle_venta__isnull=True)
                    )
                ),
                name='movimiento_detalle_venta_valido'
            ),

            models.CheckConstraint(
                condition=Q(tipo_movimiento__in=[
                    'venta',
                    'ingreso',
                    'ajuste',
                    'cambio_precio',
                    *TIPOS_CON_VALOR,
                ]),
                name='movimiento_tipo_valido'
            ), 

            models.CheckConstraint(
                condition=(
                    (
                        Q(tipo_movimiento__in=['cambio_precio', *TIPOS_CON_VALOR]) &
                        Q(stock_anterior__isnull=False, stock_resultante__isnull=False) &
                        Q(stock_resultante=F('stock_anterior'))
                    ) |
                    (
                        ~Q(tipo_movimiento__in=['cambio_precio', *TIPOS_CON_VALOR]) &
                        Q(stock_anterior__isnull=False, stock_resultante__isnull=False) &
                        Q(stock_resultante__isnull=False)
                    )
                ),
                name='movimiento_stock_valido'
            )
            
        ]

    def __str__(self):
        return f'{self.tipo_movimiento} - {self.producto.nombre}'

    
