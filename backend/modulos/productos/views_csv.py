import io
import csv
from decimal import Decimal, ROUND_HALF_UP
from django.db import connection, transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser

from modulos.movimientos_inventario.errores import ManejarErroresMovimientos
from modulos.movimientos_inventario.servicios import (
    registrar_atributo, registrar_existencias, registrar_stock_inicial,
)

from .models import Categoria, Producto
from modulos.proveedores.models import Proveedor


def limpiar_texto(valor):
    if valor is None:
        return ''
    return str(valor).strip()


def es_nulo(valor):
    if valor is None:
        return True
    val = str(valor).strip().lower()
    return val in ('', 'null', 'none', 'nan')


def buscar_producto(nombre, codigo):
    return (
        Producto.objects.filter(codigo=codigo).first()
        or Producto.objects.filter(nombre__iexact=nombre).first()
    )


class ImportarCSVProductosView(ManejarErroresMovimientos, APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response(
                {'detail': 'No se proporcionó ningún archivo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not archivo.name.lower().endswith('.csv'):
            return Response(
                {'detail': 'El archivo debe tener extensión .csv'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            contenido = archivo.read().decode('utf-8-sig', errors='replace')
        except Exception:
            return Response(
                {'detail': 'No se pudo leer el archivo. Verificá que la codificación sea UTF-8.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        lector = csv.DictReader(io.StringIO(contenido))
        if not lector.fieldnames:
            return Response(
                {'detail': 'El archivo CSV está vacío o sin encabezados válidos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mapear columnas de forma flexible (ignorar mayúsculas, espacios, tildes comunes)
        columnas_map = {}
        for col in lector.fieldnames:
            col_norm = col.strip().lower().replace(' ', '_').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
            columnas_map[col_norm] = col

        # Identificar las columnas requeridas
        # Atributos: nombre, codigo (opcional si viene o autogenerar/buscar por codigo/nombre), precio, costo, categoria, proveedor, cantidad (stock_actual), cantidad_minima (stock_minimo)
        def buscar_col(*posibles):
            for p in posibles:
                for k, v in columnas_map.items():
                    if k == p:
                        return v
            return None

        col_nombre = buscar_col('nombre', 'producto', 'name')
        col_codigo = buscar_col('codigo', 'code', 'codigo_de_barras', 'sku')
        col_precio = buscar_col('precio', 'price', 'precio_venta')
        col_costo = buscar_col('costo', 'cost', 'precio_costo')
        col_categoria = buscar_col('categoria', 'category', 'categoria_nombre')
        col_proveedor = buscar_col('proveedor', 'provedor', 'supplier', 'provider')
        col_cantidad = buscar_col('cantidad', 'stock', 'stock_actual', 'existencias')
        col_minima = buscar_col('cantidad_minima', 'stock_minimo', 'minimo', 'min_stock')

        faltantes = []
        if not col_nombre: faltantes.append('nombre')
        if not col_precio: faltantes.append('precio')
        if not col_costo: faltantes.append('costo')
        if not col_categoria: faltantes.append('categoria')
        if not col_proveedor: faltantes.append('proveedor / provedor')

        if faltantes:
            return Response(
                {
                    'detail': f"Faltan columnas requeridas en el CSV: {', '.join(faltantes)}. Las columnas esperadas son: nombre, codigo (opcional), costo, precio, categoria, proveedor, cantidad, cantidad_minima."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        creados = 0
        actualizados = 0
        omitidos = 0
        filas = []
        for fila in lector:
            nombre = limpiar_texto(fila.get(col_nombre))
            if es_nulo(nombre):
                omitidos += 1
                continue
            codigo = limpiar_texto(fila.get(col_codigo)) if col_codigo else ''
            if es_nulo(codigo):
                codigo = f"GEN-{hash(nombre) & 0xFFFFFFFF:08X}"
            filas.append((fila, nombre, codigo))

        categorias_cache = {c.nombre.lower().strip(): c for c in Categoria.objects.all()}
        proveedores_cache = {p.nombre.lower().strip(): p for p in Proveedor.objects.all()}
        motivo = f'Importación CSV: {archivo.name}'

        with transaction.atomic():
            # Los CSV se serializan entre sí para coordinar las filas que crean productos.
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(%s, %s)', [17041, 1])

            ids = {
                producto.pk
                for nombre, codigo in {(nombre, codigo) for _, nombre, codigo in filas}
                if (producto := buscar_producto(nombre, codigo)) is not None
            }
            # Usar el mismo orden de bloqueo que emplea el registro de ventas.
            list(Producto.objects.select_for_update().filter(pk__in=ids).order_by('pk'))

            for fila, nombre_raw, codigo_raw in filas:
                costo_raw = limpiar_texto(fila.get(col_costo))
                precio_raw = limpiar_texto(fila.get(col_precio))
                cat_raw = limpiar_texto(fila.get(col_categoria))
                prov_raw = limpiar_texto(fila.get(col_proveedor))
                cant_raw = limpiar_texto(fila.get(col_cantidad)) if col_cantidad else '0'
                min_raw = limpiar_texto(fila.get(col_minima)) if col_minima else '5'

                if es_nulo(costo_raw) or es_nulo(precio_raw) or es_nulo(cat_raw) or es_nulo(prov_raw):
                    omitidos += 1
                    continue

                try:
                    costo_val = Decimal(costo_raw.replace('$', '').replace('₡', '').replace(',', '').strip())
                    precio_val = Decimal(precio_raw.replace('$', '').replace('₡', '').replace(',', '').strip())
                    costo_val = costo_val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    precio_val = precio_val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    cantidad_val = int(float(cant_raw.replace(',', '').strip())) if not es_nulo(cant_raw) else 0
                    minima_val = int(float(min_raw.replace(',', '').strip())) if not es_nulo(min_raw) else 5

                    if not (0 < costo_val <= Decimal('99999999.99') and 0 < precio_val <= Decimal('99999999.99')):
                        omitidos += 1
                        continue
                    if not (0 <= cantidad_val <= 2**31 - 1 and 0 <= minima_val <= 2**31 - 1):
                        omitidos += 1
                        continue
                except Exception:
                    omitidos += 1
                    continue

                # 1. Obtener o crear Categoría
                cat_key = cat_raw.lower()
                categoria_obj = categorias_cache.get(cat_key)
                if not categoria_obj:
                    categoria_obj, _ = Categoria.objects.get_or_create(nombre=cat_raw)
                    categorias_cache[cat_key] = categoria_obj

                # 2. Obtener o crear Proveedor
                prov_key = prov_raw.lower()
                proveedor_obj = proveedores_cache.get(prov_key)
                if not proveedor_obj:
                    proveedor_obj, _ = Proveedor.objects.get_or_create(nombre=prov_raw)
                    proveedores_cache[prov_key] = proveedor_obj

                producto_existente = buscar_producto(nombre_raw, codigo_raw)
                if producto_existente:
                    producto_existente = Producto.objects.select_for_update().get(pk=producto_existente.pk)
                    if cantidad_val:
                        registrar_existencias(producto_existente, request.user, 'ingreso', cantidad_val, motivo)
                    for campo, valor in (
                        ('precio', precio_val), ('costo', costo_val),
                        ('categoria', categoria_obj), ('proveedor', proveedor_obj),
                    ):
                        registrar_atributo(producto_existente, request.user, campo, valor, motivo)
                    if minima_val > 0:
                        producto_existente.stock_minimo = minima_val
                        producto_existente.save(update_fields=['stock_minimo'])
                    actualizados += 1
                else:
                    # Crear nuevo producto
                    producto = Producto.objects.create(
                        nombre=nombre_raw,
                        codigo=codigo_raw,
                        costo=costo_val,
                        precio=precio_val,
                        stock_actual=cantidad_val,
                        stock_minimo=minima_val,
                        estado=True,
                        categoria=categoria_obj,
                        proveedor=proveedor_obj
                    )
                    registrar_stock_inicial(producto, request.user, motivo)
                    creados += 1

        return Response({
            'mensaje': 'Importación procesada con éxito.',
            'creados': creados,
            'actualizados': actualizados,
            'omitidos': omitidos,
            'total_procesadas': creados + actualizados + omitidos
        }, status=status.HTTP_200_OK)
