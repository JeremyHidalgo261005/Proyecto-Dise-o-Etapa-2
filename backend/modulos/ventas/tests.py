from datetime import datetime, timedelta, timezone as zona_utc
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from threading import Barrier
from unittest import skipUnless
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.db import close_old_connections, connection, connections
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from config.settings import obtener_hash_pin_ventas
from modulos.movimientos_inventario.models import MovimientoInventario
from modulos.productos.models import Categoria, Producto
from modulos.proveedores.models import Proveedor

from .models import DetalleVenta, Venta

VENTAS = '/api/ventas/'
AUTORIZAR = VENTAS + 'autorizar/'


def crear_producto(codigo, stock=5, precio='10.05'):
    categoria, _ = Categoria.objects.get_or_create(nombre='Abarrotes')
    proveedor, _ = Proveedor.objects.get_or_create(nombre='Proveedor de prueba')
    return Producto.objects.create(
        nombre=codigo, codigo=codigo, stock_actual=stock, precio=Decimal(precio),
        costo=Decimal('1.00'), categoria=categoria, proveedor=proveedor,
    )


def crear_cajero(nombre='caja'):
    grupo, _ = Group.objects.get_or_create(name='Cajero')
    usuario = get_user_model().objects.create_user(username=nombre, password='clave-pruebas')
    usuario.groups.add(grupo)
    return usuario


def cliente_de(usuario):
    cliente = APIClient()
    cliente.force_authenticate(user=usuario)
    return cliente


def solicitud(producto, cantidad=1, **campos):
    return {
        'clave_solicitud': str(uuid4()),
        'detalles': [{'producto': producto.pk, 'cantidad': cantidad}],
        'metodo_pago': 'efectivo',
        'dinero_aportado': '40.00',
        **campos,
    }


class ConfiguracionPinVentasTests(SimpleTestCase):
    def test_hash_en_dotenv_se_conserva_con_bom_y_variable_heredada_vacia(self):
        hash_prueba = make_password(str(uuid4()))
        with TemporaryDirectory() as directorio, patch.dict('os.environ', {'VENTAS_PIN_ADMIN_HASH': ' '}):
            archivo = Path(directorio) / '.env'
            archivo.write_text(f"VENTAS_PIN_ADMIN_HASH='{hash_prueba}'\n", encoding='utf-8-sig')
            self.assertTrue(obtener_hash_pin_ventas(archivo) == hash_prueba)

    def test_hash_no_vacio_del_entorno_tiene_prioridad(self):
        hash_prueba = make_password(str(uuid4()))
        with patch.dict('os.environ', {'VENTAS_PIN_ADMIN_HASH': hash_prueba}):
            self.assertTrue(obtener_hash_pin_ventas(Path('archivo-inexistente.env')) == hash_prueba)


