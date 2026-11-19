from io import BytesIO

from django.contrib.auth import get_user_model, password_validation
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as ValidacionDjango
from PIL import Image, ImageOps
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .views import obtener_rol

Usuario = get_user_model()
ROLES = ['Administrador', 'Cajero']
LIMITE_BYTES = 5 * 1024 * 1024
LIMITE_PIXELES = 16_000_000


CAMPOS_PERSONALES = {
    'first_name': 'el nombre',
    'last_name': 'los apellidos',
    'email': 'el correo electrónico',
}
CAMPOS_PERFIL = {'username': 'el nombre de usuario', **CAMPOS_PERSONALES}
CAMPOS_ADMINISTRADOS = {**CAMPOS_PERFIL, 'rol': 'el rol'}


def errores_obligatorios(campo):
    mensaje = f'Completá {campo}.'
    return {'required': mensaje, 'blank': mensaje, 'null': mensaje}


def validar_campos_completos(valores, campos):
    faltantes = {
        campo: errores_obligatorios(titulo)['required']
        for campo, titulo in campos.items()
        if not (valores[campo] or '').strip()
    }
    if faltantes:
        raise serializers.ValidationError(faltantes)


def validar_contrasena(contrasena, usuario):
    try:
        password_validation.validate_password(contrasena, usuario)
    except ValidacionDjango as error:
        raise serializers.ValidationError({'contrasena_nueva': error.messages})


class CambiosPerfilSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        max_length=150,
        validators=[
            UnicodeUsernameValidator(message='Usá letras, números o los caracteres @ . + - _.'),
            UniqueValidator(Usuario.objects.all(), message='Ya existe una cuenta con ese usuario.'),
        ],
        error_messages=errores_obligatorios('el nombre de usuario'),
    )
    imagen = serializers.FileField(required=False, write_only=True)
    contrasena_actual = serializers.CharField(required=False, write_only=True, trim_whitespace=False, max_length=128)
    contrasena_nueva = serializers.CharField(required=False, write_only=True, trim_whitespace=False, max_length=128)
    confirmar_contrasena = serializers.CharField(required=False, write_only=True, trim_whitespace=False, max_length=128)

    class Meta:
        model = Usuario
        fields = [*CAMPOS_PERFIL, 'imagen', 'contrasena_actual',
                  'contrasena_nueva', 'confirmar_contrasena']

    def validate_imagen(self, archivo):
        if archivo.size > LIMITE_BYTES:
            raise serializers.ValidationError('La imagen debe pesar 5 MB o menos.')
        try:
            with Image.open(archivo) as original:
                if original.format not in {'JPEG', 'PNG', 'WEBP'}:
                    raise serializers.ValidationError('Elegí una imagen JPEG, PNG o WebP.')
                if original.width * original.height > LIMITE_PIXELES or getattr(original, 'n_frames', 1) != 1:
                    raise serializers.ValidationError('Usá una imagen fija de hasta 16 megapíxeles.')
                imagen = ImageOps.exif_transpose(original)
                imagen.thumbnail((512, 512))
                salida = BytesIO()
                imagen.convert('RGBA').save(salida, format='PNG')
                return salida.getvalue()
        except (OSError, ValueError, Image.DecompressionBombError):
            raise serializers.ValidationError('El archivo no es una imagen válida.')

    def validate(self, datos):
        if set(self.initial_data) - set(self.fields):
            raise serializers.ValidationError({'detail': 'El perfil solo permite editar los datos personales.'})
        actuales = {campo: datos.get(campo, getattr(self.instance, campo))
                    for campo in CAMPOS_PERFIL}
        validar_campos_completos(actuales, CAMPOS_PERFIL)

        credenciales = {'contrasena_actual', 'contrasena_nueva', 'confirmar_contrasena'}
        if credenciales.isdisjoint(datos):
            return datos
        if not credenciales <= datos.keys():
            raise serializers.ValidationError({'contrasena_nueva': 'Completá los tres campos de contraseña.'})
        if not self.instance.check_password(datos['contrasena_actual']):
            raise serializers.ValidationError({'contrasena_actual': 'La contraseña actual es incorrecta.'})
        if datos['contrasena_nueva'] != datos['confirmar_contrasena']:
            raise serializers.ValidationError({'confirmar_contrasena': 'Las contraseñas nuevas no coinciden.'})
        validar_contrasena(datos['contrasena_nueva'], self.instance)
        return datos


class UsuarioListadoSerializer(serializers.ModelSerializer):
    rol = serializers.SerializerMethodField()
    editable = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'rol', 'is_active', 'editable']

    def get_rol(self, usuario):
        return obtener_rol(usuario)

    def get_editable(self, usuario):
        return not usuario.is_superuser or self.context['request'].user.is_superuser


class DatosAdministradosSerializer(serializers.ModelSerializer):
    rol = serializers.ChoiceField(
        choices=ROLES, error_messages={**errores_obligatorios('el rol'),
                                       'invalid_choice': 'Seleccioná un rol válido.'}
    )

    class Meta:
        model = Usuario
        fields = list(CAMPOS_ADMINISTRADOS)
        extra_kwargs = {
            campo: {
                'required': True, 'allow_blank': False,
                'error_messages': errores_obligatorios(titulo),
            }
            for campo, titulo in CAMPOS_ADMINISTRADOS.items() if campo != 'rol'
        }
        extra_kwargs['email']['error_messages']['invalid'] = 'Ingresá un correo electrónico válido.'

    def validate(self, datos):
        if set(self.initial_data) - set(self.fields):
            raise serializers.ValidationError({'detail': 'Hay campos que no se pueden administrar desde esta pantalla.'})
        if self.instance is not None:
            actuales = {
                campo: getattr(self.instance, campo)
                for campo in CAMPOS_ADMINISTRADOS if campo != 'rol'
            }
            actuales['rol'] = obtener_rol(self.instance)
            actuales.update(datos)
            validar_campos_completos(actuales, CAMPOS_ADMINISTRADOS)
        return datos


class AltaUsuarioSerializer(DatosAdministradosSerializer):
    contrasena_nueva = serializers.CharField(
        write_only=True, trim_whitespace=False, max_length=128,
        error_messages=errores_obligatorios('la contraseña'),
    )
    confirmar_contrasena = serializers.CharField(
        write_only=True, trim_whitespace=False, max_length=128,
        error_messages=errores_obligatorios('la confirmación de contraseña'),
    )

    class Meta(DatosAdministradosSerializer.Meta):
        fields = [*DatosAdministradosSerializer.Meta.fields, 'contrasena_nueva', 'confirmar_contrasena']

    def validate(self, datos):
        datos = super().validate(datos)
        if not datos['contrasena_nueva'].strip():
            raise serializers.ValidationError({'contrasena_nueva': 'Completá la contraseña.'})
        if not datos['confirmar_contrasena'].strip():
            raise serializers.ValidationError({'confirmar_contrasena': 'Completá la confirmación de contraseña.'})
        if datos['contrasena_nueva'] != datos['confirmar_contrasena']:
            raise serializers.ValidationError({'confirmar_contrasena': 'Las contraseñas no coinciden.'})
        campos = {campo: datos[campo] for campo in CAMPOS_ADMINISTRADOS if campo != 'rol'}
        validar_contrasena(datos['contrasena_nueva'], Usuario(**campos))
        return datos


class EstadoUsuarioSerializer(serializers.Serializer):
    activo = serializers.BooleanField()
