import { BarraSeleccion, CabeceraSeleccion, CeldaSeleccion } from '../components/SeleccionTabla'
import { useSeleccionTabla } from '../components/useSeleccionTabla'
import { EsqueletoTabla, IndicadorCarga } from '../components/CargaUI'
import { useErrorConAviso, useNotificar } from '../components/avisos'
import { cerrarConAnimacion } from '../components/transiciones'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Productos.css'
import './Inventario.css'

const RUTA = '/api/movimientos-inventario/'
const AJUSTE = 'ajuste'
const Otro = 'Otro'
const opciones = {
  ajuste: {
    titulo: 'Ajuste de cantidad', campo: 'stock_actual', entrada: 'stock_nuevo',
    actual: 'Cantidad actual', nuevo: 'Nueva cantidad',
    motivos: ['Ingreso de mercadería', 'Producto dañado', 'Producto vencido', 'Pérdida de mercadería', 'Corrección de inventario']
  },
  cambio_precio: {
    titulo: 'Cambio de precio de venta', campo: 'precio', entrada: 'precio_nuevo',
    actual: 'Precio de venta actual', nuevo: 'Nuevo precio de venta', monetario: true,
    motivos: ['Aumento de precio', 'Disminución de precio', 'Promoción', 'Corrección de precio']
  },
  cambio_costo: {
    titulo: 'Cambio de costo', campo: 'costo', entrada: 'costo_nuevo',
    actual: 'Costo actual', nuevo: 'Nuevo costo', monetario: true,
    motivos: ['Aumento de costo', 'Disminución de costo', 'Negociación con el proveedor', 'Corrección de costo']
  },
  cambio_proveedor: {
    titulo: 'Cambio de proveedor', campo: 'proveedor', entrada: 'proveedor_nuevo',
    actual: 'Proveedor actual', nuevo: 'Seleccionar nuevo proveedor', catalogo: 'proveedores',
    motivos: ['Cambio de distribuidor', 'Mejores precios', 'Disponibilidad de productos', 'Corrección de proveedor']
  },
  cambio_categoria: {
    titulo: 'Cambio de categoría', campo: 'categoria', entrada: 'categoria_nueva',
    actual: 'Categoría actual', nuevo: 'Seleccionar nueva categoría', catalogo: 'categorias',
    motivos: ['Reclasificación del producto', 'Corrección de categoría', 'Organización del inventario']
  }
}
const tiposAutomaticos = { ingreso: 'Ingreso', venta: 'Salida por venta' }
const detalleInicial = { nuevo: '', motivo: '', otro: '' }
const moneda = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
const fecha = new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' })

async function solicitar(ruta, opciones) {
  const respuesta = await fetch(ruta, { credentials: 'same-origin', ...opciones }).catch((error) => {
    if (error.name === 'AbortError') throw error
    throw new Error('No se pudo conectar con el servidor.')
  })
  const contenido = respuesta.headers.get('content-type') || ''
  const datos = contenido.includes('application/json') ? await respuesta.json().catch(() => null) : null
  if (!respuesta.ok) {
    const mensaje = datos && (datos.detail || Object.values(datos).flat().find((valor) => typeof valor === 'string'))
    throw new Error(mensaje || 'No se pudo completar la operación (' + respuesta.status + ').')
  }
  if (datos === null) throw new Error('El servidor devolvió una respuesta inesperada.')
  return datos
}

async function cargarLista(ruta, signal) {
  const elementos = []
  while (ruta) {
    const datos = await solicitar(ruta, { signal })
    const pagina = Array.isArray(datos) ? datos : datos.results
    if (!Array.isArray(pagina)) throw new Error('El servidor devolvió una lista con un formato inesperado.')
    elementos.push(...pagina)
    const siguiente = datos.next && new URL(datos.next, window.location.origin)
    ruta = siguiente ? siguiente.pathname + siguiente.search : null
  }
  return elementos
}

function valoresHistorial(movimiento) {
  const { tipo_movimiento: tipo } = movimiento
  if (tipo === 'cambio_precio') {
    return [moneda.format(movimiento.precio_anterior), moneda.format(movimiento.precio_nuevo)]
  }
  if (tipo === 'cambio_costo') {
    return [moneda.format(movimiento.valor_anterior), moneda.format(movimiento.valor_nuevo)]
  }
  if (opciones[tipo]?.catalogo) return [movimiento.valor_anterior, movimiento.valor_nuevo]
  return [movimiento.stock_anterior, movimiento.stock_resultante]
}