@override_settings(VENTAS_PIN_ADMIN_HASH=make_password('pin-de-prueba'))
class RegistroVentaTests(TestCase):
    def setUp(self):
        cache.clear()
        self.cajero = crear_cajero()
        self.api = cliente_de(self.cajero)
        self.producto = crear_producto('ARROZ')

    def autorizar(self, porcentaje, clave):
        respuesta = self.api.post(AUTORIZAR, {
            'pin': 'pin-de-prueba', 'accion': 'descuento', 'porcentaje_descuento': porcentaje,
            'clave_solicitud': clave,
        }, format='json')
        self.assertEqual(respuesta.status_code, 200)
        return respuesta.data['autorizacion']

    def test_efectivo_guarda_venta_vuelto_y_movimiento(self):
        datos = solicitud(self.producto, 2, total_esperado='20.10')
        respuesta = self.api.post(VENTAS, datos, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['total'], '20.10')
        self.assertEqual(respuesta.data['vuelto'], '19.90')
        venta = Venta.objects.get()
        self.assertEqual(venta.usuario, self.cajero)
        detalle = venta.detalles.get()
        self.assertEqual(detalle.precio_unitario, Decimal('10.05'))
        self.assertEqual(detalle.subtotal, Decimal('20.10'))
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 3)
        movimiento = MovimientoInventario.objects.get()
        self.assertEqual(movimiento.detalle_venta, detalle)
        self.assertEqual(movimiento.tipo_movimiento, 'venta')
        self.assertEqual((movimiento.cantidad, movimiento.stock_anterior, movimiento.stock_resultante), (2, 5, 3))
        self.assertEqual(self.api.get(VENTAS + f'{venta.pk}/').data, respuesta.data)

    def test_tarjeta_con_descuento_redondeado_y_referencia(self):
        datos = solicitud(self.producto, metodo_pago='tarjeta',
                          referencia_tarjeta='AUT-594830', porcentaje_descuento='10.00',
                          total_esperado='9.04')
        datos['autorizacion'] = self.autorizar('10', datos['clave_solicitud'])
        del datos['dinero_aportado']
        respuesta = self.api.post(VENTAS, datos, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['descuento'], '1.01')
        self.assertEqual(respuesta.data['total'], '9.04')
        self.assertEqual(respuesta.data['referencia_tarjeta'], 'AUT-594830')
        self.assertIsNone(Venta.objects.get().dinero_aportado)

    def test_rechaza_referencia_con_numero_de_tarjeta(self):
        datos = solicitud(self.producto, metodo_pago='tarjeta', referencia_tarjeta='4111-1111-1111-1111')
        del datos['dinero_aportado']
        self.assertEqual(self.api.post(VENTAS, datos, format='json').status_code, 400)
        self.assertFalse(Venta.objects.exists())

    def test_pin_incorrecto_y_limite_de_intentos(self):
        datos = {'pin': 'incorrecto', 'porcentaje_descuento': '10', 'clave_solicitud': str(uuid4())}
        for _ in range(5):
            respuesta = self.api.post(AUTORIZAR, datos, format='json')
            self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(self.api.post(AUTORIZAR, datos, format='json').status_code, 429)

    def test_autorizacion_no_admite_eliminar_articulos(self):
        datos = {'accion': 'eliminar', 'pin': 'pin-de-prueba',
                 'porcentaje_descuento': '10', 'clave_solicitud': str(uuid4())}
        respuesta = self.api.post(AUTORIZAR, datos, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('accion', respuesta.data)

    def test_descuento_requiere_autorizacion_del_cajero_porcentaje_y_venta(self):
        base = solicitud(self.producto, porcentaje_descuento='10')
        token = self.autorizar('10', base['clave_solicitud'])
        otro = cliente_de(crear_cajero('otra-caja'))
        casos = [
            (self.api, base),
            (self.api, dict(base, porcentaje_descuento='20', autorizacion=token)),
            (self.api, dict(base, clave_solicitud=str(uuid4()), autorizacion=token)),
            (otro, dict(base, autorizacion=token)),
        ]
        for api, datos in casos:
            self.assertEqual(api.post(VENTAS, datos, format='json').status_code, 400)
        self.assertFalse(Venta.objects.exists())

    def test_reintento_devuelve_misma_venta_y_rechaza_uso_distinto_de_clave(self):
        datos = solicitud(self.producto)
        primera = self.api.post(VENTAS, datos, format='json')
        repetida = self.api.post(VENTAS, datos, format='json')
        self.assertEqual(primera.status_code, 201)
        self.assertEqual(repetida.status_code, 200)
        self.assertEqual(primera.data, repetida.data)
        datos['dinero_aportado'] = '45.00'
        self.assertEqual(self.api.post(VENTAS, datos, format='json').status_code, 409)
        self.assertEqual(Venta.objects.count(), 1)
        self.assertEqual(MovimientoInventario.objects.count(), 1)

    def test_linea_sin_stock_revierte_venta_completa(self):
        agotado = crear_producto('LECHE', stock=0)
        datos = solicitud(self.producto)
        datos['detalles'].append({'producto': agotado.pk, 'cantidad': 1})
        self.assertEqual(self.api.post(VENTAS, datos, format='json').status_code, 400)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, 5)
        for modelo in (Venta, DetalleVenta, MovimientoInventario):
            self.assertFalse(modelo.objects.exists())

    def test_precio_desactualizado_y_efectivo_insuficiente(self):
        vieja = solicitud(self.producto, total_esperado='10.00')
        insuficiente = solicitud(self.producto, dinero_aportado='1.00')
        self.assertEqual(self.api.post(VENTAS, vieja, format='json').status_code, 409)
        self.assertEqual(self.api.post(VENTAS, insuficiente, format='json').status_code, 400)
        self.assertFalse(Venta.objects.exists())

    def test_sesion_real_y_csrf(self):
        api = APIClient(enforce_csrf_checks=True)
        self.assertTrue(api.login(username='caja', password='clave-pruebas'))
        datos = solicitud(self.producto)
        self.assertEqual(api.post(VENTAS, datos, format='json').status_code, 403)
        token = api.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(api.post(VENTAS, datos, format='json', HTTP_X_CSRFTOKEN=token).status_code, 201)

    def test_formato_original_de_venta_sigue_funcionando(self):
        detalles = solicitud(self.producto)['detalles']
        respuesta = self.api.post(VENTAS, {'detalles': detalles}, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)


