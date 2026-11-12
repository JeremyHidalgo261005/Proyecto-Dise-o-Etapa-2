
from django.db.models.deletion import ProtectedError

from rest_framework import viewsets, status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import Proveedor
from .serializers import ProveedorSerializer


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all().order_by('id')
    serializer_class = ProveedorSerializer
    permission_classes = [IsAdminUser]

    def destroy(self, request, *args, **kwargs):
        proveedor = self.get_object()

        try:
            self.perform_destroy(proveedor)

        except ProtectedError:
            return Response(
                {
                    "detail": (
                        f'No se puede eliminar al proveedor '
                        f'"{proveedor.nombre}" porque tiene '
                        f'productos asociados. Primero debés '
                        f'asignar esos productos a otro '
                        f'proveedor.'
                    )
                },
                status=status.HTTP_409_CONFLICT
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )
