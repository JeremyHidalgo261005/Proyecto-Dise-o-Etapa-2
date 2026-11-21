from django.urls import path
from .views import ChatInventarioView, GenerarRecomendacionView

urlpatterns = [
    path('agente/chat/', ChatInventarioView.as_view(), name='agente-chat'),
    path('agente/recomendar/', GenerarRecomendacionView.as_view(), name='agente-recomendar'),
]
