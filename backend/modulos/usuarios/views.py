
import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST


def obtener_rol(usuario):
    if usuario.is_staff:
        return 'Administrador'

    if usuario.groups.filter(name='Cajero').exists():
        return 'Cajero'

    return None


def datos_usuario(usuario):
    return {
        'id': usuario.id,
        'usuario': usuario.username,
        'nombre': usuario.get_full_name() or usuario.username,
        'rol': obtener_rol(usuario)
    }


# Obtener el token de seguridad CSRF
@require_GET
@ensure_csrf_cookie
def obtener_csrf(request):
    return JsonResponse({
        'csrfToken': get_token(request)
    })


# Consultar si hay una sesión activa
@require_GET
@never_cache
def consultar_sesion(request):
    if not request.user.is_authenticated:
        return JsonResponse({
            'autenticado': False
        })

    rol = obtener_rol(request.user)

    if rol is None:
        return JsonResponse({
            'autenticado': False,
            'mensaje': 'El usuario no tiene un rol autorizado.'
        })

    return JsonResponse({
        'autenticado': True,
        **datos_usuario(request.user)
    })


# Iniciar sesión
@require_POST
@csrf_protect
def iniciar_sesion(request):
    try:
        datos = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return JsonResponse(
            {'detail': 'Los datos enviados no son válidos.'},
            status=400
        )

    if not isinstance(datos, dict):
        return JsonResponse(
            {'detail': 'Los datos enviados no son válidos.'},
            status=400
        )

    usuario = datos.get('usuario', '')
    contrasena = datos.get('contrasena', '')

    if not isinstance(usuario, str) or not isinstance(contrasena, str):
        return JsonResponse(
            {'detail': 'El usuario y la contraseña deben ser texto.'},
            status=400
        )

    usuario = usuario.strip()

    if not usuario or not contrasena:
        return JsonResponse(
            {'detail': 'Ingresá el usuario y la contraseña.'},
            status=400
        )

    usuario_autenticado = authenticate(
        request,
        username=usuario,
        password=contrasena
    )

    if usuario_autenticado is None:
        return JsonResponse(
            {'detail': 'Usuario o contraseña incorrectos.'},
            status=401
        )

    if obtener_rol(usuario_autenticado) is None:
        return JsonResponse(
            {'detail': 'Tu usuario no tiene un rol autorizado.'},
            status=403
        )

    login(request, usuario_autenticado)

    return JsonResponse({
        'autenticado': True,
        'mensaje': 'Inicio de sesión correcto.',
        **datos_usuario(usuario_autenticado)
    })


# Cerrar sesión
@require_POST
@csrf_protect
def cerrar_sesion(request):
    logout(request)

    return JsonResponse({
        'mensaje': 'Sesión cerrada correctamente.'
    })
