
from django.urls import path

from .views import (
    obtener_csrf,
    consultar_sesion,
    iniciar_sesion,
    cerrar_sesion
)

urlpatterns = [
    path('csrf/', obtener_csrf, name='auth-csrf'),
    path('session/', consultar_sesion, name='auth-session'),
    path('login/', iniciar_sesion, name='auth-login'),
    path('logout/', cerrar_sesion, name='auth-logout'),
]
