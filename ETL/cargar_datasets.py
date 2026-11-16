import os
import sys
import io
import csv
import urllib.request
from decimal import Decimal
from pathlib import Path

# Configurar Django para poder usar los modelos
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.db import transaction
from modulos.productos.models import Categoria, Producto
from modulos.proveedores.models import Proveedor

URL_CATEGORIAS = 'https://huggingface.co/datasets/Kendallch33/Categorias_Dataset/raw/main/Dataset_Categorias.csv'
URL_PROVEEDORES = 'https://huggingface.co/datasets/Kendallch33/Provedores_Dataset/raw/main/dataset_provedores.csv'
URL_PRODUCTOS = 'https://huggingface.co/datasets/Kendallch33/Productos_Dataset/raw/main/Dataset_productos.csv'

def descargar_csv(url):
    print(f"Descargando: {url} ...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        contenido = resp.read().decode('utf-8', errors='ignore')
    return list(csv.DictReader(io.StringIO(contenido)))

def es_nulo_o_vacio(valor):
    if valor is None:
        return True
    val = str(valor).strip().lower()
    return val in ('', 'null', 'none', 'nan')

def cargar_categorias(datos):
    print("\n--- Procesando Categorías ---")
    mapa_categorias = {} # id_csv -> Categoria instance
    total_filas = len(datos)
    descartadas = 0
    insertadas = 0

    for fila in datos:
        id_csv = fila.get('id', '').strip()
        nombre = fila.get('nombre', '').strip()
        descripcion = fila.get('descripcion', '').strip() if fila.get('descripcion') else ''

        # Limpieza: Si nombre o id vienen nulos o vacíos, se descarta
        if es_nulo_o_vacio(nombre) or es_nulo_o_vacio(id_csv):
            descartadas += 1
            continue

        categoria, _ = Categoria.objects.update_or_create(
            nombre=nombre,
            defaults={'descripcion': descripcion}
        )
        mapa_categorias[id_csv] = categoria
        insertadas += 1

    print(f"Total en dataset: {total_filas}")
    print(f"Descartadas por valores nulos: {descartadas}")
    print(f"Categorías listas en BD: {insertadas}")
    return mapa_categorias

def cargar_proveedores(datos):
    print("\n--- Procesando Proveedores ---")
    mapa_proveedores = {} # id_csv -> Proveedor instance
    total_filas = len(datos)
    descartadas = 0
    insertadas = 0

    for fila in datos:
        id_csv = fila.get('id', '').strip()
        nombre = fila.get('nombre', '').strip()
        telefono = fila.get('telefono', '').strip() if fila.get('telefono') else ''
        email = fila.get('email', '').strip() if fila.get('email') else ''
        direccion = fila.get('direccion', '').strip() if fila.get('direccion') else ''

        # Limpieza: Si el nombre o id es nulo o vacío
        if es_nulo_o_vacio(nombre) or es_nulo_o_vacio(id_csv):
            descartadas += 1
            continue

        # Si el email es nulo/vacío o 'null', lo dejamos vacío para no fallar validaciones
        if es_nulo_o_vacio(email):
            email = ''

        proveedor, _ = Proveedor.objects.update_or_create(
            nombre=nombre,
            defaults={
                'telefono': telefono if not es_nulo_o_vacio(telefono) else '',
                'correo': email,
                'direccion': direccion if not es_nulo_o_vacio(direccion) else '',
            }
        )
        mapa_proveedores[id_csv] = proveedor
        insertadas += 1

    print(f"Total en dataset: {total_filas}")
    print(f"Descartadas por valores nulos: {descartadas}")
    print(f"Proveedores listos en BD: {insertadas}")
    return mapa_proveedores

def cargar_productos(datos, mapa_categorias, mapa_proveedores):
    print("\n--- Procesando Productos ---")
    total_filas = len(datos)
    descartadas_nulos = 0
    descartadas_fk = 0
    insertadas = 0

    # Guardar productos preparados para bulk_create o inserción segura
    productos_a_crear = []
    codigos_vistos = set(Producto.objects.values_list('codigo', flat=True))

    for fila in datos:
        nombre = fila.get('nombre', '').strip()
        codigo = fila.get('codigo', '').strip()
        costo_str = fila.get('costo', '').strip()
        precio_str = fila.get('precio', '').strip()
        stock_act_str = fila.get('stock_actual', '').strip()
        stock_min_str = fila.get('stock_minimo', '').strip()
        estado_str = fila.get('estado', '').strip()
        cat_id_csv = fila.get('categoria_id', '').strip()
        prov_id_csv = fila.get('proveedor_id', '').strip()

        # Validación de campos requeridos no nulos
        if any(es_nulo_o_vacio(x) for x in [nombre, codigo, costo_str, precio_str, stock_act_str, stock_min_str, estado_str, cat_id_csv, prov_id_csv]):
            descartadas_nulos += 1
            continue

        # Verificar integridad referencial (claves foráneas)
        categoria = mapa_categorias.get(cat_id_csv)
        proveedor = mapa_proveedores.get(prov_id_csv)

        if not categoria or not proveedor:
            descartadas_fk += 1
            continue

        try:
            costo = Decimal(costo_str)
            precio = Decimal(precio_str)
            stock_actual = int(float(stock_act_str))
            stock_minimo = int(float(stock_min_str))
            estado = estado_str.lower() in ('true', '1', 't', 'yes')

            if costo <= 0 or precio <= 0 or stock_actual < 0 or stock_minimo < 0:
                descartadas_nulos += 1
                continue
        except Exception:
            descartadas_nulos += 1
            continue

        # Evitar códigos duplicados en el lote
        if codigo in codigos_vistos:
            continue
        codigos_vistos.add(codigo)

        productos_a_crear.append(
            Producto(
                nombre=nombre,
                codigo=codigo,
                costo=costo,
                precio=precio,
                stock_actual=stock_actual,
                stock_minimo=stock_minimo,
                estado=estado,
                categoria=categoria,
                proveedor=proveedor
            )
        )

    with transaction.atomic():
        Producto.objects.bulk_create(productos_a_crear, batch_size=500)
    insertadas = len(productos_a_crear)

    print(f"Total en dataset: {total_filas}")
    print(f"Descartadas por valores nulos/inválidos: {descartadas_nulos}")
    print(f"Descartadas por claves foráneas inexistentes: {descartadas_fk}")
    print(f"Productos insertados en BD: {insertadas}")

def main():
    print("Iniciando proceso ETL desde Hugging Face...")
    datos_cat = descargar_csv(URL_CATEGORIAS)
    datos_prov = descargar_csv(URL_PROVEEDORES)
    datos_prod = descargar_csv(URL_PRODUCTOS)

    mapa_cat = cargar_categorias(datos_cat)
    mapa_prov = cargar_proveedores(datos_prov)
    cargar_productos(datos_prod, mapa_cat, mapa_prov)
    print("\nProceso ETL completado con éxito.")

if __name__ == '__main__':
    main()
