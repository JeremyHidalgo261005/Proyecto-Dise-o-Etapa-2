import { useEffect, useRef, useState } from 'react'
import { consultarVentas, factura, fechaVenta, metodoPago, monto } from './apiVentas'
import './HistorialVentas.css'

const inicial = { factura: '', fecha: '', metodo_pago: '' }

function HistorialVentas({ cambiarPagina, origen }) {
  const [filtros, setFiltros] = useState(inicial)
  const [consulta, setConsulta] = useState({ filtros: inicial, pagina: 1 })
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')
  const [seleccion, setSeleccion] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [errorDetalle, setErrorDetalle] = useState('')
  const ventana = useRef(null)

  useEffect(() => {
    const controlador = new AbortController()
    const parametros = new URLSearchParams({ page: consulta.pagina })
    for (const [nombre, valor] of Object.entries(consulta.filtros)) {
      if (valor.trim()) parametros.set(nombre, valor.trim())
    }
    consultarVentas('historial/?' + parametros, controlador.signal).then(setResultado).catch((error) => {
      if (error.name !== 'AbortError') setError(error.message)
    })
    return () => controlador.abort()
  }, [consulta])

  useEffect(() => {
    if (!seleccion) return
    const controlador = new AbortController()
    consultarVentas(seleccion.id_venta + '/', controlador.signal).then(setDetalle).catch((error) => {
      if (error.name !== 'AbortError') setErrorDetalle(error.message)
    })
    return () => controlador.abort()
  }, [seleccion])

  function buscar(pagina, nuevosFiltros = consulta.filtros) {
    setResultado(null)
    setError('')
    setConsulta({ filtros: nuevosFiltros, pagina })
  }

  function cambiarFiltro(evento) {
    const { name, value } = evento.target
    setFiltros((anteriores) => ({ ...anteriores, [name]: value }))
  }

  function abrirDetalle(venta) {
    setSeleccion(venta)
    setDetalle(null)
    setErrorDetalle('')
    ventana.current.showModal()
  }

  const filas = resultado?.results || []

  return (
    <>
      <button type="button" className="boton-volver productos-volver" onClick={() => cambiarPagina(origen)}>
        {origen === 'Ventas' ? 'Volver a Ventas' : 'Volver al Dashboard'}
      </button>

      <section className="seccion panel">
        <h2>Ventas registradas</h2>
        <form className="productos-formulario historial-filtros"
          onSubmit={(evento) => { evento.preventDefault(); buscar(1, filtros) }}>
          <label>
            Número de factura
            <input name="factura" placeholder="FAC-123" value={filtros.factura} onChange={cambiarFiltro} />
          </label>
          <label>
            Fecha
            <input name="fecha" type="date" value={filtros.fecha} onChange={cambiarFiltro} />
          </label>
          <label>
            Método de pago
            <select name="metodo_pago" value={filtros.metodo_pago} onChange={cambiarFiltro}>
              <option value="">Todos los métodos</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </label>
          <div className="historial-acciones">
            <button type="submit" className="boton-volver">Buscar</button>
            <button type="button" className="productos-boton-secundario" onClick={() => {
              setFiltros(inicial)
              buscar(1, inicial)
            }}>
              Limpiar
            </button>
          </div>
        </form>

        <div className="tabla-contenedor" role="region" aria-label="Historial de ventas" tabIndex={0}>
          <table className="historial-tabla">
            <thead>
              <tr>
                <th>Factura</th><th>Fecha y hora</th><th>Cajero</th><th>Artículos</th>
                <th>Subtotal</th><th>Descuento</th><th>Total</th><th>Método de pago</th><th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((venta) => (
                <tr key={venta.id_venta}>
                  <td>{factura(venta.id_venta)}</td>
                  <td>{fechaVenta(venta.fecha)}</td>
                  <td>{venta.cajero}</td>
                  <td>{venta.cantidad_articulos}</td>
                  <td>{monto(venta.subtotal)}</td>
                  <td>{monto(venta.descuento)}</td>
                  <td>{monto(venta.total)}</td>
                  <td>{metodoPago(venta.metodo_pago)}</td>
                  <td>
                    <button type="button" className="productos-boton-secundario"
                      aria-label={'Ver detalle de ' + factura(venta.id_venta)} onClick={() => abrirDetalle(venta)}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
              {!filas.length && (
                <tr><td colSpan="9" className="tabla-vacia">
                  {error ? <span role="alert">{error}</span>
                    : resultado ? 'No hay ventas para esta consulta.' : 'Consultando ventas…'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {resultado?.count > 0 && (
          <nav className="historial-paginacion" aria-label="Páginas de ventas">
            <button type="button" className="productos-boton-secundario" disabled={!resultado.previous}
              onClick={() => buscar(consulta.pagina - 1)}>
              Anterior
            </button>
            <span role="status">Página {consulta.pagina} · {resultado.count} ventas</span>
            <button type="button" className="productos-boton-secundario" disabled={!resultado.next}
              onClick={() => buscar(consulta.pagina + 1)}>
              Siguiente
            </button>
          </nav>
        )}
      </section>

      <dialog ref={ventana} className="panel modal-caja historial-detalle" aria-labelledby="factura-detalle"
        onClose={() => setSeleccion(null)}>
        <header className="productos-encabezado">
          <h2 id="factura-detalle">{seleccion ? factura(seleccion.id_venta) : 'Detalle de venta'}</h2>
          <form method="dialog"><button className="productos-boton-secundario">Cerrar</button></form>
        </header>
        {seleccion && (
          <p>{fechaVenta(seleccion.fecha)} · {seleccion.cajero} · {metodoPago(seleccion.metodo_pago)}</p>
        )}
        {errorDetalle && <p role="alert">{errorDetalle}</p>}
        {seleccion && !detalle && !errorDetalle && <p role="status">Consultando artículos…</p>}
        {detalle && seleccion && (
          <>
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr>
                </thead>
                <tbody>
                  {detalle.detalles.map((linea) => (
                    <tr key={linea.id_detalle}>
                      <td>{linea.producto_nombre}</td><td>{linea.cantidad}</td>
                      <td>{monto(linea.precio_unitario)}</td><td>{monto(linea.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="historial-totales">
              <dt>Subtotal</dt><dd>{monto(seleccion.subtotal)}</dd>
              <dt>Descuento</dt><dd>{monto(seleccion.descuento)}</dd>
              <dt>Total</dt><dd>{monto(seleccion.total)}</dd>
            </dl>
          </>
        )}
      </dialog>
    </>
  )
}

export default HistorialVentas
