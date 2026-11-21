"""
Servicio del Agente de Inteligencia Artificial para MiniGestor.
Utiliza Google Gemini con acceso estrictamente de SOLO LECTURA a la base de datos PostgreSQL.
"""

import os
import json
from decimal import Decimal
from django.conf import settings
from django.db.models import Sum, F, Q

# Modelos en modo SOLO LECTURA
from modulos.productos.models import Producto, Categoria
from modulos.proveedores.models import Proveedor
from modulos.ventas.models import Venta, DetalleVenta
from modulos.movimientos_inventario.models import MovimientoInventario

# Intentar importar google-genai
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None


def obtener_cliente_gemini():
    """Obtiene el cliente de Gemini usando la API key configurada."""
    api_key = os.getenv('GEMINI_API_KEY') or getattr(settings, 'GEMINI_API_KEY', None)
    if not api_key:
        return None
    if genai is None:
        return None
    return genai.Client(api_key=api_key)


def obtener_resumen_inventario_solo_lectura():
    """
    Extrae métricas clave del inventario exclusivamente con consultas SELECT (Solo Lectura).
    """
    total_productos = Producto.objects.filter(estado=True).count()
    productos_bajo_stock_qs = Producto.objects.filter(
        estado=True,
        stock_actual__lte=F('stock_minimo')
    ).select_related('categoria', 'proveedor')[:20]

    productos_bajo_stock = []
    for p in productos_bajo_stock_qs:
        productos_bajo_stock.append({
            'id': p.id,
            'nombre': p.nombre,
            'codigo': p.codigo,
            'stock_actual': p.stock_actual,
            'stock_minimo': p.stock_minimo,
            'costo': float(p.costo),
            'precio': float(p.precio),
            'categoria': p.categoria.nombre if p.categoria else 'N/A',
            'proveedor': p.proveedor.nombre if p.proveedor else 'N/A'
        })

    # Top categorías con más productos
    categorias = list(Categoria.objects.values('id', 'nombre')[:10])

    # Top proveedores
    proveedores = list(Proveedor.objects.values('id', 'nombre')[:10])

    # Movimientos recientes (últimos 15)
    movimientos_qs = MovimientoInventario.objects.select_related('producto').order_by('-fecha')[:15]
    movimientos = []
    for m in movimientos_qs:
        movimientos.append({
            'producto': m.producto.nombre if m.producto else 'N/A',
            'tipo': m.tipo_movimiento,
            'cantidad': m.cantidad,
            'stock_anterior': m.stock_anterior,
            'stock_resultante': m.stock_resultante,
            'fecha': m.fecha.strftime('%Y-%m-%d %H:%M') if m.fecha else ''
        })

    return {
        'total_productos_activos': total_productos,
        'cantidad_bajo_stock': len(productos_bajo_stock),
        'productos_criticos_bajo_stock': productos_bajo_stock,
        'categorias_muestra': categorias,
        'proveedores_muestra': proveedores,
        'movimientos_recientes': movimientos
    }


def buscar_productos_especificos(termino):
    """Búsqueda contextual de productos en modo SOLO LECTURA."""
    if not termino:
        return []
    qs = Producto.objects.filter(
        Q(nombre__icontains=termino) | Q(codigo__icontains=termino)
    ).select_related('categoria', 'proveedor')[:15]

    resultados = []
    for p in qs:
        resultados.append({
            'nombre': p.nombre,
            'codigo': p.codigo,
            'stock_actual': p.stock_actual,
            'stock_minimo': p.stock_minimo,
            'costo': float(p.costo),
            'precio': float(p.precio),
            'categoria': p.categoria.nombre if p.categoria else 'N/A',
            'proveedor': p.proveedor.nombre if p.proveedor else 'N/A',
            'estado': 'Activo' if p.estado else 'Inactivo'
        })
    return resultados


PROMPT_SISTEMA = """
Eres el Agente Inteligente de Inventario y Reposición de 'MiniGestor', un sistema POS para minisúper en Costa Rica.
Tu misión es asistir al administrador y personal con recomendaciones de compras, alertas de agotamiento y consultas sobre existencias.

REGLAS DE OPERACIÓN:
1. Tienes acceso estrictamente de SOLO LECTURA a la base de datos de PostgreSQL. No puedes modificar, borrar ni crear productos, ventas o movimientos.
2. Si el usuario te pregunta por precios o costos, exprésalos claramente en colones costarricenses (₡).
3. Sé conciso, profesional, analítico y brinda recomendaciones accionables (ej: 'Se recomienda pedir 20 unidades del producto X al proveedor Y').
4. Si detectas productos con stock igual o menor al stock mínimo, priorízalos como alertas urgentes.
5. Usa formato Markdown claro (listas, negritas, tablas breves si aplica).
"""

MODELOS_DISPONIBLES = [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash'
]


def llamar_gemini_con_reintentos(cliente, prompt):
    """
    Intenta invocar la API probando la lista de modelos ante errores 503 (alta demanda) o 404.
    """
    ultimo_error = None
    for modelo in MODELOS_DISPONIBLES:
        try:
            return cliente.models.generate_content(
                model=modelo,
                contents=prompt
            ).text
        except Exception as e:
            err_str = str(e)
            ultimo_error = e
            # Si es por alta demanda (503) o modelo no disponible (404), prueba el siguiente
            if '503' in err_str or '404' in err_str or 'UNAVAILABLE' in err_str:
                continue
            raise e
    raise ultimo_error


