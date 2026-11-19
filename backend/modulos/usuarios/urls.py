
from django.urls import path

from .api import ImagenPerfilView, PerfilView, UsuarioDatosView, UsuarioEstadoView, UsuariosView
from .views import (
    obtener_csrf,
    consultar_sesion,
    iniciar_sesion,
    cerrar_sesion
)

urlpatterns = [
    path('perfil/', PerfilView.as_view(), name='perfil'),
    path('perfil/imagen/', ImagenPerfilView.as_view(), name='perfil-imagen'),
    path('usuarios/', UsuariosView.as_view(), name='gestionar-usuarios'),
    path('usuarios/<int:pk>/', UsuarioDatosView.as_view(), name='usuario-datos'),
    path('usuarios/<int:pk>/estado/', UsuarioEstadoView.as_view(), name='usuario-estado'),
    path('csrf/', obtener_csrf, name='auth-csrf'),
    path('session/', consultar_sesion, name='auth-session'),
    path('login/', iniciar_sesion, name='auth-login'),
    path('logout/', cerrar_sesion, name='auth-logout'),
]
