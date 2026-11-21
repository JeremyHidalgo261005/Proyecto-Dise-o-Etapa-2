from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .servicios import procesar_consulta_chat, generar_recomendaciones_inventario, obtener_cliente_gemini


class ChatInventarioView(APIView):
    """
    Endpoint para chatear con el Agente de IA sobre cualquier aspecto del inventario.
    Acceso de SOLO LECTURA a la base de datos.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mensaje = request.data.get('mensaje', '').strip()
        if not mensaje:
            return Response(
                {'error': 'Debes enviar un mensaje para consultar al agente.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        historial = request.data.get('historial', [])
        respuesta = procesar_consulta_chat(mensaje, historial)

        return Response({
            'respuesta': respuesta,
            'gemini_activo': obtener_cliente_gemini() is not None
        }, status=status.HTTP_200_OK)


class GenerarRecomendacionView(APIView):
    """
    Endpoint para solicitar recomendaciones de reposición automáticas basadas en IA.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        recomendacion = generar_recomendaciones_inventario()
        return Response({
            'recomendacion': recomendacion,
            'gemini_activo': obtener_cliente_gemini() is not None
        }, status=status.HTTP_200_OK)