@skipUnless(connection.vendor == 'postgresql', 'Requiere bloqueos de filas de PostgreSQL.')
class VentasSimultaneasTests(TransactionTestCase):
    def ejecutar_simultaneas(self, primera, segunda):
        barrera = Barrier(2)

        def registrar(usuario, datos):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout TO '10s'")
                barrera.wait(timeout=10)
                return cliente_de(usuario).post(VENTAS, datos, format='json').status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            tareas = [ejecutor.submit(registrar, *operacion) for operacion in (primera, segunda)]
            return sorted(tarea.result(timeout=20) for tarea in tareas)

    def test_dos_cajas_no_venden_la_ultima_unidad(self):
        producto = crear_producto('ULTIMO', stock=1)
        a = crear_cajero('caja-a')
        b = crear_cajero('caja-b')
        self.assertEqual(self.ejecutar_simultaneas((a, solicitud(producto)), (b, solicitud(producto))), [201, 400])
        producto.refresh_from_db()
        self.assertEqual(producto.stock_actual, 0)
        self.assertEqual(Venta.objects.count(), 1)
        self.assertEqual(MovimientoInventario.objects.count(), 1)

    def test_carritos_en_orden_distinto(self):
        primero = crear_producto('PRIMERO', stock=2)
        segundo = crear_producto('SEGUNDO', stock=2)
        a = crear_cajero('caja-a')
        b = crear_cajero('caja-b')
        datos_a = solicitud(primero)
        datos_a['detalles'].append({'producto': segundo.pk, 'cantidad': 1})
        datos_b = solicitud(segundo, detalles=list(reversed(datos_a['detalles'])))
        self.assertEqual(self.ejecutar_simultaneas((a, datos_a), (b, datos_b)), [201, 201])
        self.assertEqual(list(Producto.objects.order_by('pk').values_list('stock_actual', flat=True)), [0, 0])
        self.assertEqual(MovimientoInventario.objects.count(), 4)

    def test_dos_solicitudes_con_la_misma_clave(self):
        producto = crear_producto('UNICO')
        cajero = crear_cajero()
        datos = solicitud(producto)
        self.assertEqual(self.ejecutar_simultaneas((cajero, datos), (cajero, datos)), [200, 201])
        self.assertEqual(Venta.objects.count(), 1)
        self.assertEqual(MovimientoInventario.objects.count(), 1)


class HistorialYDashboardTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cajero = crear_cajero('caja-historial')
        cls.cajero.first_name = 'Ana'
        cls.cajero.save(update_fields=['first_name'])
        cls.producto = crear_producto('HISTORIAL', stock=4)
        crear_producto('STOCK-NORMAL', stock=12)
        cls.justamente_hoy = datetime(2026, 11, 19, 6, tzinfo=zona_utc.utc)
        anterior = datetime(2026, 11, 19, 5, 59, tzinfo=zona_utc.utc)
        cls.ventas = []
        for indice in range(17):
            venta = Venta.objects.create(
                usuario=cls.cajero, metodo_pago='efectivo' if indice % 2 else 'tarjeta',
                total=Decimal('19.10'), descuento=Decimal('1.00'),
            )
            Venta.objects.filter(pk=venta.pk).update(fecha=cls.justamente_hoy if indice >= 13 else anterior)
            DetalleVenta.objects.create(
                venta=venta, producto=cls.producto, cantidad=2,
                precio_unitario=Decimal('10.05'), subtotal=Decimal('20.10'),
            )
            cls.ventas.append(venta)

    def setUp(self):
        self.api = cliente_de(self.cajero)
        self.historial = VENTAS + 'historial/'
        self.resumen = VENTAS + 'resumen/'

    def test_resumen_usa_datos_reales_tres_recientes_y_dia_de_costa_rica(self):
        from unittest.mock import patch
        with patch('modulos.ventas.views.timezone.now', return_value=self.justamente_hoy):
            respuesta = self.api.get(self.resumen)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['productos_registrados'], 2)
        self.assertEqual(respuesta.data['productos_stock_bajo'], 1)
        self.assertEqual(respuesta.data['unidades_inventario'], 16)
        self.assertEqual(respuesta.data['ventas_del_dia'], 4)
        self.assertEqual(respuesta.data['ventas_ayer'], 13)
        self.assertEqual(respuesta.data['productos_activos'], 2)
        self.assertEqual(respuesta.data['productos_agotados'], 0)
        self.assertEqual([v['id_venta'] for v in respuesta.data['ventas_recientes']],
                         [v.pk for v in self.ventas[-1:-4:-1]])

    def test_resumen_distingue_productos_activos_y_agotados_y_dias_sin_ventas(self):
        producto = crear_producto('AGOTADO-INACTIVO', stock=0)
        producto.estado = False
        producto.save(update_fields=['estado'])
        sin_ventas = self.justamente_hoy + timedelta(days=3)

        with patch('modulos.ventas.views.timezone.now', return_value=sin_ventas):
            respuesta = self.api.get(self.resumen)

        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['productos_registrados'], 3)
        self.assertEqual(respuesta.data['productos_activos'], 2)
        self.assertEqual(respuesta.data['productos_agotados'], 1)
        self.assertEqual(respuesta.data['ventas_del_dia'], 0)
        self.assertEqual(respuesta.data['ventas_ayer'], 0)

    def test_unidades_de_inventario_solo_suma_productos_activos(self):
        Producto.objects.filter(pk=self.producto.pk).update(estado=False)
        self.assertEqual(self.api.get(self.resumen).data['unidades_inventario'], 12)
        Producto.objects.update(estado=False)
        self.assertEqual(self.api.get(self.resumen).data['unidades_inventario'], 0)

    def test_historial_paginado_en_orden_estable(self):
        primera = self.api.get(self.historial)
        segunda = self.api.get(self.historial, {'page': 2})
        self.assertEqual(primera.status_code, 200, primera.data)
        self.assertEqual(segunda.status_code, 200, segunda.data)
        self.assertEqual(primera.data['count'], 17)
        self.assertEqual(len(primera.data['results']), 15)
        self.assertEqual(len(segunda.data['results']), 2)
        self.assertEqual(
            [v['id_venta'] for v in primera.data['results'] + segunda.data['results']],
            [v.pk for v in reversed(self.ventas)],
        )

    def test_factura_fecha_metodo_y_detalle(self):
        venta = self.ventas[-1]
        por_factura = self.api.get(self.historial, {'factura': f'FAC-{venta.pk}'})
        self.assertEqual(por_factura.status_code, 200, por_factura.data)
        self.assertEqual(por_factura.data['count'], 1)
        fila = por_factura.data['results'][0]
        self.assertEqual((fila['cajero'], fila['cantidad_articulos'], fila['subtotal'], fila['descuento'],
                          fila['total'], fila['metodo_pago']), ('Ana', 2, '20.10', '1.00', '19.10', 'tarjeta'))
        filtradas = self.api.get(self.historial, {'fecha': '2026-11-19', 'metodo_pago': 'tarjeta'})
        self.assertEqual(filtradas.status_code, 200, filtradas.data)
        self.assertEqual([v['id_venta'] for v in filtradas.data['results']], [self.ventas[i].pk for i in (16, 14)])
        detalle = self.api.get(VENTAS + f'{venta.pk}/')
        self.assertEqual(detalle.data['detalles'][0]['producto_nombre'], self.producto.nombre)

    def test_validacion_permisos_y_consultas_de_solo_lectura(self):
        for datos in ({'factura': 'FAC-mal'}, {'fecha': 'fecha'}, {'metodo_pago': 'otro'}):
            self.assertEqual(self.api.get(self.historial, datos).status_code, 400)
        for ruta in (self.historial, self.resumen):
            self.assertEqual(APIClient().get(ruta).status_code, 403)
            self.assertEqual(self.api.post(ruta, {}, format='json').status_code, 405)
        detalle = VENTAS + f'{self.ventas[-1].pk}/'
        self.assertEqual(self.api.patch(detalle, {'total': 0}, format='json').status_code, 403)
        self.assertEqual(self.api.delete(detalle).status_code, 403)
        admin = cliente_de(get_user_model().objects.create_user(username='admin-historial', is_staff=True))
        self.assertEqual(admin.patch(detalle, {'total': 0}, format='json').status_code, 405)
        self.assertEqual(admin.delete(detalle).status_code, 405)
