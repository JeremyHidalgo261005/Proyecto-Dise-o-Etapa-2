
function Dashboard({ cambiarPagina }) {
  const accesos = [
    { nombre: 'Nueva venta', destino: 'Ventas' },
    { nombre: 'Nuevo producto', destino: 'Productos' },
    { nombre: 'Nueva categoría', destino: 'Categorias' },
    { nombre: 'Nuevo proveedor', destino: 'Proveedores' }
  ]

  return (
    <div className="dashboard">

      <section className="seccion">
        <h2>Accesos rápidos</h2>

        <div className="accesos-grid">
          {accesos.map((acceso) => (
            <button
              key={acceso.nombre}
              className="acceso-card"
              onClick={() => cambiarPagina(acceso.destino)}
            >
              <span>{acceso.nombre}</span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>

      <section
        className="resumen-grid"
        aria-label="Resumen general"
      >

        <article className="resumen-card">
          <h3>Productos registrados</h3>

          <div
            className="resumen-scroll"
            role="region"
            aria-label="Resumen de productos registrados"
            tabIndex={0}
          >
            <p>Pendiente</p>
            <span>Sin conexión a la base de datos</span>
          </div>
        </article>

        <article className="resumen-card">
          <h3>Ventas del día</h3>

          <div
            className="resumen-scroll"
            role="region"
            aria-label="Resumen de ventas del día"
            tabIndex={0}
          >
            <p>Pendiente</p>
            <span>Sin ventas cargadas</span>
          </div>
        </article>

        <article className="resumen-card">
          <h3>Productos con stock bajo</h3>

          <div
            className="resumen-scroll"
            role="region"
            aria-label="Resumen de productos con stock bajo"
            tabIndex={0}
          >
            <p>Pendiente</p>
            <span>Sin inventario cargado</span>
          </div>
        </article>

      </section>

      <section className="seccion panel ventas-recientes">
        <h2>Ventas recientes</h2>

        <div
          className="tabla-contenedor dashboard-tabla-scroll"
          role="region"
          aria-label="Historial de ventas recientes"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>ID de venta</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td colSpan="4" className="tabla-vacia">
                  Todavía no hay ventas registradas.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}

export default Dashboard
