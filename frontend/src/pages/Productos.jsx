
import { useEffect, useState } from 'react'
import './Productos.css'

const formularioInicial = {
  nombre: '',
  codigo: '',
  precio: '',
  stock_actual: '0',
  stock_minimo: '0',
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
  const [eliminandoId, setEliminandoId] = useState(null)

  const [errorCarga, setErrorCarga] = useState('')
  const [errorFormulario, setErrorFormulario] = useState('')
  const [mensaje, setMensaje] = useState('')

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
  }, [esAdministrador])

  useEffect(() => {
    if (!modalAbierto) return

    function alPresionar(evento) {
      if (evento.key === 'Escape') cerrarModal()
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [modalAbierto, guardando])

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
  function limpiarFormulario() {
    setFormulario({ ...formularioInicial })
    setEditandoId(null)
    setErrorFormulario('')
  }

  function abrirModalNuevo() {
    if (!esAdministrador) return

    limpiarFormulario()
    setMensaje('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    if (guardando) return
    limpiarFormulario()
    setModalAbierto(false)
  }

  // Cargar un producto para editarlo
  function editarProducto(producto) {
    if (!esAdministrador) return

    setEditandoId(producto.id)

    setFormulario({
      nombre: producto.nombre,
      codigo: producto.codigo,
      precio: String(producto.precio),
      stock_actual: String(producto.stock_actual),
      stock_minimo: String(producto.stock_minimo),
      categoria: String(producto.categoria),
      proveedor: String(producto.proveedor),
      estado: producto.estado
    })

    setModalAbierto(true)
    setErrorFormulario('')
    setMensaje('')
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

    const precio = Number(formulario.precio)

    if (!Number.isFinite(precio) || precio <= 0) {
      throw new Error(
        'El precio debe ser mayor que cero.'
      )
    }

    const stockMinimo = Number(formulario.stock_minimo)

    if (
      !Number.isInteger(stockMinimo) ||
      stockMinimo < 0
    ) {
      throw new Error(
        'El stock mínimo debe ser un entero no negativo.'
      )
    }

    if (!modoEdicion) {
      const stockInicial = Number(formulario.stock_actual)

      if (
        !Number.isInteger(stockInicial) ||
        stockInicial < 0
      ) {
        throw new Error(
          'El stock inicial debe ser un entero no negativo.'
        )
      }
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

    if (!esAdministrador || guardando) return

    setErrorFormulario('')
    setMensaje('')
    setGuardando(true)

    try {
      validarFormulario()

      const token = await obtenerTokenCSRF()

      const datosProducto = {
        nombre: formulario.nombre.trim(),
        codigo: formulario.codigo.trim(),
        precio: formulario.precio,
        stock_minimo: Number(formulario.stock_minimo),
        categoria: Number(formulario.categoria),
        proveedor: Number(formulario.proveedor),
        estado: formulario.estado
      }

      // El stock inicial solo se envía al registrar
      if (!modoEdicion) {
        datosProducto.stock_actual =
          Number(formulario.stock_actual)
      }

      if (modoEdicion) {
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

        setMensaje(
          'Producto actualizado correctamente.'
        )

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

        setMensaje(
          'Producto registrado correctamente.'
        )
      }

      limpiarFormulario()
      setModalAbierto(false)

    } catch (error) {
      setErrorFormulario(error.message)
    } finally {
      setGuardando(false)
    }
  }

  // DELETE
  async function eliminarProducto(producto) {
    if (!esAdministrador || eliminandoId !== null) return

    const confirmar = window.confirm(
      `¿Seguro que querés eliminar "${producto.nombre}"?\n\n` +
      'Esta acción no se puede deshacer.'
    )

    if (!confirmar) return

    setErrorFormulario('')
    setMensaje('')
    setEliminandoId(producto.id)

    try {
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

      setMensaje(
        'Producto eliminado correctamente.'
      )

    } catch (error) {
      setErrorFormulario(error.message)
    } finally {
      setEliminandoId(null)
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

  return (
    <div className="productos-pagina">

      <button
        className="boton-volver productos-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>

      {/* FORMULARIO EXCLUSIVO DEL ADMINISTRADOR */}
      {esAdministrador && modalAbierto && (
        <div className="modal-fondo" onClick={cerrarModal}>
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
              className="productos-formulario"
              onSubmit={guardarProducto}
            >
              <label>
                Nombre del producto
                <input
                  type="text"
                  name="nombre"
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
                  value={formulario.codigo}
                  onChange={cambiarCampo}
                  required
                />
              </label>

              <label>
                Precio (₡)
                <input
                  type="number"
                  name="precio"
                  value={formulario.precio}
                  onChange={cambiarCampo}
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>

              <label>
                Stock actual
                <input
                  type="number"
                  name="stock_actual"
                  value={formulario.stock_actual}
                  onChange={cambiarCampo}
                  min="0"
                  step="1"
                  disabled={modoEdicion}
                  required={!modoEdicion}
                />

                {modoEdicion && (
                  <small>
                    Las existencias se modificarán desde
                    movimientos de inventario.
                  </small>
                )}
              </label>

              <label>
                Stock mínimo
                <input
                  type="number"
                  name="stock_minimo"
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

              <label>
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
                    ? 'Guardando...'
                    : modoEdicion
                      ? 'Guardar cambios'
                      : 'Registrar producto'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MENSAJES */}
      {mensaje && (
        <p className="productos-exito" role="status">
          {mensaje}
        </p>
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
            type="search"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
          />
        </div>

        {cargando ? (
          <p>Cargando productos...</p>
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
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Stock</th>

                  {esAdministrador && (
                    <>
                      <th>Mínimo</th>
                      <th>Categoría</th>
                      <th>Proveedor</th>
                    </>
                  )}

                  <th>Estado</th>

                  {esAdministrador && (
                    <th>Acciones</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={esAdministrador ? 9 : 5}
                      className="tabla-vacia"
                    >
                      No se encontraron productos.
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((producto) => (
                    <tr key={producto.id}>
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

                      {esAdministrador && (
                        <td>
                          <div className="productos-acciones">
                            <button
                              type="button"
                              className="productos-editar"
                              onClick={() =>
                                editarProducto(producto)
                              }
                              disabled={
                                guardando ||
                                eliminandoId !== null
                              }
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="productos-eliminar"
                              onClick={() =>
                                eliminarProducto(producto)
                              }
                              disabled={
                                guardando ||
                                eliminandoId !== null
                              }
                            >
                              {eliminandoId === producto.id
                                ? 'Eliminando...'
                                : 'Eliminar'}
                            </button>
                          </div>
                        </td>
                      )}
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
