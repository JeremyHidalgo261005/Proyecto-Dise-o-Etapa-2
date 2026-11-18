import { useState, useEffect, useRef } from 'react'
import './Ventas.css'

// Formateador en moneda local (Colones costarricenses - CRC)
const formatoCRC = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  maximumFractionDigits: 2
})

// PIN de prueba provisional para acciones de administrador
const PIN_ADMIN_DEFAULT = '1234'

function Ventas({ cambiarPagina, usuario }) {
  // Estado de catálogo de productos
  const [productos, setProductos] = useState([])
  const [cargandoProductos, setCargandoProductos] = useState(true)
  const [errorProductos, setErrorProductos] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // Estado de la factura actual (tiempo real)
  const [itemsFactura, setItemsFactura] = useState([])
  const [porcentajeDescuento, setPorcentajeDescuento] = useState(0)

  // 1. Modal de Autorización de Administrador (Eliminar artículo o Descuento)
  const [modalAdminAbierto, setModalAdminAbierto] = useState(false)
  const [accionAdmin, setAccionAdmin] = useState(null) // 'eliminar' | 'descuento'
  const [itemParaEliminar, setItemParaEliminar] = useState(null)
  const [descuentoTemporal, setDescuentoTemporal] = useState(10)
  const [pinAdmin, setPinAdmin] = useState('')
  const [mostrarPin, setMostrarPin] = useState(false)
  const [errorPin, setErrorPin] = useState('')

  // 2. Modal de Procesar Pago
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false)
  const [metodoPago, setMetodoPago] = useState('efectivo') // 'efectivo' | 'tarjeta'
  const [dineroAportado, setDineroAportado] = useState('')
  const [referenciaTarjeta, setReferenciaTarjeta] = useState('')
  const [errorPago, setErrorPago] = useState('')

  // 3. Modal de Venta Exitosa (Ticket / Factura final)
  const [ventaExitosa, setVentaExitosa] = useState(null)

  const inputBuscarRef = useRef(null)

  // Cargar productos desde la API
  useEffect(() => {
    const controlador = new AbortController()

    async function cargarCatalogo() {
      setCargandoProductos(true)
      setErrorProductos('')
      try {
        const respuesta = await fetch('/api/productos/', {
          credentials: 'same-origin',
          signal: controlador.signal
        })
        if (!respuesta.ok) {
          throw new Error('No se pudo cargar la lista de productos.')
        }
        const datos = await respuesta.json()
        const lista = Array.isArray(datos) ? datos : datos.results || []
        // Solo productos activos
        setProductos(lista.filter((p) => p.estado !== false))
      } catch (err) {
        if (err.name !== 'AbortError') {
          setErrorProductos(err.message)
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargandoProductos(false)
        }
      }
    }

    cargarCatalogo()
    return () => controlador.abort()
  }, [])

  // ==========================================
  // AGREGAR / MODIFICAR PRODUCTOS EN FACTURA
  // ==========================================
  function agregarProducto(producto) {
    if (!producto) return

    setItemsFactura((anteriores) => {
      const indice = anteriores.findIndex((it) => it.producto.id === producto.id)
      if (indice >= 0) {
        const copia = [...anteriores]
        const actual = copia[indice]
        const nuevaCantidad = actual.cantidad + 1
        copia[indice] = {
          ...actual,
          cantidad: nuevaCantidad,
          precioTotal: nuevaCantidad * actual.precioUnitario
        }
        return copia
      } else {
        const precioUnitario = Number(producto.precio)
        return [
          ...anteriores,
          {
            producto,
            cantidad: 1,
            precioUnitario,
            precioTotal: precioUnitario
          }
        ]
      }
    })
  }

  function modificarCantidad(idProducto, nuevaCantidad) {
    if (nuevaCantidad <= 0) {
      const item = itemsFactura.find((it) => it.producto.id === idProducto)
      if (item) solicitarEliminarArticulo(item)
      return
    }

    setItemsFactura((anteriores) =>
      anteriores.map((it) => {
        if (it.producto.id === idProducto) {
          return {
            ...it,
            cantidad: nuevaCantidad,
            precioTotal: nuevaCantidad * it.precioUnitario
          }
        }
        return it
      })
    )
  }

  // ==========================================
  // CÁLCULOS EN TIEMPO REAL
  // ==========================================
  const subtotal = itemsFactura.reduce((sum, item) => sum + item.precioTotal, 0)
  const montoDescuento = (subtotal * porcentajeDescuento) / 100
  const totalPagar = Math.max(0, subtotal - montoDescuento)

  // ==========================================
  // AUTORIZACIÓN PIN ADMINISTRADOR
  // ==========================================
  function solicitarEliminarArticulo(item) {
    setItemParaEliminar(item)
    setAccionAdmin('eliminar')
    setPinAdmin('')
    setMostrarPin(false)
    setErrorPin('')
    setModalAdminAbierto(true)
  }

  function solicitarAplicarDescuento() {
    if (itemsFactura.length === 0) return
    setDescuentoTemporal(porcentajeDescuento || 10)
    setAccionAdmin('descuento')
    setPinAdmin('')
    setMostrarPin(false)
    setErrorPin('')
    setModalAdminAbierto(true)
  }

  function autorizarAccionAdmin(evento) {
    evento.preventDefault()
    const pinLimpio = pinAdmin.trim()

    if (!pinLimpio) {
      setErrorPin('Por favor ingresá la clave del administrador.')
      return
    }

    // Validación provisional del PIN
    if (pinLimpio !== PIN_ADMIN_DEFAULT && usuario?.rol !== 'Administrador') {
      setErrorPin('Clave de administrador incorrecta. (PIN de prueba: 1234)')
      return
    }

    if (accionAdmin === 'eliminar' && itemParaEliminar) {
      setItemsFactura((prev) =>
        prev.filter((it) => it.producto.id !== itemParaEliminar.producto.id)
      )
      setItemParaEliminar(null)
      setModalAdminAbierto(false)
    } else if (accionAdmin === 'descuento') {
      const desc = Math.max(0, Math.min(100, Number(descuentoTemporal) || 0))
      setPorcentajeDescuento(desc)
      setModalAdminAbierto(false)
    }
  }

  // ==========================================
  // PROCESAMIENTO DE PAGO
  // ==========================================
  function abrirModalPago() {
    if (itemsFactura.length === 0) return
    setMetodoPago('efectivo')
    setDineroAportado(String(Math.ceil(totalPagar)))
    setReferenciaTarjeta('')
    setErrorPago('')
    setModalPagoAbierto(true)
  }

  const aportadoNumerico = Number(dineroAportado) || 0
  const vuelto = aportadoNumerico - totalPagar

  function procesarPago(evento) {
    evento.preventDefault()
    setErrorPago('')

    if (metodoPago === 'efectivo' && aportadoNumerico < totalPagar) {
      setErrorPago(
        `El dinero aportado es insuficiente. Faltan ${formatoCRC.format(
          totalPagar - aportadoNumerico
        )}`
      )
      return
    }

    const facturaGenerada = {
      numero: `FAC-${Date.now().toString().slice(-6)}`,
      fechaHora: new Date().toLocaleString('es-CR'),
      cajero: usuario?.nombre || 'Cajero de turno',
      items: [...itemsFactura],
      subtotal,
      descuento: montoDescuento,
      porcentajeDescuento,
      total: totalPagar,
      metodoPago,
      dineroAportado: metodoPago === 'efectivo' ? aportadoNumerico : totalPagar,
      vuelto: metodoPago === 'efectivo' ? vuelto : 0,
      referenciaTarjeta: metodoPago === 'tarjeta' ? referenciaTarjeta : null
    }

    setVentaExitosa(facturaGenerada)
    setModalPagoAbierto(false)
    setItemsFactura([])
    setPorcentajeDescuento(0)
  }

  function nuevaVenta() {
    setVentaExitosa(null)
    setItemsFactura([])
    setPorcentajeDescuento(0)
  }

  // Filtro de productos en catálogo
  const productosFiltrados = productos.filter((p) => {
    const term = busqueda.trim().toLowerCase()
    if (!term) return true
    return (
      p.nombre.toLowerCase().includes(term) ||
      (p.codigo && p.codigo.toLowerCase().includes(term))
    )
  })

  function manejarEnterBusqueda(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const exacto = productos.find(
        (p) =>
          p.codigo?.toLowerCase() === busqueda.trim().toLowerCase() ||
          p.nombre.toLowerCase() === busqueda.trim().toLowerCase()
      )
      if (exacto) {
        agregarProducto(exacto)
        setBusqueda('')
      } else if (productosFiltrados.length === 1) {
        agregarProducto(productosFiltrados[0])
        setBusqueda('')
      }
    }
  }

  return (
    <div className="ventas-modulo">
      {/* BARRA SUPERIOR */}
      <div className="ventas-cabecera">
        <div>
          <h2>Punto de Venta</h2>
          <p>Facturación y control de caja en tiempo real</p>
        </div>

        <button
          type="button"
          className="boton-volver"
          onClick={() => cambiarPagina('Dashboard')}
        >
          Volver al Dashboard
        </button>
      </div>

      {/* DISPOSICIÓN EN 2 COLUMNAS */}
      <div className="ventas-pantalla-grid">
        {/* COLUMNA 1: BÚSQUEDA Y SELECCIÓN DE PRODUCTOS */}
        <section className="panel ventas-panel-catalogo">
          <div className="catalogo-header">
            <h3><span>🔎</span> Catálogo de Productos</h3>
            <span className="atajo-info">Presioná Enter para agregar</span>
          </div>

          <div className="catalogo-buscador">
            <input
              ref={inputBuscarRef}
              type="text"
              placeholder="Buscar por nombre o código de barras..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={manejarEnterBusqueda}
              autoFocus
            />
            {busqueda && (
              <button
                type="button"
                className="btn-limpiar-busqueda"
                onClick={() => setBusqueda('')}
                title="Limpiar"
              >
                ✕
              </button>
            )}
          </div>

          {cargandoProductos ? (
            <div className="catalogo-cargando">Cargando productos...</div>
          ) : errorProductos ? (
            <div className="catalogo-error">⚠️ {errorProductos}</div>
          ) : (
            <div className="catalogo-scroll">
              {productosFiltrados.length === 0 ? (
                <p className="catalogo-vacio-texto">
                  No se encontraron productos coincidentes.
                </p>
              ) : (
                <div className="catalogo-lista">
                  {productosFiltrados.slice(0, 50).map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      className="catalogo-item"
                      onClick={() => agregarProducto(prod)}
                    >
                      <div className="item-meta">
                        <span className="item-codigo">{prod.codigo || 'S/C'}</span>
                        <span className="item-stock">Stock: {prod.stock_actual}</span>
                      </div>
                      <div className="item-nombre">{prod.nombre}</div>
                      <div className="item-precio-row">
                        <span className="item-precio">
                          {formatoCRC.format(Number(prod.precio))}
                        </span>
                        <span className="item-btn-agregar">+ Agregar</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* COLUMNA 2: FACTURA EN TIEMPO REAL */}
        <section className="panel ventas-panel-factura">
          <div className="factura-header">
            <div>
              <h3><span>🧾</span> Factura en Tiempo Real</h3>
              <p className="factura-subtitulo">
                {itemsFactura.length} {itemsFactura.length === 1 ? 'artículo' : 'artículos'}
              </p>
            </div>

            {itemsFactura.length > 0 && (
              <button
                type="button"
                className="btn-vaciar-factura"
                onClick={() => {
                  if (window.confirm('¿Deseás reiniciar la factura actual?')) {
                    setItemsFactura([])
                    setPorcentajeDescuento(0)
                  }
                }}
              >
                Limpiar factura
              </button>
            )}
          </div>

          {/* TABLA DE LA FACTURA */}
          <div className="factura-cuerpo-tabla">
            {itemsFactura.length === 0 ? (
              <div className="factura-vacia-aviso">
                <div className="factura-icono-vacio">🛒</div>
                <h4>Factura vacía</h4>
                <p>Seleccioná artículos del catálogo para agregarlos a la venta actual.</p>
              </div>
            ) : (
              <table className="tabla-factura">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th className="centrado">Cantidad</th>
                    <th className="alineado-derecha">P. Unitario</th>
                    <th className="alineado-derecha">Total</th>
                    <th className="centrado">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFactura.map((it) => (
                    <tr key={it.producto.id} className="factura-fila-item">
                      <td className="col-articulo">
                        <span className="nombre-prod">{it.producto.nombre}</span>
                        <small className="cod-prod">{it.producto.codigo}</small>
                      </td>

                      <td className="col-cantidad centrado">
                        <div className="control-cantidad">
                          <button
                            type="button"
                            className="btn-cambio-cant"
                            onClick={() =>
                              modificarCantidad(it.producto.id, it.cantidad - 1)
                            }
                            title="Restar"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={it.cantidad}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10)
                              if (!isNaN(v) && v >= 1) {
                                modificarCantidad(it.producto.id, v)
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn-cambio-cant"
                            onClick={() =>
                              modificarCantidad(it.producto.id, it.cantidad + 1)
                            }
                            title="Sumar"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td className="col-unitario alineado-derecha">
                        {formatoCRC.format(it.precioUnitario)}
                      </td>

                      <td className="col-total alineado-derecha">
                        <strong>{formatoCRC.format(it.precioTotal)}</strong>
                      </td>

                      <td className="col-accion centrado">
                        <button
                          type="button"
                          className="btn-eliminar-articulo"
                          onClick={() => solicitarEliminarArticulo(it)}
                          title="Eliminar artículo (Requiere PIN del administrador)"
                        >
                          <span className="candado-mini">🔒</span>
                          <span>Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* TOTALES Y BOTONES DE COBRO */}
          <div className="factura-totales-seccion">
            <div className="totales-linea">
              <span>Subtotal:</span>
              <span>{formatoCRC.format(subtotal)}</span>
            </div>

            {porcentajeDescuento > 0 && (
              <div className="totales-linea fila-descuento">
                <span>
                  Descuento ({porcentajeDescuento}%):
                  <button
                    type="button"
                    className="btn-quitar-desc"
                    onClick={() => setPorcentajeDescuento(0)}
                    title="Eliminar descuento"
                  >
                    ✕
                  </button>
                </span>
                <span>-{formatoCRC.format(montoDescuento)}</span>
              </div>
            )}

            <div className="totales-linea fila-total-grande">
              <span>Total a Pagar:</span>
              <strong className="cifra-total-grande">
                {formatoCRC.format(totalPagar)}
              </strong>
            </div>

            <div className="factura-acciones-botones">
              <button
                type="button"
                className="btn-aplicar-descuento"
                onClick={solicitarAplicarDescuento}
                disabled={itemsFactura.length === 0}
              >
                <span>🏷️</span> Aplicar Descuento
              </button>

              <button
                type="button"
                className="btn-procesar-pago"
                onClick={abrirModalPago}
                disabled={itemsFactura.length === 0}
              >
                <span>💳</span> Procesar Pago
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: AUTORIZACIÓN PIN ADMINISTRADOR                   */}
      {/* ========================================================= */}
      {modalAdminAbierto && (
        <div
          className="modal-fondo"
          onClick={() => setModalAdminAbierto(false)}
        >
          <div
            className="modal-caja modal-admin-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-admin-icono">🔐</div>
            <h3 className="modal-admin-titulo">
              {accionAdmin === 'eliminar'
                ? 'Autorización Requerida: Eliminar Artículo'
                : 'Autorización Requerida: Aplicar Descuento'}
            </h3>

            <p className="modal-admin-descripcion">
              {accionAdmin === 'eliminar'
                ? `Ingresá la clave del administrador para eliminar "${itemParaEliminar?.producto.nombre}" de la venta.`
                : 'Ingresá la clave del administrador para autorizar un descuento sobre el total de la venta.'}
            </p>

            <form onSubmit={autorizarAccionAdmin} className="modal-admin-form">
              {accionAdmin === 'descuento' && (
                <div className="form-campo-grupo">
                  <label htmlFor="input-porcentaje-descuento">
                    Porcentaje de descuento (%):
                  </label>
                  <div className="input-con-sufijo">
                    <input
                      id="input-porcentaje-descuento"
                      type="number"
                      min="1"
                      max="100"
                      value={descuentoTemporal}
                      onChange={(e) => setDescuentoTemporal(e.target.value)}
                      required
                    />
                    <span className="sufijo">%</span>
                  </div>
                  <div className="descuento-vista-previa">
                    Descuento calculado:{' '}
                    <strong>
                      {formatoCRC.format(
                        (subtotal * (Number(descuentoTemporal) || 0)) / 100
                      )}
                    </strong>
                  </div>
                </div>
              )}

              {/* INPUT DE PIN CON BOTÓN PARA MOSTRAR/OCULTAR PIN */}
              <div className="form-campo-grupo">
                <label htmlFor="input-pin-admin">Clave / PIN del Administrador:</label>
                <div className="input-pin-caja">
                  <input
                    id="input-pin-admin"
                    type={mostrarPin ? 'text' : 'password'}
                    placeholder="••••"
                    value={pinAdmin}
                    onChange={(e) => {
                      setPinAdmin(e.target.value)
                      setErrorPin('')
                    }}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    className="btn-toggle-ver-pin"
                    onClick={() => setMostrarPin(!mostrarPin)}
                    title={mostrarPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                  >
                    {mostrarPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                  </button>
                </div>
                <small className="pin-hint">
                  (PIN por defecto: <strong>1234</strong>)
                </small>
              </div>

              {errorPin && (
                <div className="modal-error-alerta" role="alert">
                  ⚠️ {errorPin}
                </div>
              )}

              <div className="modal-admin-botones">
                <button
                  type="button"
                  className="productos-boton-secundario"
                  onClick={() => setModalAdminAbierto(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="boton-volver btn-confirmar-admin">
                  {accionAdmin === 'eliminar' ? 'Eliminar Artículo' : 'Aplicar Descuento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: PROCESAR PAGO (EFECTIVO O TARJETA)                */}
      {/* ========================================================= */}
      {modalPagoAbierto && (
        <div
          className="modal-fondo"
          onClick={() => setModalPagoAbierto(false)}
        >
          <div
            className="modal-caja modal-pago-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-pago-header">
              <div>
                <h3>Procesar Pago</h3>
                <p>Elegí la forma de pago y completá la transacción</p>
              </div>
              <button
                type="button"
                className="btn-cerrar-modal"
                onClick={() => setModalPagoAbierto(false)}
              >
                ✕
              </button>
            </div>

            {/* TOTAL A PAGAR DESTACADO */}
            <div className="total-destacado-pago">
              <span className="etiqueta-total-pago">Total a Pagar</span>
              <strong className="monto-total-pago">
                {formatoCRC.format(totalPagar)}
              </strong>
            </div>

            {/* SELECTOR ENTRE EFECTIVO Y TARJETA */}
            <div className="selector-metodo-pago">
              <button
                type="button"
                className={`btn-selector ${metodoPago === 'efectivo' ? 'activo' : ''}`}
                onClick={() => {
                  setMetodoPago('efectivo')
                  setErrorPago('')
                }}
              >
                <span className="icono-metodo">💵</span>
                <span>Efectivo</span>
              </button>

              <button
                type="button"
                className={`btn-selector ${metodoPago === 'tarjeta' ? 'activo' : ''}`}
                onClick={() => {
                  setMetodoPago('tarjeta')
                  setErrorPago('')
                }}
              >
                <span className="icono-metodo">💳</span>
                <span>Tarjeta de Crédito</span>
              </button>
            </div>

            <form onSubmit={procesarPago} className="formulario-pago">
              {/* OPCIÓN EFECTIVO */}
              {metodoPago === 'efectivo' && (
                <div className="bloque-efectivo">
                  <label htmlFor="input-dinero-recibido">
                    Dinero aportado / recibido del cliente:
                  </label>
                  <div className="input-dinero-wrapper">
                    <span className="simbolo-dinero">₡</span>
                    <input
                      id="input-dinero-recibido"
                      type="number"
                      step="any"
                      min="0"
                      value={dineroAportado}
                      onChange={(e) => {
                        setDineroAportado(e.target.value)
                        setErrorPago('')
                      }}
                      className="input-monto-recibido"
                      autoFocus
                      required
                    />
                  </div>

                  {/* Atajos de billetes frecuentes */}
                  <div className="atajos-billetes">
                    <button
                      type="button"
                      onClick={() => setDineroAportado(String(Math.ceil(totalPagar)))}
                    >
                      Monto Exacto
                    </button>
                    {[1000, 2000, 5000, 10000, 20000].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setDineroAportado(String(b))}
                      >
                        {formatoCRC.format(b)}
                      </button>
                    ))}
                  </div>

                  {/* VUELTO EN TIEMPO REAL */}
                  <div
                    className={`caja-vuelto-real ${
                      vuelto >= 0 ? 'vuelto-ok' : 'vuelto-insuficiente'
                    }`}
                  >
                    <span className="vuelto-titulo">
                      {vuelto >= 0 ? 'Vuelto a devolver:' : 'Falta dinero:'}
                    </span>
                    <strong className="vuelto-valor">
                      {vuelto >= 0
                        ? formatoCRC.format(vuelto)
                        : formatoCRC.format(Math.abs(vuelto))}
                    </strong>
                  </div>
                </div>
              )}

              {/* OPCIÓN TARJETA */}
              {metodoPago === 'tarjeta' && (
                <div className="bloque-tarjeta">
                  <div className="tarjeta-indicacion">
                    <span className="icono-datafono">📟</span>
                    <p>
                      Procesá el cobro en el datáfono por un monto exacto de{' '}
                      <strong>{formatoCRC.format(totalPagar)}</strong>.
                    </p>
                  </div>

                  <label htmlFor="input-tarjeta-ref">
                    Código de autorización / comprobante (opcional):
                  </label>
                  <input
                    id="input-tarjeta-ref"
                    type="text"
                    placeholder="Ej. AUT-594830"
                    value={referenciaTarjeta}
                    onChange={(e) => setReferenciaTarjeta(e.target.value)}
                  />
                </div>
              )}

              {errorPago && (
                <div className="modal-error-alerta" role="alert">
                  ⚠️ {errorPago}
                </div>
              )}

              <div className="modal-pago-acciones">
                <button
                  type="button"
                  className="productos-boton-secundario"
                  onClick={() => setModalPagoAbierto(false)}
                >
                  Volver a la Factura
                </button>
                <button
                  type="submit"
                  className="boton-volver btn-confirmar-pago"
                  disabled={metodoPago === 'efectivo' && aportadoNumerico < totalPagar}
                >
                  ✓ Confirmar y Facturar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: COMPROBANTE FINAL (VENTA EXITOSA)                */}
      {/* ========================================================= */}
      {ventaExitosa && (
        <div className="modal-fondo">
          <div className="modal-caja comprobante-modal" role="dialog" aria-modal="true">
            <div className="comprobante-check">✓</div>
            <h3>¡Venta Registrada con Éxito!</h3>
            <p className="comprobante-sub">
              Factura #{ventaExitosa.numero} — {ventaExitosa.fechaHora}
            </p>

            <div className="comprobante-articulos-lista">
              {ventaExitosa.items.map((it, idx) => (
                <div key={idx} className="comprobante-articulo-fila">
                  <span>
                    {it.cantidad}x {it.producto.nombre}
                  </span>
                  <strong>{formatoCRC.format(it.precioTotal)}</strong>
                </div>
              ))}
            </div>

            <div className="comprobante-desglose-pago">
              {ventaExitosa.descuento > 0 && (
                <div className="desglose-linea">
                  <span>Descuento aplicado:</span>
                  <span>-{formatoCRC.format(ventaExitosa.descuento)}</span>
                </div>
              )}
              <div className="desglose-linea total">
                <span>Total Cobrado:</span>
                <strong>{formatoCRC.format(ventaExitosa.total)}</strong>
              </div>
              <div className="desglose-linea">
                <span>Método:</span>
                <span>
                  {ventaExitosa.metodoPago === 'efectivo' ? 'Efectivo' : 'Tarjeta de Crédito'}
                </span>
              </div>
              {ventaExitosa.metodoPago === 'efectivo' && (
                <>
                  <div className="desglose-linea">
                    <span>Dinero aportado:</span>
                    <span>{formatoCRC.format(ventaExitosa.dineroAportado)}</span>
                  </div>
                  <div className="desglose-linea vuelto-resaltado">
                    <span>Vuelto entregado:</span>
                    <strong>{formatoCRC.format(ventaExitosa.vuelto)}</strong>
                  </div>
                </>
              )}
            </div>

            <div className="comprobante-acciones">
              <button
                type="button"
                className="productos-boton-secundario"
                onClick={() => window.print()}
              >
                🖨️ Imprimir Factura
              </button>
              <button
                type="button"
                className="boton-volver"
                onClick={nuevaVenta}
              >
                + Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Ventas