function useModalEnPantalla(abierto, fondoRef) {
  useLayoutEffect(() => {
    if (!abierto) return

    const fondo = fondoRef.current
    const viewport = window.visualViewport
    const raiz = document.documentElement
    const cuerpo = document.body
    const { scrollX, scrollY } = window
    const estilosOriginales = {
      position: cuerpo.style.position,
      top: cuerpo.style.top,
      left: cuerpo.style.left,
      width: cuerpo.style.width
    }
    const overflowOriginal = raiz.style.overflow

    raiz.style.overflow = 'hidden'
    Object.assign(cuerpo.style, {
      position: 'fixed',
      top: -scrollY + 'px',
      left: -scrollX + 'px',
      width: '100%'
    })

    function ajustarAreaVisible() {
      if (!viewport) return
      Object.assign(fondo.style, {
        top: viewport.offsetTop + 'px',
        left: viewport.offsetLeft + 'px',
        width: viewport.width + 'px',
        height: viewport.height + 'px'
      })
    }

    ajustarAreaVisible()
    fondo.querySelector('[name="nuevo"]')?.focus({ preventScroll: true })
    viewport?.addEventListener('resize', ajustarAreaVisible)
    viewport?.addEventListener('scroll', ajustarAreaVisible)
    return () => {
      viewport?.removeEventListener('resize', ajustarAreaVisible)
      viewport?.removeEventListener('scroll', ajustarAreaVisible)
      Object.assign(cuerpo.style, estilosOriginales)
      raiz.style.overflow = overflowOriginal
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
    }
  }, [abierto, fondoRef])
}

function datosDetalle(movimiento) {
  const [anterior, nuevo] = valoresHistorial(movimiento)
  const cantidad = movimiento.tipo_movimiento === 'venta' ? -movimiento.cantidad : movimiento.cantidad
  return [
    ['Fecha', fecha.format(new Date(movimiento.fecha))],
    ['Producto', movimiento.producto_nombre],
    ['Tipo', opciones[movimiento.tipo_movimiento]?.titulo || tiposAutomaticos[movimiento.tipo_movimiento]],
    ['Cantidad', cantidad],
    ['Responsable', movimiento.usuario_nombre],
    ['Anterior', anterior],
    ['Nuevo', nuevo],
    ['Motivo', movimiento.motivo || '—']
  ]
}

