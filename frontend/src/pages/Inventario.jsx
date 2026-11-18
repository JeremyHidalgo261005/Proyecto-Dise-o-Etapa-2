
function Inventario({ cambiarPagina }) {
  return (
    <>
      <section className="seccion panel">
        <h2>Historial de movimientos</h2>

        <p>
          Aquí podremos consultar las entradas, salidas
          y ajustes realizados en el inventario.
        </p>

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Responsable</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td colSpan="5" className="tabla-vacia">
                  Todavía no tenemos movimientos registrados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <button
        className="boton-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>
    </>
  )
}

export default Inventario
