
function Categorias({ cambiarPagina }) {
  return (
    <section className="panel pagina-pendiente">
      <h2>Administración de categorías</h2>

      <p>
        Desde aquí podremos consultar, agregar,
        modificar y eliminar las categorías
        de los productos del minisúper.
      </p>

      <p>
        Próximamente mostraremos las categorías
        registradas en PostgreSQL.
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

export default Categorias
