import { IndicadorCarga } from './CargaUI'
import { useErrorConAviso } from './avisos'
import { cerrarConAnimacion } from './transiciones'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import './ConfirmarEliminacion.css'

function ConfirmarEliminacion({
  titulo, nombre, mensaje, onCancelar, onEliminar, accion = 'Eliminar',
  procesando = 'Eliminando…', peligro = true, soloCerrar = false, resultado
}) {
  const dialogo = useRef(null)
  const cancelar = useRef(null)
  const enviando = useRef(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useErrorConAviso()
  const id = useId()

  useLayoutEffect(() => {
    const ventana = dialogo.current
    const viewport = window.visualViewport
    const raiz = document.documentElement
    const overflow = raiz.style.overflow

    function centrar() {
      if (!viewport) return
      ventana.style.setProperty('--confirmar-x', viewport.offsetLeft + viewport.width / 2 + 'px')
      ventana.style.setProperty('--confirmar-y', viewport.offsetTop + viewport.height / 2 + 'px')
      ventana.style.setProperty('--confirmar-ancho', viewport.width + 'px')
      ventana.style.setProperty('--confirmar-alto', viewport.height + 'px')
    }

    raiz.style.overflow = 'hidden'
    centrar()
    ventana.showModal()
    cancelar.current.focus({ preventScroll: true })
    viewport?.addEventListener('resize', centrar)
    viewport?.addEventListener('scroll', centrar)
    return () => {
      viewport?.removeEventListener('resize', centrar)
      viewport?.removeEventListener('scroll', centrar)
      ventana.close()
      raiz.style.overflow = overflow
    }
  }, [])

  useLayoutEffect(() => {
    if (soloCerrar) cancelar.current.focus({ preventScroll: true })
  }, [soloCerrar])

  function cerrar() {
    cerrarConAnimacion(dialogo.current, onCancelar)
  }

  async function confirmar() {
    if (enviando.current) return
    enviando.current = true
    setEliminando(true)
    setError('')
    try {
      if (await onEliminar() !== false) {
        cerrar()
        return
      }
      enviando.current = false
      setEliminando(false)
    } catch (error) {
      setError(error.message || 'No se pudo completar la acción.')
      enviando.current = false
      setEliminando(false)
    }
  }

  return (
    <dialog ref={dialogo} className="panel confirmar-eliminacion"
      aria-labelledby={id + '-titulo'} aria-describedby={id + '-mensaje'}
      onCancel={(evento) => {
        evento.preventDefault()
        if (!enviando.current) cerrar()
      }}>
      <span className="confirmar-eliminacion-icono" aria-hidden="true">!</span>
      <h2 id={id + '-titulo'}>{titulo}</h2>
      {nombre && <p className="confirmar-eliminacion-nombre">{nombre}</p>}
      <p id={id + '-mensaje'}>{mensaje}</p>
      {error && <p className="confirmar-eliminacion-error" role="alert">{error}</p>}
      {resultado}
      <div className="confirmar-eliminacion-acciones">
        <button ref={cancelar} type="button" className="productos-boton-secundario"
          disabled={eliminando} onClick={cerrar}>
          {soloCerrar ? 'Cerrar' : 'Cancelar'}
        </button>
        {!soloCerrar && (
          <button type="button" className={peligro ? 'confirmar-eliminacion-boton' : 'boton-volver'}
            disabled={eliminando} onClick={confirmar}>
            {eliminando ? <IndicadorCarga>{procesando}</IndicadorCarga> : accion}
          </button>
        )}
      </div>
    </dialog>
  )
}

export default ConfirmarEliminacion
