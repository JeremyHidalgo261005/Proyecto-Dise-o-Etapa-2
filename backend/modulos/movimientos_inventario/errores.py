from django.db import ProgrammingError
from rest_framework import status
from rest_framework.exceptions import APIException


class EsquemaMovimientosPendiente(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = (
        'El historial de inventario requiere la migración '
        'movimientos_inventario.0002_tipos_y_valores_historicos.'
    )
    default_code = 'esquema_movimientos_pendiente'


class ManejarErroresMovimientos:
    def handle_exception(self, exc):
        if isinstance(exc, ProgrammingError):
            causa = exc.__cause__
            mensaje = str(causa)
            if (
                getattr(causa, 'sqlstate', None) == '42703'
                and 'movimientos_inventario_movimientoinventario' in mensaje
                and ('valor_anterior' in mensaje or 'valor_nuevo' in mensaje)
            ):
                return super().handle_exception(EsquemaMovimientosPendiente())
        return super().handle_exception(exc)
