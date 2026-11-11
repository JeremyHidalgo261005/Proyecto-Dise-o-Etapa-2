
function Proveedores({ cambiarPagina }) {
  return (
    <section className="panel pagina-pendiente">
      <h2>Administración de proveedores</h2>

      <p>
        Desde aquí podremos consultar, registrar,
        modificar y eliminar los proveedores
        del minisúper.
      </p>

      <p>
        Próximamente mostraremos los proveedores
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

export default Proveedores
