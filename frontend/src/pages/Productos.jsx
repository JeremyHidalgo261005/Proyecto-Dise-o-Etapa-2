import { IndicadorCarga, TablaEnCarga } from '../components/CargaUI'
import { useErrorConAviso, useNotificar } from '../components/avisos'
import { cerrarConAnimacion } from '../components/transiciones'

import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmarLote from '../components/ConfirmarLote'
import { BarraSeleccion, CabeceraSeleccion, CeldaSeleccion } from '../components/SeleccionTabla'
import { useSeleccionTabla } from '../components/useSeleccionTabla'
import './Productos.css'

const formularioInicial = {
  nombre: '',
  codigo: '',
  costo: '',
  precio: '',
  stock_actual: '',
  stock_minimo: '',
  categoria: '',
  proveedor: '',
  estado: true
}

// Obtener el token de seguridad de Django
async function obtenerTokenCSRF() {
  const respuesta = await fetch('/api/auth/csrf/', {
    credentials: 'same-origin'
  })

  if (!respuesta.ok) {
    throw new Error(
      'No se pudo obtener el token de seguridad.'
    )
  }

  const datos = await respuesta.json()
  return datos.csrfToken
}

// Preparar mensajes de error enviados por la API
function obtenerMensajeError(datos, estado) {
  if (!datos || typeof datos !== 'object') {
    return `Ocurrió un error con la API (${estado}).`
  }

  return Object.entries(datos)
    .map(([campo, valor]) => {
      const detalle = Array.isArray(valor)
        ? valor.join(', ')
        : typeof valor === 'string'
          ? valor
          : JSON.stringify(valor)

      return campo === 'detail'
        ? detalle
        : `${campo}: ${detalle}`
    })
    .join(' | ')
}

// Realizar solicitudes a Django
async function solicitarAPI(ruta, opciones = {}) {
  const respuesta = await fetch(ruta, {
    credentials: 'same-origin',
    ...opciones
  })

  const tipo = respuesta.headers.get('content-type') || ''

  const datos = tipo.includes('application/json')
    ? await respuesta.json()
    : null

  if (!respuesta.ok) {
    throw new Error(
      obtenerMensajeError(datos, respuesta.status)
    )
  }

  return datos
}

// Consultar todos los registros, incluso si hay paginación
async function consultarTodos(rutaInicial, signal) {
  const registros = []
  const rutasVisitadas = new Set()

  let ruta = rutaInicial

  while (ruta) {
    if (rutasVisitadas.has(ruta)) {
      throw new Error('La API devolvió una paginación incorrecta.')
    }

    rutasVisitadas.add(ruta)

    const datos = await solicitarAPI(ruta, { signal })

    if (Array.isArray(datos)) {
      registros.push(...datos)
      break
    }

    if (!Array.isArray(datos?.results)) {
      throw new Error('La API devolvió un formato inesperado.')
    }

    registros.push(...datos.results)

    if (datos.next) {
      const siguiente = new URL(
        datos.next,
        window.location.origin
      )

      ruta = siguiente.pathname + siguiente.search
    } else {
      ruta = null
    }
  }

  return registros
}

