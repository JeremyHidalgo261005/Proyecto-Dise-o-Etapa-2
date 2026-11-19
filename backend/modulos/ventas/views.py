import hashlib
import json
from datetime import datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, is_password_usable
from django.core import signing
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from modulos.movimientos_inventario.models import MovimientoInventario
from modulos.productos.models import Producto
from modulos.usuarios.permisos import PermisoVentas

from .models import DetalleVenta, Venta
from .serializers import (
    AutorizacionVentaSerializer, FiltrosHistorialSerializer, RegistroVentaSerializer,
    VentaHistorialSerializer, VentaSerializer,
)

SAL_AUTORIZACION = 'ventas.descuento'
CENTIMO = Decimal('0.01')
MAX_IMPORTE = Decimal('99999999.99')


ZONA_NEGOCIO = ZoneInfo('America/Costa_Rica')


def ventas_en_fecha(ventas, fecha):
    inicio = datetime.combine(fecha, time.min, tzinfo=ZONA_NEGOCIO)
    return ventas.filter(fecha__gte=inicio, fecha__lt=inicio + timedelta(days=1))


def filas_historial(ventas):
    return ventas.select_related('usuario').annotate(
        cantidad_articulos=Sum('detalles__cantidad', default=0),
        subtotal=Sum('detalles__subtotal', default=0),
    )


class PaginacionHistorial(PageNumberPagination):
    page_size = 15


class LimiteIntentosPin(UserRateThrottle):
    scope = 'ventas_pin'
    rate = '5/min'


class VentaViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Venta.objects.select_related('usuario').prefetch_related(
        'detalles__producto'
    ).order_by('-fecha')
    serializer_class = VentaSerializer
    permission_classes = [PermisoVentas]

    @action(detail=False, methods=['get'])
    def historial(self, request):
        entrada = FiltrosHistorialSerializer(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        filtros = entrada.validated_data
        ventas = Venta.objects.order_by('-fecha', '-pk')
        if filtros.get('factura'):
            ventas = ventas.filter(pk=filtros['factura'])
        if 'fecha' in filtros:
            ventas = ventas_en_fecha(ventas, filtros['fecha'])
        if 'metodo_pago' in filtros:
            ventas = ventas.filter(metodo_pago=filtros['metodo_pago'])

        paginador = PaginacionHistorial()
        ids = paginador.paginate_queryset(ventas.values_list('pk', flat=True), request)
        filas = filas_historial(Venta.objects.filter(pk__in=ids))
        return paginador.get_paginated_response(
            VentaHistorialSerializer(filas.order_by('-fecha', '-pk'), many=True).data
        )

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        productos = Producto.objects.aggregate(
            productos_registrados=Count('pk'),
            productos_activos=Count('pk', filter=Q(estado=True)),
            unidades_inventario=Sum('stock_actual', filter=Q(estado=True), default=0),
            productos_agotados=Count('pk', filter=Q(stock_actual=0)),
            productos_stock_bajo=Count('pk', filter=Q(stock_actual__lte=F('stock_minimo'))),
        )
        fecha = timezone.localdate(timezone=ZONA_NEGOCIO)
        ventas = Venta.objects.all()
        ids = ventas.order_by('-fecha', '-pk').values('pk')[:3]
        recientes = filas_historial(ventas.filter(pk__in=ids)).order_by('-fecha', '-pk')
        return Response({
            **productos,
            'ventas_del_dia': ventas_en_fecha(ventas, fecha).count(),
            'ventas_ayer': ventas_en_fecha(ventas, fecha - timedelta(days=1)).count(),
            'ventas_recientes': VentaHistorialSerializer(recientes, many=True).data,
        })

    @action(detail=False, methods=['post'], url_path='autorizar', throttle_classes=[LimiteIntentosPin])
    def autorizar(self, request):
        entrada = AutorizacionVentaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        pin_hash = settings.VENTAS_PIN_ADMIN_HASH
        if not pin_hash or not is_password_usable(pin_hash):
            return Response(
                {'detail': 'La autorización de administrador no está configurada.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not check_password(datos['pin'], pin_hash):
            return Response(
                {'detail': 'Clave de administrador incorrecta.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        autorizacion = signing.dumps(
            {
                'usuario': request.user.pk,
                'porcentaje': str(Decimal(datos['porcentaje_descuento']).quantize(CENTIMO)),
                'clave': str(datos['clave_solicitud']),
            },
            salt=SAL_AUTORIZACION,
        )
        return Response({'autorizacion': autorizacion})

    def create(self, request, *args, **kwargs):
        entrada = RegistroVentaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        clave = datos.get('clave_solicitud')
        detalles = datos['detalles']
        porcentaje = Decimal(datos['porcentaje_descuento']).quantize(CENTIMO)
        metodo = datos.get('metodo_pago', '')
        aportado = datos.get('dinero_aportado')
        referencia = datos.get('referencia_tarjeta', '')
        total_esperado = datos.get('total_esperado')
        huella = hashlib.sha256(json.dumps([
            detalles, str(porcentaje), metodo, str(aportado), referencia, str(total_esperado)
        ], sort_keys=True).encode()).hexdigest()

        with transaction.atomic():
            if clave:
                # Serializar reintentos del mismo usuario antes de consultar la clave.
                get_user_model().objects.select_for_update(no_key=True).only('pk').get(
                    pk=request.user.pk
                )
                existente = self.get_queryset().filter(usuario=request.user, clave_solicitud=clave).first()
                if existente:
                    if existente.huella_solicitud != huella:
                        return Response(
                            {'detail': 'La solicitud ya se utilizó con otros datos.'},
                            status=status.HTTP_409_CONFLICT,
                        )
                    return Response(VentaSerializer(existente).data, status=status.HTTP_200_OK)

            if porcentaje:
                self.validar_descuento(
                    datos.get('autorizacion', ''), request.user.pk, porcentaje, clave
                )

            productos = {
                producto.pk: producto for producto in Producto.objects.select_for_update().filter(
                    pk__in=[item['producto'] for item in detalles]
                ).order_by('pk')
            }
            lineas = []
            subtotal = Decimal('0.00')
            for item in detalles:
                producto = productos.get(item['producto'])
                cantidad = item['cantidad']
                if producto is None:
                    raise ValidationError({'detail': f"No existe el producto {item['producto']}."})
                if not producto.estado:
                    raise ValidationError({'detail': f'{producto.nombre} no está disponible.'})
                if producto.stock_actual < cantidad:
                    raise ValidationError({'detail': f'No hay suficiente stock para {producto.nombre}.'})
                importe = producto.precio * cantidad
                if importe > MAX_IMPORTE:
                    raise ValidationError({'detail': 'El importe de un artículo excede el valor admitido.'})
                subtotal += importe
                lineas.append((producto, cantidad, importe))

            descuento = (subtotal * porcentaje / 100).quantize(CENTIMO, rounding=ROUND_HALF_UP)
            total = subtotal - descuento
            if total > MAX_IMPORTE or descuento > MAX_IMPORTE:
                raise ValidationError({'detail': 'El importe de la venta excede el valor admitido.'})
            if total_esperado is not None and total != total_esperado:
                return Response(
                    {'detail': 'El total cambió. Volvé a la factura para revisar los precios.'},
                    status=status.HTTP_409_CONFLICT,
                )
            if aportado is not None and aportado < total:
                raise ValidationError({'detail': 'El dinero aportado es insuficiente.'})

            venta = Venta.objects.create(
                usuario=request.user, total=total, porcentaje_descuento=porcentaje,
                descuento=descuento, metodo_pago=metodo, dinero_aportado=aportado,
                vuelto=aportado - total if aportado is not None else None,
                referencia_tarjeta=referencia, clave_solicitud=clave,
                huella_solicitud=huella if clave else '',
            )
            for producto, cantidad, importe in lineas:
                anterior = producto.stock_actual
                producto.stock_actual -= cantidad
                producto.save(update_fields=['stock_actual'])
                detalle = DetalleVenta.objects.create(
                    venta=venta, producto=producto, cantidad=cantidad,
                    precio_unitario=producto.precio, subtotal=importe,
                )
                MovimientoInventario.objects.create(
                    producto=producto, tipo_movimiento='venta', cantidad=cantidad,
                    motivo=f'Venta ID: {venta.pk}', stock_anterior=anterior,
                    stock_resultante=producto.stock_actual,
                    detalle_venta=detalle, usuario=request.user,
                )
            return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)

    @staticmethod
    def validar_descuento(token, usuario, porcentaje, clave):
        try:
            autorizacion = signing.loads(token, salt=SAL_AUTORIZACION, max_age=900)
        except signing.BadSignature:
            autorizacion = None
        if autorizacion != {'usuario': usuario, 'porcentaje': str(porcentaje), 'clave': str(clave)}:
            raise ValidationError({'detail': 'Volvé a autorizar el descuento con el PIN de administrador.'})