def procesar_consulta_chat(mensaje_usuario, historial=None):
    """
    Procesa un mensaje de chat sobre el inventario.
    """
    cliente = obtener_cliente_gemini()
    resumen = obtener_resumen_inventario_solo_lectura()

    # Si el mensaje menciona un producto específico, hacemos búsqueda puntual
    palabras = [w for w in mensaje_usuario.split() if len(w) > 3]
    coincidencias = []
    for p in palabras[:3]:
        encontrados = buscar_productos_especificos(p)
        if encontrados:
            coincidencias.extend(encontrados)

    # Eliminar duplicados
    coincidencias_unicas = {p['codigo']: p for p in coincidencias}.values()

    contexto_datos = f"""
INFORMACIÓN ACTUAL DEL SISTEMA (SOLO LECTURA):
- Total de productos activos en catálogo: {resumen['total_productos_activos']}
- Productos en nivel crítico (Stock actual <= Mínimo): {json.dumps(resumen['productos_criticos_bajo_stock'], ensure_ascii=False)}
- Movimientos recientes en Kardex: {json.dumps(resumen['movimientos_recientes'], ensure_ascii=False)}
- Productos coincidentes con la consulta: {json.dumps(list(coincidencias_unicas), ensure_ascii=False)}
"""

    if not cliente:
        # Fallback sin API Key configurada
        return generar_respuesta_fallback_inventario(mensaje_usuario, resumen)

    prompt_completo = f"{PROMPT_SISTEMA}\n\n{contexto_datos}\n\nPregunta del usuario: {mensaje_usuario}"

    try:
        return llamar_gemini_con_reintentos(cliente, prompt_completo)
    except Exception as e:
        return f"Ocurrió un error al consultar con Gemini ({str(e)}). Aquí un resumen local:\n\n" + generar_respuesta_fallback_inventario(mensaje_usuario, resumen)


def generar_recomendaciones_inventario():
    """
    Genera un informe estructurado de recomendaciones de reposición y abastecimiento.
    """
    cliente = obtener_cliente_gemini()
    resumen = obtener_resumen_inventario_solo_lectura()

    contexto = f"""
DATOS DE INVENTARIO PARA GENERAR RECOMENDACIÓN:
- Total productos en tienda: {resumen['total_productos_activos']}
- Lista de productos con stock crítico o agotándose: {json.dumps(resumen['productos_criticos_bajo_stock'], ensure_ascii=False)}
- Últimos movimientos: {json.dumps(resumen['movimientos_recientes'], ensure_ascii=False)}
"""

    prompt = f"""{PROMPT_SISTEMA}

{contexto}

TAREA OBLIGATORIA:
Genera un informe ejecutivo de RECOMENDACIONES DE REPOSICIÓN para el administrador del minisúper:
1. Alertas prioritarias de productos que están en riesgo de desabastecimiento.
2. Sugerencias de pedido a proveedores (cantidades recomendadas basadas en stock mínimo y costo).
3. Oportunidades de optimización de capital o inventario.
4. Resumen rápido de salud del inventario.
"""

    if not cliente:
        return generar_informe_fallback_recomendacion(resumen)

    try:
        return llamar_gemini_con_reintentos(cliente, prompt)
    except Exception as e:
        return f"Nota: No se pudo conectar a la API de Gemini ({str(e)}). Se generó el informe de contingencia local:\n\n" + generar_informe_fallback_recomendacion(resumen)


def generar_respuesta_fallback_inventario(pregunta, resumen):
    """Respuesta básica basada en reglas cuando no hay API Key de Gemini configurada."""
    criticos = resumen['productos_criticos_bajo_stock']
    texto = f"ℹ️ *Modo Offline / Asistente Local de MiniGestor*\n\n"
    texto += f"Actualmente hay **{resumen['total_productos_activos']}** productos registrados.\n"
    if criticos:
        texto += f"⚠️ Se detectaron **{len(criticos)} productos en stock crítico** que requieren reposición:\n"
        for p in criticos[:5]:
            texto += f"- **{p['nombre']}**: Stock {p['stock_actual']} (Mínimo: {p['stock_minimo']}) - Proveedor: {p['proveedor']}\n"
    else:
        texto += "✅ No hay productos por debajo del stock mínimo en este momento.\n"
    texto += "\n*(Para activar respuestas inteligentes con lenguaje natural, agrega `GEMINI_API_KEY` en tu archivo `.env`)*"
    return texto


def generar_informe_fallback_recomendacion(resumen):
    """Informe estructurado local cuando no hay API Key activa."""
    criticos = resumen['productos_criticos_bajo_stock']
    informe = "## 📋 Informe de Recomendaciones de Inventario (Reglas de Negocio)\n\n"
    if not criticos:
        informe += "✅ **El inventario se encuentra en niveles saludables.** No se detectaron productos por debajo del stock de seguridad.\n"
        return informe

    informe += f"Se identificaron **{len(criticos)} productos críticos** que requieren atención inmediata:\n\n"
    informe += "| Producto | Stock Actual | Mínimo | Sugerencia Compra | Proveedor |\n"
    informe += "| :--- | :---: | :---: | :---: | :--- |\n"
    for p in criticos[:10]:
        sugerencia = max(10, p['stock_minimo'] * 2 - p['stock_actual'])
        informe += f"| {p['nombre']} | {p['stock_actual']} | {p['stock_minimo']} | Pedir {sugerencia} un. | {p['proveedor']} |\n"

    informe += "\n💡 **Acción recomendada:** Contactar a los proveedores listados para reabastecer las referencias con existencia en cero o inferior al mínimo.\n"
    informe += "\n*(Configura `GEMINI_API_KEY` en tu `.env` para recibir análisis predictivo avanzado de IA)*"
    return informe
