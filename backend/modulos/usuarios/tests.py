from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from threading import Barrier
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections, connection, connections
from django.test import TestCase, TransactionTestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from .models import PerfilUsuario

AUTH = '/api/auth/'
PERFIL = AUTH + 'perfil/'
USUARIOS = AUTH + 'usuarios/'
HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
Usuario = get_user_model()


def ruta_usuario(usuario):
    return f'{USUARIOS}{usuario.pk}/'


@override_settings(PASSWORD_HASHERS=HASHERS)
class PerfilYUsuariosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = Usuario.objects.create_user(username='admin', password='Clave-actual-1!',
                                                is_staff=True)
        cls.cajero = Usuario.objects.create_user(username='caja', password='Clave-actual-2!',
                                                 first_name='Mario', last_name='Solano', email='mario@example.com')
        cls.cajero.groups.add(Group.objects.create(name='Cajero'))

    def cliente(self, usuario, contrasena, csrf=False):
        api = APIClient(enforce_csrf_checks=csrf)
        self.assertTrue(api.login(username=usuario.username, password=contrasena))
        return api

    def test_perfil_puede_editar_datos_personales_con_csrf(self):
        api = self.cliente(self.cajero, 'Clave-actual-2!', csrf=True)
        datos = {'first_name': 'María', 'last_name': 'Vargas', 'email': 'maria@example.com'}
        self.assertEqual(api.patch(PERFIL, datos, format='json').status_code, 403)
        token = api.get(AUTH + 'csrf/').json()['csrfToken']
        respuesta = api.patch(PERFIL, datos, format='json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['nombre'], 'María Vargas')
        self.assertEqual(respuesta.data['email'], 'maria@example.com')
        self.assertEqual(api.get(AUTH + 'session/').json()['nombre'], 'María Vargas')
        for campo in ('rol', 'is_superuser', 'is_staff', 'is_active', 'groups', 'user_permissions'):
            respuesta = api.patch(PERFIL, {campo: True}, format='json', HTTP_X_CSRFTOKEN=token)
            self.assertEqual(respuesta.status_code, 400)
        self.cajero.refresh_from_db()
        self.assertFalse(self.cajero.is_staff)
        self.assertTrue(self.cajero.is_active)

    def test_perfil_rechaza_borrar_campos_personales_y_exige_completar_los_faltantes(self):
        api = self.cliente(self.cajero, 'Clave-actual-2!')
        for campo in ('first_name', 'last_name', 'email'):
            respuesta = api.patch(PERFIL, {campo: '  '}, format='json')
            self.assertEqual(respuesta.status_code, 400, respuesta.data)
            self.assertIn(campo, respuesta.data)

        Usuario.objects.filter(pk=self.cajero.pk).update(last_name='', email='')
        self.assertTrue(api.get(AUTH + 'session/').json()['autenticado'])
        self.assertEqual(api.get(PERFIL).status_code, 200)
        incompleto = api.patch(PERFIL, {'first_name': 'María'}, format='json')
        self.assertEqual(incompleto.status_code, 400, incompleto.data)
        self.assertEqual(set(incompleto.data), {'last_name', 'email'})
        self.cajero.refresh_from_db()
        self.assertEqual(self.cajero.first_name, 'Mario')
        clave = self.cajero.password

        completo = api.patch(PERFIL, {'last_name': 'Vargas', 'email': 'mario@example.com'}, format='json')
        self.assertEqual(completo.status_code, 200, completo.data)
        self.cajero.refresh_from_db()
        self.assertEqual(self.cajero.password, clave)

    def test_perfil_cambia_su_usuario_sin_cerrar_sesion_y_rechaza_duplicados(self):
        api = self.cliente(self.cajero, 'Clave-actual-2!')
        for nombre in ('', 'admin', 'nombre con espacios'):
            respuesta = api.patch(PERFIL, {'username': nombre}, format='json')
            self.assertEqual(respuesta.status_code, 400, respuesta.data)
            self.assertIn('username', respuesta.data)
        respuesta = api.patch(PERFIL, {'username': 'caja-nueva'}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['usuario'], 'caja-nueva')
        self.assertEqual(api.get(AUTH + 'session/').json()['usuario'], 'caja-nueva')
        self.assertFalse(APIClient().login(username='caja', password='Clave-actual-2!'))
        self.assertTrue(APIClient().login(username='caja-nueva', password='Clave-actual-2!'))

    def test_cambiar_contrasena_valida_y_conserva_solo_la_sesion_actual(self):
        api = self.cliente(self.cajero, 'Clave-actual-2!')
        otra = self.cliente(self.cajero, 'Clave-actual-2!')
        campos = {'contrasena_actual': 'incorrecta', 'contrasena_nueva': 'Nuevo-acceso-L3!',
                  'confirmar_contrasena': 'Nuevo-acceso-L3!'}
        self.assertEqual(api.patch(PERFIL, campos, format='json').status_code, 400)
        campos['contrasena_actual'] = 'Clave-actual-2!'
        self.assertEqual(api.patch(PERFIL, dict(campos, confirmar_contrasena='dif'), format='json').status_code, 400)
        self.assertEqual(api.patch(PERFIL, dict(campos, contrasena_nueva='123',
                                              confirmar_contrasena='123'), format='json').status_code, 400)
        respuesta = api.patch(PERFIL, campos, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertTrue(api.get(AUTH + 'session/').json()['autenticado'])
        self.assertFalse(otra.get(AUTH + 'session/').json()['autenticado'])
        self.cajero.refresh_from_db()
        self.assertFalse(self.cajero.check_password('Clave-actual-2!'))
        self.assertTrue(self.cajero.check_password('Nuevo-acceso-L3!'))
        self.assertNotEqual(self.cajero.password, 'Nuevo-acceso-L3!')

    def test_imagen_valida_se_normaliza_y_solo_la_lee_su_titular(self):
        api = self.cliente(self.cajero, 'Clave-actual-2!')
        invalida = SimpleUploadedFile('imagen.png', b'archivo falso', 'image/png')
        self.assertEqual(api.patch(PERFIL, {'imagen': invalida}, format='multipart').status_code, 400)
        self.assertFalse(PerfilUsuario.objects.exists())

        salida = BytesIO()
        Image.new('RGB', (800, 400), '#8866aa').save(salida, 'JPEG')
        archivo = SimpleUploadedFile('avatar.jpg', salida.getvalue(), 'image/jpeg')
        respuesta = api.patch(PERFIL, {'imagen': archivo}, format='multipart')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        url = respuesta.data['imagen_url']
        imagen = api.get(url)
        self.assertEqual(imagen['Content-Type'], 'image/png')
        self.assertIn('no-store', imagen['Cache-Control'])
        self.assertEqual(Image.open(BytesIO(imagen.content)).size, (512, 256))
        otra = self.cliente(self.admin, 'Clave-actual-1!')
        self.assertEqual(otra.get(url).status_code, 404)
        self.assertEqual(APIClient().get(url).status_code, 403)

    def test_admin_crea_busca_y_edita_sin_asignar_permisos_adicionales(self):
        api = self.cliente(self.admin, 'Clave-actual-1!')
        datos = {'username': 'cliente-nuevo', 'first_name': 'Elena', 'last_name': 'Soto',
                 'email': 'elena@example.com', 'rol': 'Cajero',
                 'contrasena_nueva': 'Cajero-clave-Z5!', 'confirmar_contrasena': 'Cajero-clave-Z5!'}
        respuesta = api.post(USUARIOS, dict(datos, is_superuser=True), format='json')
        self.assertEqual(respuesta.status_code, 400, respuesta.data)
        respuesta = api.post(USUARIOS, datos, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertNotIn('password', respuesta.data)
        self.assertNotIn('contrasena_nueva', respuesta.data)
        nuevo = Usuario.objects.get(username='cliente-nuevo')
        self.assertTrue(nuevo.check_password(datos['contrasena_nueva']))
        self.assertEqual([v['id'] for v in api.get(USUARIOS, {'buscar': 'Ele Soto'}).data], [nuevo.pk])
        self.assertEqual(api.post(USUARIOS, datos, format='json').status_code, 400)

        respuesta = api.patch(ruta_usuario(nuevo), {'rol': 'Administrador', 'email': 'elena@example.com'}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        nuevo.refresh_from_db()
        self.assertTrue(nuevo.is_staff)
        self.assertFalse(nuevo.is_superuser)
        self.assertFalse(nuevo.groups.filter(name='Cajero').exists())

    def test_alta_requiere_todos_los_campos_y_contrasenas_iguales(self):
        api = self.cliente(self.admin, 'Clave-actual-1!')
        datos = {'username': 'caja-nueva', 'first_name': 'Elisa', 'last_name': 'Rojas',
                 'email': 'elisa@example.com', 'rol': 'Cajero', 'contrasena_nueva': 'Verde-LLuvia-56!',
                 'confirmar_contrasena': 'Verde-LLuvia-56!'}
        for campo in datos:
            for carga in ({k: v for k, v in datos.items() if k != campo}, dict(datos, **{campo: ''})):
                respuesta = api.post(USUARIOS, carga, format='json')
                self.assertEqual(respuesta.status_code, 400, respuesta.data)
                self.assertIn(campo, respuesta.data)
        respuesta = api.post(USUARIOS, dict(datos, confirmar_contrasena='otra'), format='json')
        self.assertEqual(respuesta.status_code, 400, respuesta.data)
        self.assertEqual(str(respuesta.data['confirmar_contrasena'][0]), 'Las contraseñas no coinciden.')
        self.assertFalse(Usuario.objects.filter(username=datos['username']).exists())

    def test_cuenta_incompleta_puede_ingresar_y_editarse_sin_cambiar_contrasena(self):
        anterior = self.cajero
        Usuario.objects.filter(pk=anterior.pk).update(first_name='', last_name='', email='')
        anterior.refresh_from_db()
        clave_original = anterior.password
        cliente = APIClient()
        acceso = cliente.post(AUTH + 'login/', {'usuario': anterior.username, 'contrasena': 'Clave-actual-2!'},
                              format='json')
        self.assertEqual(acceso.status_code, 200, acceso.json())
        self.assertTrue(cliente.get(AUTH + 'session/').json()['autenticado'])

        api = self.cliente(self.admin, 'Clave-actual-1!')
        ruta = ruta_usuario(anterior)
        incompleto = api.patch(ruta, {'first_name': 'Mario'}, format='json')
        self.assertEqual(incompleto.status_code, 400, incompleto.data)
        self.assertEqual(set(incompleto.data), {'last_name', 'email'})
        anterior.refresh_from_db()
        self.assertEqual(anterior.first_name, '')

        completo = api.patch(ruta, {'first_name': 'Mario', 'last_name': 'Soto', 'email': 'mario@example.com'},
                             format='json')
        self.assertEqual(completo.status_code, 200, completo.data)
        anterior.refresh_from_db()
        self.assertEqual(anterior.password, clave_original)
        self.assertTrue(cliente.get(AUTH + 'session/').json()['autenticado'])

    def test_permisos_cuenta_propia_y_sin_eliminacion(self):
        api = self.cliente(self.admin, 'Clave-actual-1!')
        cajero = self.cliente(self.cajero, 'Clave-actual-2!')
        ruta = ruta_usuario(self.admin)
        self.assertEqual(cajero.get(USUARIOS).status_code, 403)
        self.assertEqual(cajero.patch(ruta, {'rol': 'Cajero'}, format='json').status_code, 403)
        self.assertEqual(api.patch(ruta, {'rol': 'Cajero'}, format='json').status_code, 400)
        self.assertEqual(api.patch(ruta + 'estado/', {'activo': False}, format='json').status_code, 400)
        self.assertEqual(api.delete(ruta_usuario(self.cajero)).status_code, 405)
        superior = Usuario.objects.create_superuser(username='superior', password='Superior-A4!')
        self.assertEqual(api.patch(ruta_usuario(superior), {'email': 'x@example.com'}, format='json').status_code, 403)
        self.assertEqual(api.patch(ruta_usuario(superior) + 'estado/', {'activo': False}, format='json').status_code, 403)

    def test_admin_de_django_no_borra_usuarios_ni_cambia_estado_o_rol_directamente(self):
        superior = Usuario.objects.create_superuser(username='superior-django', password='Superior-L8!')
        self.client.force_login(superior)
        base = f'/admin/auth/user/{self.cajero.pk}/'
        self.assertEqual(self.client.post(base + 'delete/', {'post': 'yes'}).status_code, 403)
        formulario = self.client.get(base + 'change/').context['adminform']
        self.assertIn('is_active', formulario.readonly_fields)
        self.assertIn('is_staff', formulario.readonly_fields)
        self.assertTrue(Usuario.objects.filter(pk=self.cajero.pk).exists())

    def test_desactivar_revoca_sesiones_y_reactivar_mantiene_el_usuario(self):
        api = self.cliente(self.admin, 'Clave-actual-1!')
        cajero = self.cliente(self.cajero, 'Clave-actual-2!')
        ruta = ruta_usuario(self.cajero) + 'estado/'
        self.assertEqual(api.patch(ruta, {'activo': False}, format='json').status_code, 200)
        self.assertFalse(Usuario.objects.get(pk=self.cajero.pk).is_active)
        self.assertFalse(APIClient().login(username='caja', password='Clave-actual-2!'))
        self.assertEqual(api.patch(ruta, {'activo': True}, format='json').status_code, 200)
        self.assertFalse(cajero.get(AUTH + 'session/').json()['autenticado'])
        self.assertTrue(APIClient().login(username='caja', password='Clave-actual-2!'))


@override_settings(PASSWORD_HASHERS=HASHERS)
@skipUnless(connection.vendor == 'postgresql', 'Requiere bloqueos de filas de PostgreSQL.')
class AdministradoresSimultaneosTests(TransactionTestCase):
    def test_dos_administradores_no_pueden_desactivarse_mutuamente(self):
        a = Usuario.objects.create_user(username='admin-a', is_staff=True)
        b = Usuario.objects.create_user(username='admin-b', is_staff=True)
        barrera = Barrier(2)

        def desactivar(actor, objetivo):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout TO '10s'")
                api = APIClient()
                api.force_authenticate(actor)
                barrera.wait(timeout=10)
                return api.patch(ruta_usuario(objetivo) + 'estado/', {'activo': False}, format='json').status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            tareas = [ejecutor.submit(desactivar, actor, objetivo) for actor, objetivo in ((a, b), (b, a))]
            self.assertEqual(sorted(tarea.result(timeout=20) for tarea in tareas), [200, 403])
        self.assertEqual(Usuario.objects.filter(is_staff=True, is_active=True).count(), 1)
