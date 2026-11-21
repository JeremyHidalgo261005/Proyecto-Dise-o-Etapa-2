import { useState, useEffect, useRef } from 'react'
import './Recomendaciones.css'

// Obtener el token de seguridad CSRF
async function obtenerTokenCSRF() {
  const respuesta = await fetch('/api/auth/csrf/', {
    credentials: 'same-origin'
  })
  if (!respuesta.ok) {
    throw new Error('No se pudo obtener el token de seguridad.')
  }
  const datos = await respuesta.json()
  return datos.csrfToken
}

function Recomendaciones({ cambiarPagina }) {
  const [mensajes, setMensajes] = useState([
    {
      remitente: 'agente',
      texto: '👋 ¡Hola! Soy el **Agente Inteligente de Inventario** de MiniGestor.\n\nPuedo responder cualquier consulta sobre existencias, costos, precios en colones (₡) o sugerir pedidos a proveedores con base en el catálogo de PostgreSQL (acceso de solo lectura).\n\n¿En qué te puedo ayudar hoy?'
    }
  ])
  const [entrada, setEntrada] = useState('')
  const [cargandoChat, setCargandoChat] = useState(false)
  const [generandoInforme, setGenerandoInforme] = useState(false)
  const [informeRecomendacion, setInformeRecomendacion] = useState('')
  const [geminiActivo, setGeminiActivo] = useState(false)
  const [error, setError] = useState('')

  const chatFinalRef = useRef(null)

  useEffect(() => {
    chatFinalRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // Enviar mensaje al agente
  async function enviarMensaje(e) {
    e?.preventDefault()
    const textoLimpio = entrada.trim()
    if (!textoLimpio || cargandoChat) return

    const nuevoHistorial = [
      ...mensajes,
      { remitente: 'usuario', texto: textoLimpio }
    ]
    setMensajes(nuevoHistorial)
    setEntrada('')
    setCargandoChat(true)
    setError('')

    try {
      const csrf = await obtenerTokenCSRF()
      const resp = await fetch('/api/agente/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          mensaje: textoLimpio,
          historial: nuevoHistorial.slice(-6)
        })
      })

      if (!resp.ok) {
        throw new Error(`Error en el servicio del agente (${resp.status})`)
      }

      const datos = await resp.json()
      setGeminiActivo(datos.gemini_activo)
      setMensajes((prev) => [
        ...prev,
        { remitente: 'agente', texto: datos.respuesta }
      ])
    } catch (err) {
      setError(err.message)
      setMensajes((prev) => [
        ...prev,
        {
          remitente: 'agente',
          texto: `⚠️ No pude procesar tu consulta: ${err.message}. Verifica que el backend esté activo.`
        }
      ])
    } finally {
      setCargandoChat(false)
    }
  }

  // Generar recomendación de compras / reposición
  async function handleGenerarRecomendacion() {
    if (generandoInforme) return
    setGenerandoInforme(true)
    setError('')

    try {
      const csrf = await obtenerTokenCSRF()
      const resp = await fetch('/api/agente/recomendar/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf
        },
        credentials: 'same-origin'
      })

      if (!resp.ok) {
        throw new Error(`Error al generar recomendación (${resp.status})`)
      }

      const datos = await resp.json()
      setGeminiActivo(datos.gemini_activo)
      setInformeRecomendacion(datos.recomendacion)
    } catch (err) {
      setError(`Error al generar recomendación: ${err.message}`)
    } finally {
      setGenerandoInforme(false)
    }
  }

  return (
    <div className="agente-ia-contenedor">
      {/* ENCABEZADO */}
      <div className="agente-ia-header panel">
        <div>
          <h2>🤖 Agente de Inteligencia Artificial</h2>
          <p>
            Asistente analítico con <strong>acceso exclusivo de solo lectura</strong> a la base de datos de inventario.
          </p>
        </div>

        <div className="agente-badge-estado">
          <span className={`punto-estado ${geminiActivo ? 'activo' : 'offline'}`} />
          <span>{geminiActivo ? 'Google Gemini Activo' : 'Motor Analítico Local'}</span>
        </div>
      </div>

      {error && (
        <div className="agente-alerta-error" role="alert">
          {error}
        </div>
      )}

      {/* SECCIÓN SUPERIOR: BOTÓN DE GENERAR RECOMENDACIÓN E INFORME */}
      <section className="seccion panel agente-seccion-recomendaciones">
        <div className="recomendaciones-acciones">
          <div>
            <h3>💡 Informe Automatizado de Reposición</h3>
            <p>
              El agente analiza las existencias actuales, productos por debajo del stock mínimo y últimos movimientos para recomendar compras a proveedores.
            </p>
          </div>

          <button
            type="button"
            className="boton-generar-rec"
            onClick={handleGenerarRecomendacion}
            disabled={generandoInforme}
          >
            {generandoInforme ? (
              <>
                <span className="spinner" />
                Analizando inventario...
              </>
            ) : (
              '✨ Generar recomendación de compras'
            )}
          </button>
        </div>

        {informeRecomendacion && (
          <div className="informe-recomendacion-caja">
            <h4>Resultado del Análisis:</h4>
            <div className="informe-contenido-markdown">
              <pre>{informeRecomendacion}</pre>
            </div>
          </div>
        )}
      </section>

      {/* SECCIÓN INFERIOR: CHAT CONTEXTUAL DE INVENTARIO */}
      <section className="seccion panel agente-chat-seccion">
        <div className="chat-encabezado">
          <h3>💬 Chat de Consultas sobre Inventario</h3>
          <span>Pregunta sobre existencias, precios, códigos, marcas o proveedores.</span>
        </div>

        <div className="chat-mensajes-lista">
          {mensajes.map((m, idx) => (
            <div
              key={idx}
              className={`mensaje-burbuja ${m.remitente === 'usuario' ? 'mensaje-usuario' : 'mensaje-agente'}`}
            >
              <div className="mensaje-autor">
                {m.remitente === 'usuario' ? 'Tú' : 'Agente IA (Gemini)'}
              </div>
              <div className="mensaje-cuerpo">
                {m.texto}
              </div>
            </div>
          ))}

          {cargandoChat && (
            <div className="mensaje-burbuja mensaje-agente cargando-burbuja">
              <span className="spinner" />
              <span>Consultando inventario en PostgreSQL...</span>
            </div>
          )}

          <div ref={chatFinalRef} />
        </div>

        {/* INPUT DE CHAT */}
        <form className="chat-formulario" onSubmit={enviarMensaje}>
          <input
            type="text"
            placeholder="Ej: ¿Qué marcas de café tenemos? o ¿Cuáles productos están agotados?"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            disabled={cargandoChat}
          />
          <button
            type="submit"
            disabled={cargandoChat || !entrada.trim()}
          >
            Enviar
          </button>
        </form>
      </section>
    </div>
  )
}

export default Recomendaciones