function Inventario({ cambiarPagina, usuario }) {
  const esAdministrador = usuario?.rol === 'Administrador'
  const [movimientos, setMovimientos] = useState([])
  const [catalogos, setCatalogos] = useState({ productos: [], proveedores: [], categorias: [] })
  const seleccion = useSeleccionTabla(movimientos, 'id_movimiento')
  const [movimientoElegido] = seleccion.elegidos
  const [detalleHistorial, setDetalleHistorial] = useState(null)
  const dialogoHistorial = useRef(null)
  const [cargando, setCargando] = useState(true)
  const [errorHistorial, setErrorHistorial] = useErrorConAviso()
  const [errorCatalogo, setErrorCatalogo] = useErrorConAviso()
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [productoId, setProductoId] = useState('')
  const [tipo, setTipo] = useState('')
  const [detalle, setDetalle] = useState(detalleInicial)
  const [guardando, setGuardando] = useState(false)
  const enviando = useRef(false)
  const notificar = useNotificar()
  const [errorFormulario, setErrorFormulario] = useErrorConAviso()
  const producto = catalogos.productos.find((item) => String(item.id) === productoId)
  const opcion = opciones[tipo]
  const modalAbierto = Boolean(mostrarFormulario && producto && opcion)
  const fondoModalRef = useRef(null)
  useModalEnPantalla(modalAbierto, fondoModalRef)
  const relacionados = opcion?.catalogo ? catalogos[opcion.catalogo] : null
  const actual = producto?.[opcion?.campo]
  const mostrarActual = relacionados
    ? relacionados.find((item) => item.id === actual)?.nombre || '—'
    : opcion?.monetario && actual != null ? moneda.format(actual) : actual

  useEffect(() => {
    const controlador = new AbortController()
    cargarLista(RUTA, controlador.signal).then(setMovimientos).catch((error) => {
      if (error.name !== 'AbortError') setErrorHistorial(error.message)
    }).finally(() => {
      if (!controlador.signal.aborted) setCargando(false)
    })

    if (esAdministrador) {
      Promise.all([
        cargarLista('/api/productos/', controlador.signal),
        cargarLista('/api/proveedores/', controlador.signal),
        cargarLista('/api/categorias/', controlador.signal)
      ]).then(([productos, proveedores, categorias]) => {
        setCatalogos({ productos, proveedores, categorias })
      }).catch((error) => {
        if (error.name !== 'AbortError') setErrorCatalogo(error.message)
      })
    }
    return () => controlador.abort()
  }, [esAdministrador, setErrorHistorial, setErrorCatalogo])

  function limpiarDetalle() {
    setDetalle(detalleInicial)
    setErrorFormulario('')
  }

  function cancelar() {
    if (!enviando.current) cerrarDetalle()
  }

  function cerrarDetalle() {
    cerrarConAnimacion(fondoModalRef.current, () => {
      setTipo('')
      limpiarDetalle()
    })
  }

  function cambiarDetalle(evento) {
    const { name, value } = evento.target
    setDetalle((anterior) => ({ ...anterior, [name]: value }))
    setErrorFormulario('')
  }

  async function refrescarProducto(id) {
    const actualizado = await solicitar('/api/productos/' + id + '/')
    setCatalogos((anterior) => ({
      ...anterior,
      productos: anterior.productos.map((item) => item.id === actualizado.id ? actualizado : item)
    }))
  }

  async function registrar(evento) {
    evento.preventDefault()
    if (enviando.current || !modalAbierto) return
    const motivo = detalle.motivo === Otro ? detalle.otro.trim() : detalle.motivo
    if (!motivo) {
      setErrorFormulario('Indicá el motivo del movimiento.')
      return
    }

    enviando.current = true
    setGuardando(true)
    setErrorFormulario('')
    try {
      const { csrfToken } = await solicitar('/api/auth/csrf/')
      const movimiento = await solicitar(RUTA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({
          producto: producto.id, tipo_movimiento: tipo, motivo,
          [opcion.entrada]: opcion.monetario ? detalle.nuevo : Number(detalle.nuevo),
          ...(tipo === AJUSTE && { stock_esperado: producto.stock_actual })
        })
      })
      setMovimientos((anteriores) => [movimiento, ...anteriores])
      cerrarDetalle()
      notificar('Movimiento registrado correctamente.', 'exito')
      await Promise.allSettled([
        refrescarProducto(producto.id).catch(() => {
          setErrorCatalogo('El movimiento se guardó. Volvé a abrir Movimientos para actualizar el producto.')
        }),
        cargarLista(RUTA).then((lista) => {
          setMovimientos(lista)
          setErrorHistorial('')
        }).catch(() => {
          setErrorHistorial('El movimiento se guardó. Volvé a abrir Movimientos para actualizar el historial.')
        })
      ])
    } catch (error) {
      setErrorFormulario(error.message)
      if (tipo === AJUSTE) await refrescarProducto(producto.id).catch(() => {})
    } finally {
      enviando.current = false
      setGuardando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="boton-volver productos-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver
      </button>

      <section className="seccion panel">
        <header className="productos-encabezado">
          <h2>Historial de movimientos</h2>

          {esAdministrador && !mostrarFormulario && (
            <button type="button" className="boton-volver" onClick={() => setMostrarFormulario(true)}>
              Registrar movimiento
            </button>
          )}
        </header>

        {mostrarFormulario && (
          <div className="productos-formulario movimientos-selectores">
            <label>
              Seleccionar producto
              <select value={productoId} disabled={guardando || Boolean(errorCatalogo)}
                onChange={(evento) => { setProductoId(evento.target.value); limpiarDetalle() }}>
                <option value="">Seleccioná un producto</option>
                {catalogos.productos.map((item) => (
                  <option key={item.id} value={item.id}>{item.nombre} ({item.codigo})</option>
                ))}
              </select>
            </label>
            <label>
              Tipo de movimiento
              <select value={tipo} disabled={guardando || Boolean(errorCatalogo)}
                onChange={(evento) => { setTipo(evento.target.value); limpiarDetalle() }}>
                <option value="">Seleccioná un tipo</option>
                {Object.entries(opciones).map(([clave, configuracion]) => (
                  <option key={clave} value={clave}>{configuracion.titulo}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {errorCatalogo && mostrarFormulario && <p role="alert">{errorCatalogo}</p>}
        {errorHistorial && <p role="alert">{errorHistorial}</p>}

        {modalAbierto && createPortal(
          <div className="modal-fondo movimientos-modal-fondo" ref={fondoModalRef} onClick={cancelar}>
            <section className="modal-caja panel" role="dialog" aria-modal="true"
              aria-labelledby="movimiento-titulo" onClick={(evento) => evento.stopPropagation()}
              onKeyDown={(evento) => { if (evento.key === 'Escape') cancelar() }}>
              <h3 id="movimiento-titulo">{opcion.titulo}</h3>
              <p>{producto.nombre}</p>
              <form className="productos-formulario proveedores-formulario" onSubmit={registrar}>
                <label>
                  {opcion.actual}
                  <input value={mostrarActual ?? ''} readOnly />
                </label>
                <label>
                  {opcion.nuevo}
                  {relacionados ? (
                    <select name="nuevo" value={detalle.nuevo} onChange={cambiarDetalle} required>
                      <option value="">Seleccioná una opción</option>
                      {relacionados.filter((item) => item.id !== actual).map((item) => (
                        <option key={item.id} value={item.id}>{item.nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <input name="nuevo" type="number" min={opcion.monetario ? '0.01' : '0'}
                      step={opcion.monetario ? '0.01' : '1'} value={detalle.nuevo}
                      onChange={cambiarDetalle} required />
                  )}
                </label>
                <label>
                  Motivo
                  <select name="motivo" value={detalle.motivo} onChange={cambiarDetalle} required>
                    <option value="">Seleccioná un motivo</option>
                    {[...opcion.motivos, Otro].map((motivo) => (
                      <option key={motivo} value={motivo}>{motivo}</option>
                    ))}
                  </select>
                </label>
                {detalle.motivo === Otro && (
                  <label>
                    Especificá el motivo
                    <input name="otro" value={detalle.otro} onChange={cambiarDetalle} required />
                  </label>
                )}
                {errorFormulario && <p role="alert">{errorFormulario}</p>}
                <div className="productos-formulario-acciones">
                  <button type="button" className="productos-boton-secundario" disabled={guardando} onClick={cancelar}>
                    Cancelar
                  </button>
                  <button type="submit" className="boton-volver" disabled={guardando}>
                    {guardando ? <IndicadorCarga>Guardando…</IndicadorCarga> : 'Guardar'}
                  </button>
                </div>
              </form>
            </section>
          </div>,
          document.body
        )}

        <BarraSeleccion seleccion={seleccion} acciones={seleccion.elegidos.length === 1 ? [{
          icono: 'detalle', texto: 'Ver detalle', ejecutar: () => {
            setDetalleHistorial(movimientoElegido)
            dialogoHistorial.current.showModal()
          }
        }] : []} />
        <div className="tabla-contenedor" role="region" aria-label="Historial de movimientos" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <CabeceraSeleccion seleccion={seleccion} deshabilitada={!movimientos.length} />
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Responsable</th>
                <th>Anterior</th>
                <th>Nuevo</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((movimiento) => (
                <tr key={movimiento.id_movimiento} data-seleccionada={seleccion.marcada(movimiento)}>
                  <CeldaSeleccion marcada={seleccion.marcada(movimiento)}
                    nombre={'movimiento ' + movimiento.id_movimiento + ' de ' + movimiento.producto_nombre}
                    onChange={() => seleccion.alternar(movimiento.id_movimiento)} />
                  {datosDetalle(movimiento).map(([campo, valor]) => <td key={campo}>{valor ?? '—'}</td>)}
                </tr>
              ))}
              {cargando && <EsqueletoTabla columnas={9} mensaje="Cargando movimientos…" />}
              {!cargando && movimientos.length === 0 && !errorHistorial && (
                <tr>
                  <td colSpan="9" className="tabla-vacia">
                    Todavía no tenemos movimientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <dialog ref={dialogoHistorial} className="panel modal-caja historial-detalle movimiento-detalle"
        aria-labelledby="detalle-movimiento" onClose={() => setDetalleHistorial(null)}
        onCancel={(evento) => {
          evento.preventDefault()
          const dialogo = dialogoHistorial.current
          cerrarConAnimacion(dialogo, () => dialogo.close())
        }}>
        <header className="productos-encabezado">
          <h2 id="detalle-movimiento">Movimiento {detalleHistorial?.id_movimiento}</h2>
          <button type="button" className="productos-boton-secundario" onClick={() => {
            const dialogo = dialogoHistorial.current
            cerrarConAnimacion(dialogo, () => dialogo.close())
          }}>Cerrar</button>
        </header>
        {detalleHistorial && (
          <dl>
            {datosDetalle(detalleHistorial).map(([campo, valor]) => (
              <Fragment key={campo}><dt>{campo}</dt><dd>{valor ?? '—'}</dd></Fragment>
            ))}
          </dl>
        )}
      </dialog>
    </>
  )
}

export default Inventario
