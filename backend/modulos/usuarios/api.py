from django.contrib.auth import SESSION_KEY, get_user_model, update_session_auth_hash
from django.contrib.auth.models import Group
from django.contrib.sessions.models import Session
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.cache import add_never_cache_headers
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PerfilUsuario
from .serializers import (
    AltaUsuarioSerializer, CambiosPerfilSerializer, DatosAdministradosSerializer,
    EstadoUsuarioSerializer, UsuarioListadoSerializer,
)
from .views import datos_usuario, obtener_rol

Usuario = get_user_model()


class PuedeConsultarPerfil(BasePermission):
    def has_permission(self, request, view):
        usuario = request.user
        return usuario.is_authenticated and usuario.is_active and bool(obtener_rol(usuario))


class PuedeAdministrarUsuarios(BasePermission):
    def has_permission(self, request, view):
        usuario = request.user
        return usuario.is_authenticated and usuario.is_active and usuario.is_staff


def datos_perfil(usuario):
    return {
        **datos_usuario(usuario),
        'first_name': usuario.first_name,
        'last_name': usuario.last_name,
        'email': usuario.email,
    }


class PerfilView(APIView):
    permission_classes = [PuedeConsultarPerfil]

    def get(self, request):
        respuesta = Response(datos_perfil(request.user))
        add_never_cache_headers(respuesta)
        return respuesta

    def patch(self, request):
        with transaction.atomic():
            usuario = Usuario.objects.select_for_update().get(pk=request.user.pk)
            if not usuario.is_active or not obtener_rol(usuario):
                raise PermissionDenied()
            entrada = CambiosPerfilSerializer(usuario, data=request.data, partial=True)
            entrada.is_valid(raise_exception=True)
            datos = entrada.validated_data
            contrasena = datos.pop('contrasena_nueva', None)
            datos.pop('contrasena_actual', None)
            datos.pop('confirmar_contrasena', None)
            imagen = datos.pop('imagen', None)
            for campo, valor in datos.items():
                setattr(usuario, campo, valor)
            if contrasena is not None:
                usuario.set_password(contrasena)
                datos['password'] = usuario.password
            if datos:
                guardar_usuario(usuario, update_fields=list(datos))
            if imagen is not None:
                PerfilUsuario.objects.update_or_create(usuario=usuario, defaults={'imagen': imagen})

        if contrasena is not None:
            update_session_auth_hash(request, usuario)
        return Response(datos_perfil(usuario))


class ImagenPerfilView(APIView):
    permission_classes = [PuedeConsultarPerfil]

    def get(self, request):
        perfil = get_object_or_404(PerfilUsuario, usuario=request.user)
        respuesta = HttpResponse(bytes(perfil.imagen), content_type='image/png')
        respuesta['X-Content-Type-Options'] = 'nosniff'
        add_never_cache_headers(respuesta)
        return respuesta


def bloquear_administradores(request):
    # El orden de bloqueo es el mismo para todos los cambios de rol y estado.
    administradores = list(Usuario.objects.select_for_update().filter(is_staff=True).order_by('pk'))
    activos = {usuario.pk: usuario for usuario in administradores if usuario.is_active}
    administrador = activos.get(request.user.pk)
    if administrador is None:
        raise PermissionDenied('Solo un administrador activo puede modificar usuarios.')
    return administrador, activos


def asignar_rol(usuario, rol):
    cajero, _ = Group.objects.get_or_create(name='Cajero')
    usuario.is_staff = rol == 'Administrador'
    if usuario.is_staff:
        usuario.groups.remove(cajero)
    else:
        usuario.groups.add(cajero)


def verificar_usuario_editable(usuario, administrador):
    if usuario.is_superuser and not administrador.is_superuser:
        raise PermissionDenied('Esa cuenta solo puede administrarla un superusuario.')


