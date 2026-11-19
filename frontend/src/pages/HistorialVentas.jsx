import { BarraSeleccion, CabeceraSeleccion, CeldaSeleccion } from '../components/SeleccionTabla'
import { useSeleccionTabla } from '../components/useSeleccionTabla'
import imprimirFactura from './imprimirFactura'
import { BloqueCarga, EsqueletoTabla } from '../components/CargaUI'
import { useErrorConAviso } from '../components/avisos'
import { cerrarConAnimacion } from '../components/transiciones'
import { useCallback, useEffect, useRef, useState } from 'react'
import { consultarVentas, factura, fechaVenta, metodoPago, monto } from './apiVentas'
import './HistorialVentas.css'

const inicial = { factura: '', fecha: '', metodo_pago: '' }

function HistorialVentas({ cambiarPagina, origen }) {
  const [filtros, setFiltros] = useState(inicial)
  const [consulta, setConsulta] = useState({ filtros: inicial, pagina: 1 })
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useErrorConAviso()
  const [seleccion, setSeleccion] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [errorDetalle, setErrorDetalle] = useErrorConAviso()
  const ventana = useRef(null)
  const imprimirAlCargar = useRef(false)
  const contenidoFactura = useRef(null)

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
  }, [consulta, setError])

  useEffect(() => {
    if (!seleccion) return
    const controlador = new AbortController()
    consultarVentas(seleccion.id_venta + '/', controlador.signal).then(setDetalle).catch((error) => {
      if (error.name !== 'AbortError') setErrorDetalle(error.message)
    })
    return () => controlador.abort()
  }, [seleccion, setErrorDetalle])

  const imprimirDetalle = useCallback(() => {
    try {
      imprimirFactura(contenidoFactura.current, factura(seleccion.id_venta))
    } catch (error) {
      setErrorDetalle(error.message)
    }
  }, [seleccion, setErrorDetalle])

  useEffect(() => {
    if (detalle && seleccion && imprimirAlCargar.current) {
      imprimirAlCargar.current = false
      imprimirDetalle()
    }
  }, [detalle, seleccion, imprimirDetalle])

  function buscar(pagina, nuevosFiltros = consulta.filtros) {
    seleccionTabla.limpiar()
    setResultado(null)
    setError('')
    setConsulta({ filtros: nuevosFiltros, pagina })
  }

  function cambiarFiltro(evento) {
    seleccionTabla.limpiar()
    const { name, value } = evento.target
    setFiltros((anteriores) => ({ ...anteriores, [name]: value }))
  }

  function abrirDetalle(venta, imprimir = false) {
    imprimirAlCargar.current = imprimir
    setSeleccion(venta)
    setDetalle(null)
    setErrorDetalle('')
    ventana.current.showModal()
  }

  function cerrarDetalle(evento) {
    evento.preventDefault()
    imprimirAlCargar.current = false
    const dialogo = ventana.current
    cerrarConAnimacion(dialogo, () => dialogo.close())
  }

  const filas = resultado?.results || []
  const seleccionTabla = useSeleccionTabla(filas, "id_venta")
  const [ventaElegida] = seleccionTabla.elegidos

  return (
    <>
      <button type="button" className="boton-volver productos-volver" onClick={() => cambiarPagina(origen)}>
        {origen === 'Ventas' ? 'Volver a Ventas' : 'Volver'}
      </button>

      <section className="seccion panel historial-ventas">
        <h2>Ventas registradas</h2>
        <form className="productos-formulario historial-filtros"
          onSubmit={(evento) => { evento.preventDefault(); buscar(1, filtros) }}>
          <label>
            Número de factura
            <input name="factura" data-tooltip="Buscar por número de factura" placeholder="FAC-123" value={filtros.factura} onChange={cambiarFiltro} />
          </label>
          <label>
            Fecha
            <input name="fecha" type="date" data-tooltip="Filtrar por fecha de venta" value={filtros.fecha} onChange={cambiarFiltro} />
          </label>
          <label>
            Método de pago
            <select name="metodo_pago" data-tooltip="Filtrar por método de pago" value={filtros.metodo_pago} onChange={cambiarFiltro}>
              <option value="">Todos los métodos</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </label>
          <div className="historial-acciones">
            <button type="submit" className="boton-volver" data-tooltip="Aplicar los filtros de ventas">Buscar</button>
            <button type="button" className="productos-boton-secundario" data-tooltip="Borrar los filtros" onClick={() => {
              setFiltros(inicial)
              buscar(1, inicial)
            }}>
              Limpiar
            </button>
          </div>
        </form>

        <BarraSeleccion seleccion={seleccionTabla} acciones={seleccionTabla.elegidos.length === 1 ? [
          { icono: 'detalle', texto: 'Ver detalle', ejecutar: () => abrirDetalle(ventaElegida) },
          { icono: 'imprimir', texto: 'Imprimir', ejecutar: () => abrirDetalle(ventaElegida, true) }
        ] : []} />
        <div className="tabla-contenedor" role="region" aria-label="Historial de ventas" tabIndex={0}>
          <table className="historial-tabla">
            <thead>
              <tr>
                <CabeceraSeleccion seleccion={seleccionTabla} deshabilitada={!filas.length} />
                <th>Factura</th><th>Fecha y hora</th><th>Cajero</th><th>Artículos</th>
                <th>Subtotal</th><th>Descuento</th><th>Total</th><th>Método de pago</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((venta) => (
                <tr key={venta.id_venta} data-seleccionada={seleccionTabla.marcada(venta)}>
                  <CeldaSeleccion marcada={seleccionTabla.marcada(venta)} nombre={factura(venta.id_venta)}
                    onChange={() => seleccionTabla.alternar(venta.id_venta)} />
                  <td>{factura(venta.id_venta)}</td>
                  <td>{fechaVenta(venta.fecha)}</td>
                  <td>{venta.cajero}</td>
                  <td>{venta.cantidad_articulos}</td>
                  <td>{monto(venta.subtotal)}</td>
                  <td>{monto(venta.descuento)}</td>
                  <td>{monto(venta.total)}</td>
                  <td>{metodoPago(venta.metodo_pago)}</td>
                </tr>
              ))}
              {!resultado && !error && <EsqueletoTabla columnas={9} mensaje="Consultando ventas…" />}
              {(error || (resultado && !filas.length)) && (
                <tr><td colSpan="9" className="tabla-vacia">
                  {error ? <span role="alert">{error}</span>
                    : 'No hay ventas para esta consulta.'}
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
        onClose={() => setSeleccion(null)} onCancel={cerrarDetalle}>
        <header className="productos-encabezado">
          <h2 id="factura-detalle">{seleccion ? factura(seleccion.id_venta) : 'Detalle de venta'}</h2>
          <div className="historial-acciones">
            {detalle && seleccion && (
              <button type="button" className="productos-boton-secundario historial-imprimir" onClick={imprimirDetalle}>Imprimir</button>
            )}
            <form method="dialog" onSubmit={cerrarDetalle}><button className="productos-boton-secundario">Cerrar</button></form>
          </div>
        </header>
        {seleccion && (
          <p>{fechaVenta(seleccion.fecha)} · {seleccion.cajero} · {metodoPago(seleccion.metodo_pago)}</p>
        )}
        {errorDetalle && <p role="alert">{errorDetalle}</p>}
        {seleccion && !detalle && !errorDetalle && <BloqueCarga mensaje="Consultando artículos…" />}
        {detalle && seleccion && (
          <div ref={contenidoFactura}>
            <div className="factura-impresa-encabezado">
              <h1>{factura(seleccion.id_venta)}</h1>
              <p>{fechaVenta(seleccion.fecha)} · {seleccion.cajero} · {metodoPago(seleccion.metodo_pago)}</p>
            </div>
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
          </div>
        )}
      </dialog>
    </>
  )
}

export default HistorialVentas
