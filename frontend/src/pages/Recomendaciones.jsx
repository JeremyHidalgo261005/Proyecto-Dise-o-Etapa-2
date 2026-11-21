import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  const [modalInformeAbierto, setModalInformeAbierto] = useState(false)
  const [geminiActivo, setGeminiActivo] = useState(false)
  const [error, setError] = useState('')

  const chatFinalRef = useRef(null)

  // Mantener el último mensaje visible dentro del chat
  useEffect(() => {
    chatFinalRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    })
  }, [mensajes])

  // Cerrar modal con Escape
  useEffect(() => {
    if (!modalInformeAbierto) return

    function manejarEscape(e) {
      if (e.key === 'Escape') {
        setModalInformeAbierto(false)
      }
    }

    window.addEventListener('keydown', manejarEscape)

    return () => {
      window.removeEventListener('keydown', manejarEscape)
    }
  }, [modalInformeAbierto])

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
        {
          remitente: 'agente',
          texto: datos.respuesta
        }
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

      // Abrir el modal al recibir el informe
      setModalInformeAbierto(true)

    } catch (err) {
      setError(`Error al generar recomendación: ${err.message}`)
    } finally {
      setGenerandoInforme(false)
    }
  }

  return (
    <div className="agente-ia-contenedor">

      {error && (
        <div className="agente-alerta-error" role="alert">
          {error}
        </div>
      )}

      {/* SECCIÓN: INFORME AUTOMATIZADO DE REPOSICIÓN */}
      <section className="seccion panel agente-seccion-recomendaciones">

        <div className="recomendaciones-acciones">

          <div>
            <h3>💡 Informe Automatizado de Reposición</h3>

            <p>
              El agente analiza las existencias actuales, productos por debajo
              del stock mínimo y últimos movimientos para recomendar compras
              a proveedores.
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
      </section>

      {/* SECCIÓN: CHAT CONTEXTUAL DE INVENTARIO */}
      <section className="seccion panel agente-chat-seccion">

        <div className="chat-encabezado">
          <h3>💬 Chat de Consultas sobre Inventario</h3>

          <span>
            Pregunta sobre existencias, precios, códigos, marcas o proveedores.
          </span>
        </div>

        {/* ÁREA DE MENSAJES */}
        <div className="chat-mensajes-lista">

          {mensajes.map((m, idx) => (
            <div
              key={idx}
              className={`mensaje-burbuja ${
                m.remitente === 'usuario'
                  ? 'mensaje-usuario'
                  : 'mensaje-agente'
              }`}
            >
              {m.remitente === 'usuario' ? (
                <>
                  <div className="mensaje-autor">
                    Tú
                  </div>

                  <div className="mensaje-cuerpo">
                    {m.texto}
                  </div>
                </>
              ) : (
                <>
                  <div className="mensaje-agente-identidad">
                    <div className="mensaje-agente-avatar">
                      <span>🤖</span>
                    </div>

                    <div className="mensaje-autor">
                      Agente de inventario
                    </div>
                  </div>

                  <div className="mensaje-cuerpo">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ children }) => (
                          <div className="tabla-chat-contenedor">
                            <table>{children}</table>
                          </div>
                        )
                      }}
                    >
                      {m.texto}
                    </ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          ))}

          {cargandoChat && (
            <div className="mensaje-burbuja mensaje-agente cargando-burbuja">
              <div className="mensaje-agente-identidad">
                <div className="mensaje-agente-avatar">
                  <span>🤖</span>
                </div>

                <div className="mensaje-autor">
                  Agente de inventario
                </div>
              </div>

              <div className="chat-escribiendo">
                <span className="spinner" />
                <span>Analizando tu consulta...</span>
              </div>
            </div>
          )}

          <div ref={chatFinalRef} />

        </div>

        {/* INPUT DE CHAT */}
        <form
          className="chat-formulario"
          onSubmit={enviarMensaje}
        >
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

      {/* MODAL: INFORME DE REPOSICIÓN */}
      {modalInformeAbierto && (
        <div
          className="modal-informe-fondo"
          onClick={() => setModalInformeAbierto(false)}
        >
          <div
            className="modal-informe-caja"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-informe"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="modal-informe-header">
              <div>
                <span className="modal-informe-icono">💡</span>
                <h3 id="titulo-modal-informe">
                  Informe de Reposición
                </h3>
                <p>
                  Resultado del análisis automatizado de inventario.
                </p>
              </div>

              <button
                type="button"
                className="modal-informe-cerrar"
                onClick={() => setModalInformeAbierto(false)}
                aria-label="Cerrar informe"
              >
                ✕
              </button>
            </div>

            <div className="modal-informe-contenido">
              <div className="informe-recomendacion-caja">
                <h4>Resultado del análisis:</h4>

                <div className="informe-contenido-markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="tabla-informe-contenedor">
                          <table>{children}</table>
                        </div>
                      )
                    }}
                  >
                    {informeRecomendacion}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            <div className="modal-informe-footer">
              <button
                type="button"
                className="boton-cerrar-informe"
                onClick={() => setModalInformeAbierto(false)}
              >
                Cerrar informe
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

export default Recomendaciones