def guardar_usuario(usuario, update_fields=None):
    try:
        with transaction.atomic():
            usuario.save(update_fields=update_fields)
    except IntegrityError as error:
        if Usuario.objects.filter(username=usuario.username).exclude(pk=usuario.pk).exists():
            raise ValidationError({'username': 'Ya existe una cuenta con ese usuario.'}) from error
        raise


def respuesta_usuario(usuario, request, codigo=status.HTTP_200_OK):
    datos = UsuarioListadoSerializer(usuario, context={'request': request}).data
    return Response(datos, status=codigo)


class UsuariosView(APIView):
    permission_classes = [PuedeAdministrarUsuarios]

    def get(self, request):
        usuarios = Usuario.objects.prefetch_related('groups').order_by('username', 'pk')
        busqueda = request.query_params.get('buscar', '').strip()
        for palabra in busqueda.split():
            usuarios = usuarios.filter(
                Q(username__icontains=palabra) | Q(first_name__icontains=palabra)
                | Q(last_name__icontains=palabra) | Q(email__icontains=palabra)
            )
        return Response(UsuarioListadoSerializer(usuarios, many=True, context={'request': request}).data)

    @transaction.atomic
    def post(self, request):
        bloquear_administradores(request)
        entrada = AltaUsuarioSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        rol = datos.pop('rol')
        contrasena = datos.pop('contrasena_nueva')
        datos.pop('confirmar_contrasena')
        usuario = Usuario(**datos)
        usuario.set_password(contrasena)
        guardar_usuario(usuario)
        asignar_rol(usuario, rol)
        usuario.save(update_fields=['is_staff'])
        return respuesta_usuario(usuario, request, status.HTTP_201_CREATED)


class UsuarioDatosView(APIView):
    permission_classes = [PuedeAdministrarUsuarios]

    @transaction.atomic
    def patch(self, request, pk):
        administrador, activos = bloquear_administradores(request)
        usuario = get_object_or_404(Usuario.objects.select_for_update(), pk=pk)
        verificar_usuario_editable(usuario, administrador)
        entrada = DatosAdministradosSerializer(usuario, data=request.data, partial=True)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        rol = datos.pop('rol', obtener_rol(usuario))
        if rol != obtener_rol(usuario):
            if usuario.pk == administrador.pk or usuario.is_superuser:
                raise ValidationError({'rol': 'No se puede cambiar el rol de esta cuenta.'})
            if usuario.pk in activos and len(activos) == 1:
                raise ValidationError({'rol': 'Debe quedar al menos un administrador activo.'})
            asignar_rol(usuario, rol)
        for campo, valor in datos.items():
            setattr(usuario, campo, valor)
        guardar_usuario(usuario)
        return respuesta_usuario(usuario, request)


def revocar_sesiones(usuario):
    clave = str(usuario.pk)
    vigentes = Session.objects.filter(expire_date__gt=timezone.now())
    claves = [sesion.session_key for sesion in vigentes.iterator()
              if sesion.get_decoded().get(SESSION_KEY) == clave]
    if claves:
        Session.objects.filter(session_key__in=claves).delete()


class UsuarioEstadoView(APIView):
    permission_classes = [PuedeAdministrarUsuarios]

    @transaction.atomic
    def patch(self, request, pk):
        administrador, activos = bloquear_administradores(request)
        usuario = get_object_or_404(Usuario.objects.select_for_update(), pk=pk)
        verificar_usuario_editable(usuario, administrador)
        entrada = EstadoUsuarioSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        activo = entrada.validated_data['activo']
        if not activo:
            if usuario.pk == administrador.pk:
                raise ValidationError({'activo': 'No podés desactivar tu propia cuenta.'})
            if usuario.pk in activos and len(activos) == 1:
                raise ValidationError({'activo': 'Debe quedar al menos un administrador activo.'})
        if usuario.is_active != activo:
            usuario.is_active = activo
            usuario.save(update_fields=['is_active'])
            if not activo:
                revocar_sesiones(usuario)
        return respuesta_usuario(usuario, request)
