import io
import csv
from decimal import Decimal
from django.db import transaction
from django.db.models import F
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser

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


class ImportarCSVProductosView(APIView):
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
        errores_filas = []

        # Cache de categorías y proveedores existentes
        categorias_cache = {c.nombre.lower().strip(): c for c in Categoria.objects.all()}
        proveedores_cache = {p.nombre.lower().strip(): p for p in Proveedor.objects.all()}

        with transaction.atomic():
            for num_fila, fila in enumerate(lector, start=2):
                nombre_raw = limpiar_texto(fila.get(col_nombre))
                if es_nulo(nombre_raw):
                    omitidos += 1
                    continue

                codigo_raw = limpiar_texto(fila.get(col_codigo)) if col_codigo else ''
                # Si no trae código, usamos un código derivado del nombre limpio
                if es_nulo(codigo_raw):
                    codigo_raw = f"GEN-{hash(nombre_raw) & 0xFFFFFFFF:08X}"

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
                    cantidad_val = int(float(cant_raw.replace(',', '').strip())) if not es_nulo(cant_raw) else 0
                    minima_val = int(float(min_raw.replace(',', '').strip())) if not es_nulo(min_raw) else 5

                    if costo_val <= 0 or precio_val <= 0:
                        omitidos += 1
                        continue
                    if cantidad_val < 0 or minima_val < 0:
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

                # 3. Verificar si el producto ya existe (por código o por nombre exacto)
                producto_existente = Producto.objects.filter(codigo=codigo_raw).first()
                if not producto_existente:
                    producto_existente = Producto.objects.filter(nombre__iexact=nombre_raw).first()

                if producto_existente:
                    # Si ya existe, se suma la cantidad (stock) y se actualizan costo y precio recientes
                    producto_existente.stock_actual = F('stock_actual') + cantidad_val
                    producto_existente.costo = costo_val
                    producto_existente.precio = precio_val
                    producto_existente.categoria = categoria_obj
                    producto_existente.proveedor = proveedor_obj
                    if minima_val > 0:
                        producto_existente.stock_minimo = minima_val
                    producto_existente.save(update_fields=['stock_actual', 'costo', 'precio', 'categoria', 'proveedor', 'stock_minimo'])
                    actualizados += 1
                else:
                    # Crear nuevo producto
                    Producto.objects.create(
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
                    creados += 1

        return Response({
            'mensaje': 'Importación procesada con éxito.',
            'creados': creados,
            'actualizados': actualizados,
            'omitidos': omitidos,
            'total_procesadas': creados + actualizados + omitidos
        }, status=status.HTTP_200_OK)
