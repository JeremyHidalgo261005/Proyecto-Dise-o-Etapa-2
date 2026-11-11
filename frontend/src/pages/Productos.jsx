
function Productos({ cambiarPagina }) {
  return (
    <section className="panel pagina-pendiente">
      <h2>Administración de productos</h2>

      <p>
        Desde aquí podremos consultar, registrar,
        modificar y eliminar los productos del minisúper.
      </p>

      <p>
        Próximamente mostraremos los productos
        almacenados en PostgreSQL.
      </p>

      <button
        className="boton-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>
    </section>
  )
}

export default Productos
