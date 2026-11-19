import './SeleccionTabla.css'

export function CabeceraSeleccion({ seleccion, deshabilitada }) {
  return (
    <th scope="col" className="tabla-casilla">
      <input type="checkbox" checked={seleccion.todos} disabled={deshabilitada}
        aria-label="Seleccionar todos los registros visibles"
        data-tooltip="Seleccionar todos los registros visibles"
        ref={(nodo) => { if (nodo) nodo.indeterminate = !seleccion.todos && seleccion.elegidos.length > 0 }}
        onChange={seleccion.alternarTodas} />
    </th>
  )
}

export function CeldaSeleccion({ marcada, nombre, onChange }) {
  return (
    <td className="tabla-casilla">
      <input type="checkbox" aria-label={'Seleccionar ' + nombre} checked={marcada} onChange={onChange} />
    </td>
  )
}

const iconos = {
  editar: 'M4 20h4l11-11-4-4L4 16v4m9-13 4 4',
  eliminar: 'M4 6h16M9 6V4h6v2m3 0-1 14H7L6 6m4 4v6m4-6v6',
  activar: 'm5 12 4 4 10-10',
  desactivar: 'M6 12h12',
  detalle: 'M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Zm12 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  imprimir: 'M6 9V4h12v5M6 16H4V9h16v7h-2M6 13h12v7H6z',
}

export function BarraSeleccion({ seleccion, acciones }) {
  const cantidad = seleccion.elegidos.length
  if (!cantidad) return null

  return (
    <div className="tabla-barra-seleccion" role="group" aria-label="Acciones para la selección">
      <strong role="status">{cantidad} {cantidad === 1 ? 'registro seleccionado' : 'registros seleccionados'}</strong>
      <div className="tabla-acciones-seleccion">
        {acciones.filter(Boolean).map(({ icono, texto, ejecutar, deshabilitada }) => (
          <button type="button" key={icono} className={'tabla-accion' + (icono === 'eliminar' ? ' tabla-accion-peligro' : '')}
            data-tooltip={texto} disabled={deshabilitada} onClick={ejecutar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconos[icono]} /></svg>
            {texto}
          </button>
        ))}
        <button type="button" className="tabla-accion" onClick={seleccion.limpiar}>Cancelar selección</button>
      </div>
    </div>
  )
}
