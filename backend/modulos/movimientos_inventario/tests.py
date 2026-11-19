from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections, connection, connections
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from modulos.productos.models import Categoria, Producto
from modulos.proveedores.models import Proveedor

from .models import MovimientoInventario

MOVIMIENTOS = '/api/movimientos-inventario/'
PRODUCTOS = '/api/productos/'
CSV = PRODUCTOS + 'importar-csv/'
VENTAS = '/api/ventas/'


def autenticado(usuario):
    cliente = APIClient()
    cliente.force_authenticate(usuario)
    return cliente


def producto_base(codigo, stock=0):
    categoria, _ = Categoria.objects.get_or_create(nombre='Abarrotes')
    proveedor, _ = Proveedor.objects.get_or_create(nombre='Proveedor')
    return Producto.objects.create(
        nombre=codigo, codigo=codigo, precio=Decimal('10.00'), costo=Decimal('5.00'),
        categoria=categoria, proveedor=proveedor, stock_actual=stock,
    )


def importar(cliente, filas):
    cabecera = 'nombre,codigo,costo,precio,categoria,proveedor,cantidad\n'
    archivo = SimpleUploadedFile('proveedor.csv', (cabecera + filas).encode(), 'text/csv')
    return cliente.post(CSV, {'archivo': archivo}, format='multipart')


class MovimientosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        usuarios = get_user_model().objects
        cls.admin = usuarios.create_user(username='admin', first_name='Ana', is_staff=True)
        cls.cajero = usuarios.create_user(username='caja')
        cls.cajero.groups.add(Group.objects.create(name='Cajero'))
        cls.producto = producto_base('ARROZ', stock=4)

    def setUp(self):
        self.api = autenticado(self.admin)
        self.ruta_producto = f'{PRODUCTOS}{self.producto.pk}/'

    def movimiento(self, tipo, **campos):
        return self.api.post(MOVIMIENTOS, {
            'producto': self.producto.pk, 'tipo_movimiento': tipo, 'motivo': 'Conteo',
            **campos,
        }, format='json')

    def test_historial_muestra_los_cuatro_tipos_y_responsables(self):
        for tipo, campos in (
            ('ingreso', {'cantidad': 3}),
            ('ajuste', {'cantidad': -2}),
            ('cambio_precio', {'precio_nuevo': '12.50'}),
        ):
            respuesta = self.movimiento(tipo, **campos)
            self.assertEqual(respuesta.status_code, 201, respuesta.data)

        respuesta = autenticado(self.cajero).post(VENTAS, {
            'detalles': [{'producto': self.producto.pk, 'cantidad': 1}],
        }, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        historial = self.api.get(MOVIMIENTOS).data
        self.assertEqual([m['tipo_movimiento'] for m in historial], [
            'venta', 'cambio_precio', 'ajuste', 'ingreso',
        ])
        self.assertEqual([m['producto_nombre'] for m in historial], ['ARROZ'] * 4)
        self.assertEqual([m['usuario_nombre'] for m in historial], ['caja', 'Ana', 'Ana', 'Ana'])
        self.assertEqual([(m['stock_anterior'], m['stock_resultante']) for m in historial], [
            (5, 4), (5, 5), (7, 5), (4, 7),
        ])
        self.assertIsNotNone(historial[0]['detalle_venta'])
        self.assertEqual(historial[1]['precio_anterior'], '10.00')
        self.assertEqual(historial[1]['precio_nuevo'], '12.50')
        self.assertIsNone(historial[1]['cantidad'])

    def test_permisos_y_ventas_solo_automaticas(self):
        datos = {'producto': self.producto.pk, 'tipo_movimiento': 'ingreso',
                 'cantidad': 1, 'motivo': 'Compra'}
        cajero = autenticado(self.cajero)
        self.assertEqual(cajero.get(MOVIMIENTOS).status_code, 200)
        self.assertEqual(cajero.post(MOVIMIENTOS, datos, format='json').status_code, 403)
        self.assertEqual(APIClient().get(MOVIMIENTOS).status_code, 403)
        self.assertEqual(self.movimiento('venta', cantidad=1).status_code, 400)
        self.assertFalse(MovimientoInventario.objects.exists())

    def test_operaciones_invalidas_no_modifican_producto(self):
        for tipo, campos in (
            ('ingreso', {'cantidad': 0}),
            ('ajuste', {'cantidad': -5}),
            ('cambio_precio', {'precio_nuevo': '10.00'}),
        ):
            self.assertEqual(self.movimiento(tipo, **campos).status_code, 400)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 4)
        self.assertEqual(self.producto.precio, Decimal('10.00'))
        self.assertFalse(MovimientoInventario.objects.exists())

    def test_alta_y_edicion_de_productos(self):
        datos = {
            'nombre': 'Leche', 'codigo': 'LEC', 'costo': '5.00', 'precio': '10.00',
            'categoria': self.producto.categoria_id, 'proveedor': self.producto.proveedor_id,
            'stock_actual': 3,
        }
        creado = self.api.post(PRODUCTOS, datos, format='json')
        self.assertEqual(creado.status_code, 201, creado.data)
        pk = creado.data['id']
        inicial = MovimientoInventario.objects.get(producto_id=pk)
        self.assertEqual((inicial.tipo_movimiento, inicial.stock_anterior, inicial.stock_resultante),
                         ('ingreso', 0, 3))
        ruta = f'{PRODUCTOS}{pk}/'
        self.assertEqual(self.api.patch(ruta, {'precio': '11.00'}, format='json').status_code, 200)
        self.assertEqual(self.api.patch(ruta, {'precio': '11.00'}, format='json').status_code, 200)
        precio = MovimientoInventario.objects.get(producto_id=pk, tipo_movimiento='cambio_precio')
        self.assertEqual((precio.precio_anterior, precio.precio_nuevo), (Decimal('10'), Decimal('11')))
        datos.update(codigo='VAC', stock_actual=0)
        vacio = self.api.post(PRODUCTOS, datos, format='json')
        self.assertEqual(vacio.status_code, 201, vacio.data)
        self.assertFalse(MovimientoInventario.objects.filter(producto_id=vacio.data['id']).exists())

    def test_stock_no_se_puede_modificar_desde_productos(self):
        respuesta = self.api.patch(self.ruta_producto, {'stock_actual': 20}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('stock_actual', respuesta.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 4)

    def test_protege_borrado_con_existencias_o_historial(self):
        self.assertEqual(self.api.delete(self.ruta_producto).status_code, 409)
        self.assertEqual(self.movimiento('ajuste', cantidad=-4).status_code, 201)
        self.assertEqual(self.api.delete(self.ruta_producto).status_code, 409)
        vacio = producto_base('VACIO')
        self.assertEqual(self.api.delete(f'{PRODUCTOS}{vacio.pk}/').status_code, 204)

    def test_csv_registra_existencias_y_precios_que_cambian(self):
        respuesta = importar(self.api, (
            'ARROZ,ARROZ,5.00,12.00,Abarrotes,Proveedor,3\n'
            'FRIJOL,FRI,5.00,9.00,Abarrotes,Proveedor,2\n'
            'ARROZ,ARROZ,5.10,12.00,Abarrotes,Proveedor,0\n'
        ))
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual((respuesta.data['creados'], respuesta.data['actualizados']), (1, 2))
        self.producto.refresh_from_db()
        self.assertEqual((self.producto.stock_actual, self.producto.precio), (7, Decimal('12')))
        movimientos = MovimientoInventario.objects.order_by('pk')
        self.assertEqual(list(movimientos.values_list('tipo_movimiento', 'stock_anterior', 'stock_resultante')),
                         [('ingreso', 4, 7), ('cambio_precio', 7, 7), ('ingreso', 0, 2), ('cambio_costo', 7, 7)])
        self.assertTrue(all(m.usuario_id == self.admin.pk and 'proveedor.csv' in m.motivo for m in movimientos))

    def test_ajuste_absoluto_y_deteccion_de_stock_desactualizado(self):
        respuesta = self.movimiento('ajuste', stock_nuevo=7, stock_esperado=4)
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual((respuesta.data['cantidad'], respuesta.data['stock_resultante']), (3, 7))
        self.assertEqual(self.movimiento('ajuste', stock_nuevo=10, stock_esperado=4).status_code, 400)
        self.assertEqual(self.movimiento('ajuste', stock_nuevo=7, stock_esperado=7).status_code, 400)
        self.assertEqual(MovimientoInventario.objects.count(), 1)

    def test_cambios_manuales_guardan_valores_independientes_y_nombres_historicos(self):
        proveedor = Proveedor.objects.create(nombre='Distribuidor nuevo')
        categoria = Categoria.objects.create(nombre='Categoría nueva')
        casos = [
            ('cambio_costo', {'costo_nuevo': '6.25'}, ('5.00', '6.25')),
            ('cambio_proveedor', {'proveedor_nuevo': proveedor.pk}, ('Proveedor', 'Distribuidor nuevo')),
            ('cambio_categoria', {'categoria_nueva': categoria.pk}, ('Abarrotes', 'Categoría nueva')),
        ]
        for tipo, campos, valores in casos:
            respuesta = self.movimiento(tipo, **campos)
            self.assertEqual(respuesta.status_code, 201, respuesta.data)
            self.assertEqual((respuesta.data['valor_anterior'], respuesta.data['valor_nuevo']), valores)
            self.assertEqual((respuesta.data['stock_anterior'], respuesta.data['stock_resultante']), (4, 4))
            self.assertIsNone(respuesta.data['cantidad'])
            self.assertEqual(self.movimiento(tipo, **campos).status_code, 400)

        for modelo, anterior, nuevo in (
            (Proveedor, self.producto.proveedor_id, proveedor.pk),
            (Categoria, self.producto.categoria_id, categoria.pk),
        ):
            modelo.objects.filter(pk=anterior).update(nombre='Anterior renombrado')
            modelo.objects.filter(pk=nuevo).update(nombre='Nuevo renombrado')
        historial = {m['tipo_movimiento']: m for m in self.api.get(MOVIMIENTOS).data}
        for tipo, _, valores in casos:
            self.assertEqual((historial[tipo]['valor_anterior'], historial[tipo]['valor_nuevo']), valores)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.precio, Decimal('10.00'))
        self.assertEqual((self.producto.costo, self.producto.stock_actual), (Decimal('6.25'), 4))
        self.assertEqual((self.producto.proveedor_id, self.producto.categoria_id), (proveedor.pk, categoria.pk))
        precio = self.movimiento('cambio_precio', precio_nuevo='11.00')
        self.assertEqual(precio.status_code, 201, precio.data)
        self.producto.refresh_from_db()
        self.assertEqual((self.producto.costo, self.producto.stock_actual), (Decimal('6.25'), 4))

    def test_productos_audita_stock_costo_proveedor_y_categoria(self):
        proveedor = Proveedor.objects.create(nombre='Distribuidor nuevo')
        categoria = Categoria.objects.create(nombre='Categoría nueva')
        cambios = {'stock_nuevo': 2, 'stock_esperado': 4, 'costo': '5.25',
                   'proveedor': proveedor.pk, 'categoria': categoria.pk}
        respuesta = self.api.patch(self.ruta_producto, cambios, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['stock_actual'], 2)
        self.assertEqual(respuesta.data['precio'], '10.00')
        self.assertCountEqual(MovimientoInventario.objects.values_list('tipo_movimiento', flat=True), [
            'ajuste', 'cambio_costo', 'cambio_proveedor', 'cambio_categoria',
        ])
        cambios['stock_esperado'] = 2
        self.assertEqual(self.api.patch(self.ruta_producto, cambios, format='json').status_code, 200)
        self.assertEqual(MovimientoInventario.objects.count(), 4)

    def test_csv_audita_categoria_y_proveedor_y_omite_repeticiones(self):
        fila = 'ARROZ,ARROZ,5.00,10.00,Otra categoría,Otro proveedor,0\n'
        respuesta = importar(self.api, fila + fila)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        historial = {m.tipo_movimiento: m for m in MovimientoInventario.objects.all()}
        self.assertEqual(set(historial), {'cambio_proveedor', 'cambio_categoria'})
        self.assertEqual(historial['cambio_categoria'].valor_nuevo, 'Otra categoría')
        self.assertEqual(historial['cambio_proveedor'].valor_nuevo, 'Otro proveedor')

    def test_movimientos_historicos_no_se_pueden_editar_ni_eliminar(self):
        respuesta = self.movimiento('ajuste', stock_nuevo=5)
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        ruta = f"{MOVIMIENTOS}{respuesta.data['id_movimiento']}/"
        self.assertEqual(self.api.patch(ruta, {'motivo': 'Otro'}, format='json').status_code, 405)
        self.assertEqual(self.api.delete(ruta).status_code, 405)
        self.assertEqual(MovimientoInventario.objects.get().motivo, 'Conteo')

    def test_csv_revierte_cambios_si_las_existencias_exceden_el_limite(self):
        Producto.objects.filter(pk=self.producto.pk).update(stock_actual=2**31 - 1)
        respuesta = importar(self.api, (
            'FRIJOL,FRI,5.00,9.00,Abarrotes,Proveedor,2\n'
            'ARROZ,ARROZ,5.00,12.00,Abarrotes,Proveedor,1\n'
        ))
        self.assertEqual(respuesta.status_code, 400)
        self.assertFalse(Producto.objects.filter(codigo='FRI').exists())
        self.assertFalse(MovimientoInventario.objects.exists())


