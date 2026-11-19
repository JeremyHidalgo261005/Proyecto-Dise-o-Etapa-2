import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const selector = '[data-tooltip]'

function Tooltip() {
  const id = useId()
  const [ancla, setAncla] = useState(null)
  const aviso = useRef(null)

  useEffect(() => {
    let mouse = null
    let foco = null
    function actualizar() {
      setAncla(foco?.isConnected ? foco : mouse?.isConnected ? mouse : null)
    }
    function entrar(evento) {
      if (evento.pointerType === 'touch') return
      mouse = evento.target.closest?.(selector)
      actualizar()
    }
    function salir(evento) {
      if (evento.pointerType === 'touch') return
      mouse = evento.relatedTarget?.closest?.(selector) || null
      actualizar()
    }
    function enfocar(evento) {
      foco = evento.target.matches?.(':focus-visible') ? evento.target.closest(selector) : null
      actualizar()
    }
    function desenfocar() {
      foco = null
      actualizar()
    }
    function ocultar() {
      foco = null
      mouse = null
      setAncla(null)
    }
    function teclado(evento) {
      if (evento.key === 'Escape' || evento.key === 'Enter') ocultar()
    }

    document.addEventListener('pointerover', entrar)
    document.addEventListener('pointerout', salir)
    document.addEventListener('focusin', enfocar)
    document.addEventListener('focusout', desenfocar)
    document.addEventListener('pointerdown', ocultar)
    document.addEventListener('keydown', teclado)
    return () => {
      document.removeEventListener('pointerover', entrar)
      document.removeEventListener('pointerout', salir)
      document.removeEventListener('focusin', enfocar)
      document.removeEventListener('focusout', desenfocar)
      document.removeEventListener('pointerdown', ocultar)
      document.removeEventListener('keydown', teclado)
    }
  }, [])

  useLayoutEffect(() => {
    if (!ancla?.isConnected || !aviso.current) return
    const caja = aviso.current
    let cuadro = 0

    function ubicar() {
      cuadro = 0
      const rect = ancla.getBoundingClientRect()
      const { innerWidth: ancho, innerHeight: alto } = window
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= alto ||
          rect.right <= 0 || rect.left >= ancho) {
        setAncla(null)
        return
      }

      const margen = 8
      const x = Math.min(ancho - caja.offsetWidth - margen,
        Math.max(margen, rect.left + (rect.width - caja.offsetWidth) / 2))
      const y = rect.top >= caja.offsetHeight + 2 * margen
        ? rect.top - caja.offsetHeight - margen
        : Math.min(rect.bottom + margen, alto - caja.offsetHeight - margen)
      Object.assign(caja.style, { left: x + 'px', top: y + 'px' })
    }

    function reubicar() {
      if (!cuadro) cuadro = requestAnimationFrame(ubicar)
    }

    ubicar()
    const anterior = ancla.getAttribute('aria-describedby')
    ancla.setAttribute('aria-describedby', [anterior, id].filter(Boolean).join(' '))
    const observar = new ResizeObserver(reubicar)
    observar.observe(ancla)
    window.addEventListener('scroll', reubicar, true)
    window.addEventListener('resize', reubicar)
    return () => {
      cancelAnimationFrame(cuadro)
      observar.disconnect()
      window.removeEventListener('scroll', reubicar, true)
      window.removeEventListener('resize', reubicar)
      if (anterior === null) ancla.removeAttribute('aria-describedby')
      else ancla.setAttribute('aria-describedby', anterior)
    }
  }, [ancla, id])

  if (!ancla) return null
  const dialogo = ancla.closest('dialog[open]')
  return createPortal(
    <span id={id} ref={aviso} className="ui-tooltip" role="tooltip">{ancla.dataset.tooltip}</span>,
    dialogo || document.body
  )
}

export default Tooltip
