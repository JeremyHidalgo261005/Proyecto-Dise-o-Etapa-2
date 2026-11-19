from rest_framework.exceptions import ValidationError

from .models import MovimientoInventario


def registrar_existencias(producto, usuario, tipo, cantidad, motivo):
    anterior = producto.stock_actual
    resultante = anterior + cantidad
    if not 0 <= resultante <= 2**31 - 1:
        raise ValidationError({'cantidad': 'Las existencias resultantes están fuera del rango permitido.'})
    producto.stock_actual = resultante
    producto.save(update_fields=['stock_actual'])
    return MovimientoInventario.objects.create(
        producto=producto, usuario=usuario, tipo_movimiento=tipo, cantidad=cantidad,
        motivo=motivo, stock_anterior=anterior, stock_resultante=resultante,
    )


def registrar_stock_inicial(producto, usuario, motivo):
    if producto.stock_actual:
        MovimientoInventario.objects.create(
            producto=producto, usuario=usuario, tipo_movimiento='ingreso',
            cantidad=producto.stock_actual, motivo=motivo,
            stock_anterior=0, stock_resultante=producto.stock_actual,
        )


CAMPOS_TIPO = {
    'precio': 'cambio_precio',
    'costo': 'cambio_costo',
    'proveedor': 'cambio_proveedor',
    'categoria': 'cambio_categoria',
}


def registrar_atributo(producto, usuario, campo, nuevo, motivo):
    anterior = getattr(producto, campo)
    if nuevo == anterior:
        return None

    if campo == 'precio':
        valores = {'precio_anterior': anterior, 'precio_nuevo': nuevo}
    elif campo == 'costo':
        valores = {'valor_anterior': format(anterior, '.2f'), 'valor_nuevo': format(nuevo, '.2f')}
    else:
        valores = {'valor_anterior': anterior.nombre, 'valor_nuevo': nuevo.nombre}

    setattr(producto, campo, nuevo)
    producto.save(update_fields=[campo])
    return MovimientoInventario.objects.create(
        producto=producto, usuario=usuario, tipo_movimiento=CAMPOS_TIPO[campo],
        motivo=motivo, stock_anterior=producto.stock_actual,
        stock_resultante=producto.stock_actual, **valores,
    )


def calcular_ajuste(producto, stock_nuevo, stock_esperado=None):
    if stock_esperado is not None and stock_esperado != producto.stock_actual:
        raise ValidationError({'stock_nuevo': 'Las existencias cambiaron. Revisá la cantidad actual.'})
    return stock_nuevo - producto.stock_actual
