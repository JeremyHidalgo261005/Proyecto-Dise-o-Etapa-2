
function Ventas({ cambiarPagina }) {
  return (
    <section className="panel pagina-pendiente">
      <h2>Administración de ventas</h2>

      <p>
        Desde aquí podremos registrar nuevas ventas,
        consultar el historial y ver los detalles
        de cada venta realizada en el minisúper.
      </p>

      <p>
        Cuando registremos una venta, el sistema
        también deberá actualizar las existencias
        de los productos en el inventario.
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

export default Ventas
