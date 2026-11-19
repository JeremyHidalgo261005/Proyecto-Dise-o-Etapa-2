import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ContextoAvisos } from './avisos'
import Tooltip from './Tooltip'
import './Microinteracciones.css'

const tipos = {
  exito: ['✓', 'Éxito'],
  error: ['!', 'Error'],
  advertencia: ['!', 'Advertencia'],
  info: ['i', 'Información']
}

function AvisosUI({ children }) {
  const [avisos, setAvisos] = useState([])
  const siguiente = useRef(0)
  const temporizadores = useRef(new Map())

  const cerrar = useCallback((id) => {
    clearTimeout(temporizadores.current.get(id))
    temporizadores.current.delete(id)
    setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id))
  }, [])

  const notificar = useCallback((texto, tipo = 'info', anunciar = true) => {
    if (!texto) return
    const id = ++siguiente.current
    setAvisos((actuales) => {
      if ((tipo === 'error' || tipo === 'advertencia') &&
          actuales.some((aviso) => aviso.tipo === tipo && aviso.texto === texto)) return actuales
      return [...actuales, { id, texto, tipo, anunciar }]
    })
    if (tipo === 'exito' || tipo === 'info') {
      temporizadores.current.set(id, setTimeout(() => cerrar(id), 5200))
    }
  }, [cerrar])

  useEffect(() => {
    const timers = temporizadores.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  return (
    <ContextoAvisos.Provider value={notificar}>
      {children}
      <Tooltip />
      {createPortal(
        <aside className="ui-avisos" aria-label="Notificaciones">
          {avisos.map(({ id, texto, tipo, anunciar }) => (
            <div className={'ui-aviso ui-aviso-' + tipo} key={id}>
              <span className="ui-aviso-icono" aria-hidden="true">{tipos[tipo][0]}</span>
              <div role={anunciar ? (tipo === 'error' ? 'alert' : 'status') : undefined}>
                <span className="ui-solo-lectura">{tipos[tipo][1]}: </span>
                {texto}
              </div>
              <button type="button" aria-label="Cerrar notificación" onClick={() => cerrar(id)}>×</button>
            </div>
          ))}
        </aside>,
        document.body
      )}
    </ContextoAvisos.Provider>
  )
}

export default AvisosUI
