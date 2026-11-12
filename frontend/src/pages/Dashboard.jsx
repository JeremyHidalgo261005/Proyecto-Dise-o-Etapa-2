
import { useEffect, useState } from 'react'

// Consultar todos los productos, incluso si hay varias páginas
async function consultarProductos(signal) {
  const productos = []
  const paginasVisitadas = new Set()

  let ruta = '/api/productos/'

  while (ruta) {
    if (paginasVisitadas.has(ruta)) {
      throw new Error('Error al consultar las páginas de productos.')
    }

    paginasVisitadas.add(ruta)

    const respuesta = await fetch(ruta, {
      credentials: 'same-origin',
      signal
    })

    if (!respuesta.ok) {
      throw new Error(
        'No se pudieron consultar los productos.'
      )
    }

    const datos = await respuesta.json()

    // API sin paginación
    if (Array.isArray(datos)) {
      productos.push(...datos)
      break
    }

    // API con paginación
    if (!Array.isArray(datos.results)) {
      throw new Error(
        'La API devolvió un formato incorrecto.'
      )
    }

    productos.push(...datos.results)

    if (datos.next) {
      const siguiente = new URL(
        datos.next,
        window.location.origin
      )

      if (!siguiente.pathname.startsWith('/api/productos/')) {
        throw new Error('La API devolvió una página incorrecta.')
      }

      ruta = siguiente.pathname + siguiente.search
    } else {
      ruta = null
    }
  }

  return productos
}

function Dashboard({ cambiarPagina, usuario }) {
  const esAdministrador = usuario?.rol === 'Administrador'

  const [productos, setProductos] = useState([])
  const [cargandoProductos, setCargandoProductos] = useState(true)
  const [errorProductos, setErrorProductos] = useState('')

  // Cargar los productos reales desde Django
  useEffect(() => {
    const controlador = new AbortController()

    async function cargarProductos() {
      setCargandoProductos(true)
      setErrorProductos('')

      try {
        const datos = await consultarProductos(
          controlador.signal
        )

        if (!controlador.signal.aborted) {
          setProductos(datos)
        }

      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorProductos(error.message)
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargandoProductos(false)
        }
      }
    }

    cargarProductos()

    return () => controlador.abort()
  }, [])

  // Contar todos los productos registrados
  const totalProductos = productos.length

  // Contar productos con stock bajo
  const productosStockBajo = productos.filter((producto) => {
    const stockActual = Number(producto.stock_actual)
    const stockMinimo = Number(producto.stock_minimo)

    return (
      Number.isFinite(stockActual) &&
      Number.isFinite(stockMinimo) &&
      stockActual <= stockMinimo
    )
  }).length

  // Accesos rápidos del administrador
  const accesosAdministrador = [
    { nombre: 'Nueva venta', destino: 'Ventas' },
    { nombre: 'Nuevo producto', destino: 'Productos' },
    { nombre: 'Nueva categoría', destino: 'Categorias' },
    { nombre: 'Nuevo proveedor', destino: 'Proveedores' }
  ]

  // Accesos rápidos del cajero
  const accesosCajero = [
    { nombre: 'Nueva venta', destino: 'Ventas' },
    { nombre: 'Consultar productos', destino: 'Productos' }
  ]

  const accesos = esAdministrador
    ? accesosAdministrador
    : usuario?.rol === 'Cajero'
      ? accesosCajero
      : []

  return (
    <div className="dashboard">

      {/* ACCESOS RÁPIDOS */}
      <section className="seccion">
        <h2>Accesos rápidos</h2>

        <div className="accesos-grid">
          {accesos.map((acceso) => (
            <button
              key={acceso.nombre}
              type="button"
              className="acceso-card"
              onClick={() => cambiarPagina(acceso.destino)}
            >
              <span>{acceso.nombre}</span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>

      {/* RESUMEN GENERAL */}
      <section
        className="resumen-grid"
        aria-label="Resumen general"
      >

        {/* PRODUCTOS REGISTRADOS */}
        <article className="resumen-card">
          <h3>Productos registrados</h3>

          <div
            className="resumen-scroll"
            role="region"
            aria-label="Resumen de productos registrados"
            aria-live="polite"
          >
            {cargandoProductos ? (
              <>
                <p>...</p>
                <span>Cargando productos...</span>
              </>
            ) : errorProductos ? (
              <>
                <p>—</p>
                <span role="alert">{errorProductos}</span>
              </>
            ) : (
              <>
                <p>{totalProductos}</p>
                <span>Productos guardados en el sistema</span>
              </>
            )}
          </div>
        </article>

        {/* VENTAS DEL DÍA */}
        <article className="resumen-card">
          <h3>Ventas del día</h3>

          <div
            className="resumen-scroll"
            role="region"
            aria-label="Resumen de ventas del día"
          >
            <p>Pendiente</p>
            <span>Módulo de ventas por implementar</span>
          </div>
        </article>

        {/* PRODUCTOS CON STOCK BAJO */}
        <article className="resumen-card">
          <h3>Productos con stock bajo</h3>

          <div
            className="resumen-scroll"
            role="region"
            aria-label="Resumen de productos con stock bajo"
            aria-live="polite"
          >
            {cargandoProductos ? (
              <>
                <p>...</p>
                <span>Revisando existencias...</span>
              </>
            ) : errorProductos ? (
              <>
                <p>—</p>
                <span role="alert">{errorProductos}</span>
              </>
            ) : (
              <>
                <p>{productosStockBajo}</p>
                <span>
                  {productosStockBajo === 0
                    ? 'Sin productos con stock bajo'
                    : 'Productos que requieren atención'}
                </span>
              </>
            )}
          </div>
        </article>

      </section>

      {/* VENTAS RECIENTES */}
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
