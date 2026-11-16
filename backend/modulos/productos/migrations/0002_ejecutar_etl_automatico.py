import io
import csv
import urllib.request
from decimal import Decimal
from django.db import migrations

URL_CATEGORIAS = 'https://huggingface.co/datasets/Kendallch33/Categorias_Dataset/raw/main/Dataset_Categorias.csv'
URL_PROVEEDORES = 'https://huggingface.co/datasets/Kendallch33/Provedores_Dataset/raw/main/dataset_provedores.csv'
URL_PRODUCTOS = 'https://huggingface.co/datasets/Kendallch33/Productos_Dataset/raw/main/Dataset_productos.csv'


def es_nulo_o_vacio(valor):
    if valor is None:
        return True
    val = str(valor).strip().lower()
    return val in ('', 'null', 'none', 'nan')


def descargar_csv(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        contenido = resp.read().decode('utf-8', errors='ignore')
    return list(csv.DictReader(io.StringIO(contenido)))


def ejecutar_etl_automatico(apps, schema_editor):
    Categoria = apps.get_model('productos', 'Categoria')
    Producto = apps.get_model('productos', 'Producto')
    Proveedor = apps.get_model('proveedores', 'Proveedor')

    # Si ya existen productos, no volvemos a descargar ni a insertar para ser eficientes
    if Producto.objects.exists():
        return

    try:
        datos_cat = descargar_csv(URL_CATEGORIAS)
        datos_prov = descargar_csv(URL_PROVEEDORES)
        datos_prod = descargar_csv(URL_PRODUCTOS)
    except Exception as e:
        print(f"\n[Aviso ETL] No se pudo conectar a Hugging Face para descargar datasets ({e}).")
        return

    # 1. Categorías
    mapa_categorias = {}
    for fila in datos_cat:
        id_csv = fila.get('id', '').strip()
        nombre = fila.get('nombre', '').strip()
        descripcion = fila.get('descripcion', '').strip() if fila.get('descripcion') else ''

        if es_nulo_o_vacio(nombre) or es_nulo_o_vacio(id_csv):
            continue

        cat, _ = Categoria.objects.get_or_create(
            nombre=nombre,
            defaults={'descripcion': descripcion}
        )
        mapa_categorias[id_csv] = cat

    # 2. Proveedores
    mapa_proveedores = {}
    for fila in datos_prov:
        id_csv = fila.get('id', '').strip()
        nombre = fila.get('nombre', '').strip()
        telefono = fila.get('telefono', '').strip() if fila.get('telefono') else ''
        email = fila.get('email', '').strip() if fila.get('email') else ''
        direccion = fila.get('direccion', '').strip() if fila.get('direccion') else ''

        if es_nulo_o_vacio(nombre) or es_nulo_o_vacio(id_csv):
            continue

        prov, _ = Proveedor.objects.get_or_create(
            nombre=nombre,
            defaults={
                'telefono': telefono if not es_nulo_o_vacio(telefono) else '',
                'correo': email if not es_nulo_o_vacio(email) else '',
                'direccion': direccion if not es_nulo_o_vacio(direccion) else '',
            }
        )
        mapa_proveedores[id_csv] = prov

    # 3. Productos
    productos_a_crear = []
    codigos_vistos = set(Producto.objects.values_list('codigo', flat=True))

    for fila in datos_prod:
        nombre = fila.get('nombre', '').strip()
        codigo = fila.get('codigo', '').strip()
        costo_str = fila.get('costo', '').strip()
        precio_str = fila.get('precio', '').strip()
        stock_act_str = fila.get('stock_actual', '').strip()
        stock_min_str = fila.get('stock_minimo', '').strip()
        estado_str = fila.get('estado', '').strip()
        cat_id_csv = fila.get('categoria_id', '').strip()
        prov_id_csv = fila.get('proveedor_id', '').strip()

        # Filtrar filas sucias o con valores nulos
        if any(es_nulo_o_vacio(x) for x in [nombre, codigo, costo_str, precio_str, stock_act_str, stock_min_str, estado_str, cat_id_csv, prov_id_csv]):
            continue

        categoria = mapa_categorias.get(cat_id_csv)
        proveedor = mapa_proveedores.get(prov_id_csv)

        if not categoria or not proveedor:
            continue

        try:
            costo = Decimal(costo_str)
            precio = Decimal(precio_str)
            stock_actual = int(float(stock_act_str))
            stock_minimo = int(float(stock_min_str))
            estado = estado_str.lower() in ('true', '1', 't', 'yes')

            if costo <= 0 or precio <= 0 or stock_actual < 0 or stock_minimo < 0:
                continue
        except Exception:
            continue

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

    if productos_a_crear:
        Producto.objects.bulk_create(productos_a_crear, batch_size=500)


def revertir(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0001_initial'),
        ('proveedores', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(ejecutar_etl_automatico, revertir),
    ]
