export function cerrarConAnimacion(elemento, cerrar) {
  if (!elemento || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cerrar()
    return
  }
  if (elemento.classList.contains('ui-modal-saliendo')) return

  const contenido = elemento.matches('dialog') ? elemento : elemento.firstElementChild
  const eraInerte = contenido?.inert
  elemento.classList.add('ui-modal-saliendo')
  if (contenido) contenido.inert = true

  function finalizar() {
    if (!elemento.isConnected) return
    if (contenido) contenido.inert = eraInerte
    elemento.classList.remove('ui-modal-saliendo')
    cerrar()
  }

  const salida = elemento.getAnimations().find((animacion) => animacion.animationName === 'ui-modal-salida')
  if (salida) salida.finished.then(finalizar, finalizar)
  else finalizar()
}