function Productos({ cambiarPagina, usuario }) {
  const esAdministrador = usuario?.rol === 'Administrador'

  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [proveedores, setProveedores] = useState([])

  const [formulario, setFormulario] = useState(formularioInicial)
  const [editandoId, setEditandoId] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const enviandoFormulario = useRef(false)
  const fondoModal = useRef(null)
  const [porEliminar, setPorEliminar] = useState(null)

  const [errorCarga, setErrorCarga] = useErrorConAviso()
  const [errorFormulario, setErrorFormulario] = useErrorConAviso()
  const notificar = useNotificar()

  const modoEdicion = editandoId !== null
  const [modalAbierto, setModalAbierto] = useState(false)

  // Cargar información según el rol
  useEffect(() => {
    const controlador = new AbortController()

    async function cargarDatos() {
      setCargando(true)
      setErrorCarga('')

      try {
        // Ambos roles pueden consultar productos
        const listaProductos = await consultarTodos(
          '/api/productos/',
          controlador.signal
        )

        let listaCategorias = []
        let listaProveedores = []

        // Solo el administrador consulta estas API
        if (esAdministrador) {
          [listaCategorias, listaProveedores] =
            await Promise.all([
              consultarTodos(
                '/api/categorias/',
                controlador.signal
              ),
              consultarTodos(
                '/api/proveedores/',
                controlador.signal
              )
            ])
        }

        if (!controlador.signal.aborted) {
          setProductos(listaProductos)
          setCategorias(listaCategorias)
          setProveedores(listaProveedores)
        }

      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorCarga(error.message)
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false)
        }
      }
    }

    cargarDatos()

    return () => controlador.abort()
  }, [esAdministrador, setErrorCarga])

  // Actualizar los campos del formulario
  function cambiarCampo(evento) {
    const { name, value } = evento.target

    setFormulario((anterior) => ({
      ...anterior,
      [name]: name === 'estado'
        ? value === 'true'
        : value
    }))
  }

  // Limpiar el formulario
  const limpiarFormulario = useCallback(() => {
    setFormulario({ ...formularioInicial })
    setEditandoId(null)
    setErrorFormulario('')
  }, [setErrorFormulario])

  function abrirModalNuevo() {
    if (!esAdministrador) return

    limpiarFormulario()
    setModalAbierto(true)
  }

  const cerrarFormulario = useCallback(() => {
    cerrarConAnimacion(fondoModal.current, () => {
      limpiarFormulario()
      setModalAbierto(false)
    })
  }, [limpiarFormulario])

  const cerrarModal = useCallback(() => {
    if (!enviandoFormulario.current) cerrarFormulario()
  }, [cerrarFormulario])

  useEffect(() => {
    if (!modalAbierto) return

    function alPresionar(evento) {
      if (evento.key === 'Escape') cerrarModal()
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [modalAbierto, cerrarModal])


  // Cargar un producto para editarlo
  function editarProducto(producto) {
    if (!esAdministrador) return

    setEditandoId(producto.id)

    setFormulario({
      nombre: producto.nombre,
      codigo: producto.codigo,
      costo: String(producto.costo),
      precio: String(producto.precio),
      stock_actual: String(producto.stock_actual),
      stock_minimo: String(producto.stock_minimo),
      categoria: String(producto.categoria),
      proveedor: String(producto.proveedor),
      estado: producto.estado
    })

    setModalAbierto(true)
    setErrorFormulario('')
  }

  // Comprobar los datos antes de enviarlos
  function validarFormulario() {
    if (!formulario.nombre.trim()) {
      throw new Error(
        'El nombre del producto es obligatorio.'
      )
    }

    if (!formulario.codigo.trim()) {
      throw new Error(
        'El código del producto es obligatorio.'
      )
    }

    const costo = Number(formulario.costo)

    if (!Number.isFinite(costo) || costo <= 0) {
      throw new Error(
        'El costo debe ser mayor que cero.'
      )
    }

    const precio = Number(formulario.precio)

    if (!Number.isFinite(precio) || precio <= 0) {
      throw new Error(
        'El precio debe ser mayor que cero.'
      )
    }

    const stockMinimo = Number(formulario.stock_minimo)

    if (
      formulario.stock_minimo === '' ||
      !Number.isInteger(stockMinimo) ||
      stockMinimo < 0
    ) {
      throw new Error(
        'El stock mínimo debe ser un entero no negativo.'
      )
    }

    const stock = Number(formulario.stock_actual)
    if (formulario.stock_actual === '' || !Number.isInteger(stock) || stock < 0) {
      throw new Error('El stock debe ser un entero no negativo.')
    }

    if (!formulario.categoria) {
      throw new Error('Seleccioná una categoría.')
    }

    if (!formulario.proveedor) {
      throw new Error('Seleccioná un proveedor.')
    }
  }

  // CREATE y UPDATE
  async function guardarProducto(evento) {
    evento.preventDefault()

    if (!esAdministrador || enviandoFormulario.current) return

    setErrorFormulario('')
    enviandoFormulario.current = true
    setGuardando(true)

    try {
      validarFormulario()

      const token = await obtenerTokenCSRF()

      const datosProducto = {
        nombre: formulario.nombre.trim(),
        codigo: formulario.codigo.trim(),
        costo: formulario.costo,
        precio: formulario.precio,
        stock_minimo: Number(formulario.stock_minimo),
        categoria: Number(formulario.categoria),
        proveedor: Number(formulario.proveedor),
        estado: formulario.estado
      }

      const stock = Number(formulario.stock_actual)
      if (!modoEdicion) {
        datosProducto.stock_actual = stock
      }

      if (modoEdicion) {
        const actual = productos.find((producto) => producto.id === editandoId)
        if (stock !== actual.stock_actual) {
          datosProducto.stock_nuevo = stock
          datosProducto.stock_esperado = actual.stock_actual
        }

        for (const campo of ['precio', 'costo', 'proveedor', 'categoria']) {
          if (Number(datosProducto[campo]) === Number(actual[campo])) delete datosProducto[campo]
        }
        // UPDATE
        const actualizado = await solicitarAPI(
          `/api/productos/${editandoId}/`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': token
            },
            body: JSON.stringify(datosProducto)
          }
        )

        setProductos((anteriores) =>
          anteriores.map((producto) =>
            producto.id === editandoId
              ? actualizado
              : producto
          )
        )

        notificar('Producto actualizado correctamente.', 'exito')

      } else {
        // CREATE
        const creado = await solicitarAPI(
          '/api/productos/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': token
            },
            body: JSON.stringify(datosProducto)
          }
        )

        setProductos((anteriores) => [
          ...anteriores,
          creado
        ])

        notificar('Producto registrado correctamente.', 'exito')
      }

      cerrarFormulario()
    } catch (error) {
      setErrorFormulario(error.message)
    } finally {
      enviandoFormulario.current = false
      setGuardando(false)
    }
  }

  // DELETE
  async function eliminarProducto(producto) {
    if (!esAdministrador) return

    setErrorFormulario('')

    const token = await obtenerTokenCSRF()

    await solicitarAPI(
      `/api/productos/${producto.id}/`,
      {
        method: 'DELETE',
        headers: {
          'X-CSRFToken': token
        }
      }
    )

    setProductos((anteriores) =>
      anteriores.filter((item) =>
        item.id !== producto.id
      )
    )

    if (editandoId === producto.id) {
      limpiarFormulario()
    }
  }

  // Buscar productos
  const productosFiltrados = productos.filter((producto) => {
    const texto = `${producto.codigo} ${producto.nombre}`
      .toLowerCase()

    return texto.includes(
      busqueda.trim().toLowerCase()
    )
  })

  // Obtener nombre de la categoría
  function nombreCategoria(id) {
    const categoria = categorias.find(
      (item) => String(item.id) === String(id)
    )

    return categoria?.nombre || 'Sin categoría'
  }

  // Obtener nombre del proveedor
  function nombreProveedor(id) {
    const proveedor = proveedores.find(
      (item) => String(item.id) === String(id)
    )

    return proveedor?.nombre || 'Sin proveedor'
  }

  // Formato de precios en colones
  const formatoPrecio = new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 2
  })

  const seleccion = useSeleccionTabla(productosFiltrados)
  const [registro] = seleccion.elegidos

  return (
    <div className="productos-pagina">
      {porEliminar && (
        <ConfirmarLote registros={porEliminar} nombre={(registro) => registro.nombre}
          mensaje="¿Querés eliminar la selección? Esta acción no se puede deshacer."
          onCancelar={() => setPorEliminar(null)} ejecutar={eliminarProducto} alTerminar={seleccion.limpiar} />
      )}


      <button
        className="boton-volver productos-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>

      {/* FORMULARIO EXCLUSIVO DEL ADMINISTRADOR */}
      {esAdministrador && modalAbierto && (
        <div className="modal-fondo" ref={fondoModal} onClick={cerrarModal}>
          <section
            className="modal-caja modal-caja-ancha panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-producto"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="productos-encabezado">
              <div>
                <h2 id="titulo-modal-producto">
                  {modoEdicion
                    ? 'Editar producto'
                    : 'Registrar producto'}
                </h2>

                <p>
                  {modoEdicion
                    ? 'Modificá los datos del producto seleccionado.'
                    : 'Agregá un producto nuevo al minisúper.'}
                </p>
              </div>

              <button
                type="button"
                className="productos-boton-secundario"
                onClick={cerrarModal}
                disabled={guardando}
              >
                Cerrar
              </button>
            </div>

            {errorFormulario && (
              <p className="productos-error" role="alert">
                {errorFormulario}
              </p>
            )}

            <form
              className={modoEdicion ? 'productos-formulario' : 'productos-formulario productos-formulario-alta'}
              onSubmit={guardarProducto}
            >
              <label>
                Nombre del producto
                <input
                  type="text"
                  name="nombre"
                  placeholder={modoEdicion ? undefined : 'Ej. Arroz 1 kg'}
                  value={formulario.nombre}
                  onChange={cambiarCampo}
                  maxLength={150}
                  required
                />
              </label>

              <label>
                Código
                <input
                  type="text"
                  name="codigo"
                  placeholder={modoEdicion ? undefined : 'Ej. 001234'}
                  value={formulario.codigo}
                  onChange={cambiarCampo}
                  required
                />
              </label>

              <label>
                Costo (₡)
                <input
                  type="number"
                  name="costo"
                  placeholder={modoEdicion ? undefined : 'Ej. 800'}
                  value={formulario.costo}
                  onChange={cambiarCampo}
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>

              <label>
                Precio (₡)
                <input
                  type="number"
                  name="precio"
                  placeholder={modoEdicion ? undefined : 'Ej. 1200'}
                  value={formulario.precio}
                  onChange={cambiarCampo}
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>

              <label>
                {modoEdicion ? 'Existencias' : 'Existencias iniciales'}
                <input
                  type="number"
                  name="stock_actual"
                  placeholder={modoEdicion ? undefined : 'Ej. 50'}
                  value={formulario.stock_actual}
                  onChange={cambiarCampo}
                  min="0"
                  step="1"
                  required
                />

                {modoEdicion && (
                  <small>
                    Los cambios se registran en el historial de movimientos.
                  </small>
                )}
              </label>

              <label>
                Stock mínimo
                <input
                  type="number"
                  name="stock_minimo"
                  placeholder={modoEdicion ? undefined : 'Ej. 10'}
                  value={formulario.stock_minimo}
                  onChange={cambiarCampo}
                  min="0"
                  step="1"
                  required
                />
              </label>

              <label>
                Categoría
                <select
                  name="categoria"
                  value={formulario.categoria}
                  onChange={cambiarCampo}
                  required
                >
                  <option value="">
                    Seleccionar categoría
                  </option>

                  {categorias.map((categoria) => (
                    <option
                      key={categoria.id}
                      value={categoria.id}
                    >
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Proveedor
                <select
                  name="proveedor"
                  value={formulario.proveedor}
                  onChange={cambiarCampo}
                  required
                >
                  <option value="">
                    Seleccionar proveedor
                  </option>

                  {proveedores.map((proveedor) => (
                    <option
                      key={proveedor.id}
                      value={proveedor.id}
                    >
                      {proveedor.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="productos-formulario-estado">
                Estado
                <select
                  name="estado"
                  value={String(formulario.estado)}
                  onChange={cambiarCampo}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </label>

              <div className="productos-formulario-acciones">
                <button
                  type="submit"
                  className="boton-volver"
                  disabled={
                    guardando ||
                    cargando ||
                    Boolean(errorCarga)
                  }
                >
                  {guardando
                    ? <IndicadorCarga>Guardando…</IndicadorCarga>
                    : modoEdicion
                      ? 'Guardar cambios'
                      : 'Registrar producto'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {!modalAbierto && errorFormulario && (
        <p className="productos-error" role="alert">
          {errorFormulario}
        </p>
      )}

      {errorCarga && (
        <p className="productos-error" role="alert">
          {errorCarga}
        </p>
      )}

      {/* TABLA PARA AMBOS ROLES */}
      <section className="seccion panel">
        <div className="productos-encabezado">
          <div>
            <h2>
              {esAdministrador
                ? 'Productos registrados'
                : 'Consulta de productos'}
            </h2>

            <p>
              {esAdministrador
                ? 'Consultá y administrá los productos guardados en PostgreSQL.'
                : 'Consultá los productos disponibles y sus existencias.'}
            </p>
          </div>

          {esAdministrador && (
            <button
              type="button"
              className="boton-volver"
              onClick={abrirModalNuevo}
              disabled={guardando}
            >
              + Nuevo producto
            </button>
          )}
        </div>

        <div className="productos-barra-busqueda">
          <label htmlFor="buscar-productos">
            Buscar producto
          </label>

          <input
            id="buscar-productos"
            data-tooltip="Buscar por nombre o código"
            type="search"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(evento) => { seleccion.limpiar(); setBusqueda(evento.target.value) }}
          />
        </div>

        <BarraSeleccion seleccion={seleccion} acciones={esAdministrador ? [
          seleccion.elegidos.length === 1 && { icono: 'editar', texto: 'Editar', ejecutar: () => editarProducto(registro), deshabilitada: guardando },
          { icono: 'eliminar', texto: 'Eliminar', ejecutar: () => setPorEliminar(seleccion.elegidos), deshabilitada: guardando }
        ] : []} />

        {cargando ? (
          <TablaEnCarga columnas={esAdministrador ? 10 : 6} mensaje="Cargando productos…" />
        ) : !errorCarga && (
          <div
            className="tabla-contenedor productos-tabla-scroll"
            role="region"
            aria-label="Tabla de productos registrados"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <CabeceraSeleccion seleccion={seleccion} deshabilitada={!productosFiltrados.length} />
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Stock</th>

                  {esAdministrador && (
                    <>
                      <th>Costo</th>
                      <th>Mínimo</th>
                      <th>Categoría</th>
                      <th>Proveedor</th>
                    </>
                  )}

                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={esAdministrador ? 10 : 6}
                      className="tabla-vacia"
                    >
                      No se encontraron productos.
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((producto) => (
                    <tr key={producto.id} data-seleccionada={seleccion.marcada(producto)}>
                      <CeldaSeleccion marcada={seleccion.marcada(producto)} nombre={producto.nombre}
                        onChange={() => seleccion.alternar(producto.id)} />
                      <td>{producto.codigo}</td>

                      <td>{producto.nombre}</td>

                      <td>
                        {formatoPrecio.format(
                          Number(producto.precio)
                        )}
                      </td>

                      <td>{producto.stock_actual}</td>

                      {esAdministrador && (
                        <>
                          <td>
                            {formatoPrecio.format(
                              Number(producto.costo)
                            )}
                          </td>

                          <td>{producto.stock_minimo}</td>

                          <td>
                            {nombreCategoria(
                              producto.categoria
                            )}
                          </td>

                          <td>
                            {nombreProveedor(
                              producto.proveedor
                            )}
                          </td>
                        </>
                      )}

                      <td>
                        <span
                          className={
                            producto.estado
                              ? 'producto-estado activo'
                              : 'producto-estado inactivo'
                          }
                        >
                          {producto.estado
                            ? 'Activo'
                            : 'Inactivo'}
                        </span>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}

export default Productos
