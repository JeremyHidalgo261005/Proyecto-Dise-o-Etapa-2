import { useEffect, useState } from 'react'
import { consultarVentas, factura, fechaVenta, metodoPago, monto } from './apiVentas'
import IconoNavegacion from '../components/IconoNavegacion'
import './Dashboard.css'

function Acceso({ titulo, descripcion, color, destino, cambiarPagina }) {
  return (
    <button type="button" className={'atajo-card atajo-' + color} onClick={() => cambiarPagina(destino)}>
      <span className="atajo-icono" aria-hidden="true"><IconoNavegacion destino={destino} /></span>
      <span className="atajo-texto">
        <strong>{titulo}</strong>
        <small>{descripcion}</small>
      </span>
      <span className="atajo-flecha" aria-hidden="true">→</span>
    </button>
  )
}

function Dashboard({ cambiarPagina, usuario }) {
  const esAdministrador = usuario?.rol === 'Administrador'
  const [mostrarGestion, setMostrarGestion] = useState(false)
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controlador = new AbortController()
    consultarVentas('resumen/', controlador.signal).then(setResumen).catch((error) => {
      if (error.name !== 'AbortError') setError(error.message)
    })
    return () => controlador.abort()
  }, [])

  const tarjetas = [
    ['Productos registrados', resumen?.productos_registrados],
    ['Ventas del día', resumen?.ventas_del_dia],
    ['Productos con stock bajo', resumen?.productos_stock_bajo]
  ]
  const recientes = resumen?.ventas_recientes || []

  return (
    <div className="dashboard">
      <section className="seccion">
        <h2>Accesos rápidos</h2>
        <div className="atajos-grid atajos-principales">
          <div className={esAdministrador ? 'atajo-con-opciones' : undefined}>
            <Acceso titulo="Nueva venta" descripcion="Registrar una venta"
              color="lila" destino="Ventas" cambiarPagina={cambiarPagina} />
            {esAdministrador && (
              <button type="button" className="atajo-opciones"
                aria-label={mostrarGestion ? 'Ocultar accesos de gestión' : 'Mostrar accesos de gestión'}
                aria-expanded={mostrarGestion} aria-controls="accesos-gestion"
                onClick={() => setMostrarGestion(!mostrarGestion)}>
                <span aria-hidden="true">{mostrarGestion ? '×' : '⋮'}</span>
              </button>
            )}
          </div>
          <Acceso titulo="Inventario" descripcion={esAdministrador ? 'Administrar productos' : 'Consultar productos'}
            color="menta" destino="Inventario" cambiarPagina={cambiarPagina} />
        </div>

        {esAdministrador && (
          <div id="accesos-gestion" className="atajos-grid atajos-gestion" hidden={!mostrarGestion}>
            {mostrarGestion && (
              <>
                <Acceso titulo="Categorías" descripcion="Administrar categorías"
                  color="crema" destino="Categorias" cambiarPagina={cambiarPagina} />
                <Acceso titulo="Proveedores" descripcion="Administrar proveedores"
                  color="rosa" destino="Proveedores" cambiarPagina={cambiarPagina} />
              </>
            )}
          </div>
        )}
      </section>

      <section className="resumen-grid" aria-label="Resumen general" aria-busy={!resumen && !error}>
        {tarjetas.map(([titulo, numero]) => (
          <article className="resumen-card dashboard-indicador" key={titulo}>
            <h3>{titulo}</h3>
            <p>{numero ?? '—'}</p>
          </article>
        ))}
      </section>

      <section className="seccion panel ventas-recientes">
        <header className="productos-encabezado">
          <h2>Ventas recientes</h2>
          <button type="button" className="boton-volver"
            onClick={() => cambiarPagina('Historial de ventas')}>
            Ver todas las ventas
          </button>
        </header>
        <div className="tabla-contenedor" role="region" aria-label="Ventas recientes" tabIndex={0}>
          <table>
            <thead>
              <tr><th>Factura</th><th>Fecha y hora</th><th>Total</th><th>Método de pago</th></tr>
            </thead>
            <tbody>
              {recientes.map((venta) => (
                <tr key={venta.id_venta}>
                  <td>{factura(venta.id_venta)}</td>
                  <td>{fechaVenta(venta.fecha)}</td>
                  <td>{monto(venta.total)}</td>
                  <td>{metodoPago(venta.metodo_pago)}</td>
                </tr>
              ))}
              {recientes.length === 0 && (
                <tr><td colSpan="4" className="tabla-vacia">
                  {error ? <span role="alert">{error}</span>
                    : resumen ? 'Todavía no hay ventas registradas.' : 'Consultando ventas…'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
