export function IndicadorCarga({ children }) {
  return <span className="ui-carga"><span className="ui-spinner" aria-hidden="true" />{children}</span>
}

export function BloqueCarga({ mensaje }) {
  return <p className="ui-bloque-carga" role="status"><IndicadorCarga>{mensaje}</IndicadorCarga></p>
}

export function EsqueletoTabla({ columnas, mensaje }) {
  return (
    <>
      <tr className="ui-tabla-carga">
        <td colSpan={columnas} className="tabla-vacia">
          <span role="status"><IndicadorCarga>{mensaje}</IndicadorCarga></span>
        </td>
      </tr>
      {Array.from({ length: 3 }, (_, fila) => (
        <tr key={fila} aria-hidden="true" className="ui-fila-esqueleto">
          {Array.from({ length: columnas }, (_, columna) => (
            <td key={columna}><span className="ui-esqueleto ui-esqueleto-celda" /></td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function TablaEnCarga({ columnas, mensaje }) {
  return (
    <div className="tabla-contenedor">
      <table aria-label={mensaje}>
        <tbody><EsqueletoTabla columnas={columnas} mensaje={mensaje} /></tbody>
      </table>
    </div>
  )
}