@skipUnless(connection.vendor == 'postgresql', 'Requiere PostgreSQL.')
class InventarioConcurrenteTests(TransactionTestCase):
    def test_venta_e_importacion_con_productos_en_orden_opuesto(self):
        a = producto_base('A', stock=5)
        b = producto_base('B', stock=5)
        admin = get_user_model().objects.create_user(username='admin', is_staff=True)
        barrera = Barrier(2)

        def ejecutar(operacion):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout TO '10s'")
                barrera.wait(timeout=10)
                return operacion(autenticado(admin)).status_code
            finally:
                connections.close_all()

        def venta(cliente):
            return cliente.post(VENTAS, {
                'detalles': [{'producto': a.pk, 'cantidad': 1}, {'producto': b.pk, 'cantidad': 1}],
            }, format='json')

        def csv(cliente):
            return importar(cliente, 'B,B,5,10,Abarrotes,Proveedor,2\nA,A,5,10,Abarrotes,Proveedor,2\n')

        with ThreadPoolExecutor(max_workers=2) as pool:
            tareas = [pool.submit(ejecutar, operacion) for operacion in (venta, csv)]
            self.assertEqual([tarea.result(timeout=20) for tarea in tareas], [201, 200])
        for producto in (a, b):
            producto.refresh_from_db()
            self.assertEqual(producto.stock_actual, 6)
            primero, segundo = MovimientoInventario.objects.filter(producto=producto).order_by('pk')
            self.assertEqual(primero.stock_anterior, 5)
            self.assertEqual(primero.stock_resultante, segundo.stock_anterior)
            self.assertEqual(segundo.stock_resultante, 6)
