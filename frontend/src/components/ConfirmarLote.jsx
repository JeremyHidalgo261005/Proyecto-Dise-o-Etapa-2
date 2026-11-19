import { useState } from 'react'
import ConfirmarEliminacion from './ConfirmarEliminacion'
import { useNotificar } from './avisos'

function ConfirmarLote({ registros, nombre, accion = 'Eliminar', mensaje, onCancelar, ejecutar, alTerminar }) {
  const [fallos, setFallos] = useState([])
  const notificar = useNotificar()
  const cantidad = registros.length

  async function confirmar() {
    const errores = []
    for (const registro of registros) {
      try {
        await ejecutar(registro)
      } catch (error) {
        errores.push({ nombre: nombre(registro), motivo: error.message || 'La operación falló.' })
      }
    }
    alTerminar()
    const hechos = cantidad - errores.length
    if (hechos) notificar(hechos + ' de ' + cantidad + ' registros procesados correctamente.', 'exito')
    if (!errores.length) return
    const rechazados = errores.length === 1 ? '1 registro' : errores.length + ' registros'
    notificar('No se pudo completar la acción en ' + rechazados + '. Revisá el detalle.',
      hechos ? 'advertencia' : 'error', false)
    setFallos(errores)
    return false
  }

  return (
    <ConfirmarEliminacion titulo={accion + (cantidad === 1 ? ' registro' : ' registros')}
      nombre={cantidad === 1 ? nombre(registros[0]) : undefined}
      mensaje={fallos.length
        ? 'Estos registros no se pudieron procesar.'
        : cantidad + (cantidad === 1 ? ' registro seleccionado. ' : ' registros seleccionados. ') + mensaje}
      onCancelar={onCancelar} onEliminar={confirmar} accion={accion}
      procesando="Procesando…" peligro={accion !== 'Activar'} soloCerrar={fallos.length > 0}
      resultado={fallos.length > 0 && (
        <ul className="confirmar-eliminacion-error" role="alert">
          {fallos.map(({ nombre, motivo }, indice) => <li key={indice}><strong>{nombre}</strong> · {motivo}</li>)}
        </ul>
      )} />
  )
}

export default ConfirmarLote
