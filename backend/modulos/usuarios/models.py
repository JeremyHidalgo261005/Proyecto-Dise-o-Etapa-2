from django.conf import settings
from django.db import models


class PerfilUsuario(models.Model):
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    imagen = models.BinaryField()
    imagen_actualizada = models.DateTimeField(auto_now=True)
