
import { useEffect, useRef, useState } from 'react'
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

function obtenerCSRF() {
  const cookie = document.cookie
    .split('; ')
    .find((valor) => valor.startsWith('csrftoken='))

  return cookie
    ? decodeURIComponent(cookie.substring('csrftoken='.length))
    : ''
}

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

async function solicitarAPI(ruta, opciones = {}) {
  const respuesta = await fetch(ruta, {
    credentials: 'same-origin',
    ...opciones
  })

  let datos = null

  const tipo = respuesta.headers.get('content-type') || ''

  if (tipo.includes('application/json')) {
    datos = await respuesta.json()
  }

  if (!respuesta.ok) {
    throw new Error(
      obtenerMensajeError(datos, respuesta.status)
    )
  }

  return datos
}

function obtenerLista(datos) {
  if (Array.isArray(datos)) {
    return datos
  }

  if (Array.isArray(datos?.results)) {
    return datos.results
  }

  throw new Error('La API devolvió un formato inesperado.')
}

function Productos({ cambiarPagina }) {
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

  const formularioRef = useRef(null)

  const modoEdicion = editandoId !== null

  // Cargar productos, categorías y proveedores
  useEffect(() => {
    const controlador = new AbortController()

    async function cargarDatos() {
      try {
        const opciones = {
          signal: controlador.signal
        }

        const [datosProductos, datosCategorias, datosProveedores] =
          await Promise.all([
            solicitarAPI('/api/productos/', opciones),
            solicitarAPI('/api/categorias/', opciones),
            solicitarAPI('/api/proveedores/', opciones)
          ])

        if (!controlador.signal.aborted) {
          setProductos(obtenerLista(datosProductos))
          setCategorias(obtenerLista(datosCategorias))
          setProveedores(obtenerLista(datosProveedores))
          setErrorCarga('')
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
  }, [])

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

  // Preparar formulario para registrar
  function nuevoProducto() {
    setEditandoId(null)
    setFormulario({ ...formularioInicial })
    setErrorFormulario('')
    setMensaje('')

    formularioRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  // Preparar formulario para editar
  function editarProducto(producto) {
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

    setErrorFormulario('')
    setMensaje('')

    formularioRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  // Validaciones del formulario
  function validarFormulario() {
    if (!formulario.nombre.trim()) {
      throw new Error('El nombre del producto es obligatorio.')
    }

    if (!formulario.codigo.trim()) {
      throw new Error('El código del producto es obligatorio.')
    }

    if (!Number.isFinite(Number(formulario.precio)) ||
        Number(formulario.precio) <= 0) {
      throw new Error('El precio debe ser mayor que cero.')
    }

    if (
      !Number.isInteger(Number(formulario.stock_minimo)) ||
      Number(formulario.stock_minimo) < 0
    ) {
      throw new Error(
        'El stock mínimo debe ser un número entero no negativo.'
      )
    }

    if (
      !modoEdicion &&
      (
        !Number.isInteger(Number(formulario.stock_actual)) ||
        Number(formulario.stock_actual) < 0
      )
    ) {
      throw new Error(
        'El stock inicial debe ser un número entero no negativo.'
      )
    }

    if (!formulario.categoria) {
      throw new Error('Seleccioná una categoría.')
    }

    if (!formulario.proveedor) {
      throw new Error('Seleccioná un proveedor.')
    }
  }

  // Crear o actualizar un producto
  async function guardarProducto(evento) {
    evento.preventDefault()

    setErrorFormulario('')
    setMensaje('')

    try {
      validarFormulario()

      const token = obtenerCSRF()

      if (!token) {
        throw new Error(
          'No se encontró el token de seguridad. Iniciá sesión en /admin/ desde localhost:5173.'
        )
      }

      // Campos que se pueden crear o modificar
      const datosProducto = {
        nombre: formulario.nombre.trim(),
        codigo: formulario.codigo.trim(),
        precio: formulario.precio,
        stock_minimo: Number(formulario.stock_minimo),
        categoria: Number(formulario.categoria),
        proveedor: Number(formulario.proveedor),
        estado: formulario.estado
      }

      // El stock actual solo se envía al crear.
      // Los cambios posteriores deben manejarse
      // desde movimientos de inventario.
      if (!modoEdicion) {
        datosProducto.stock_actual =
          Number(formulario.stock_actual)
      }

      setGuardando(true)

      if (modoEdicion) {
        // UPDATE: modificar producto
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

        setMensaje('Producto actualizado correctamente.')

      } else {
        // CREATE: registrar producto
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

        setMensaje('Producto registrado correctamente.')
      }

      setFormulario({ ...formularioInicial })
      setEditandoId(null)

    } catch (error) {
      setErrorFormulario(error.message)
    } finally {
      setGuardando(false)
    }
  }

  // Eliminar producto
  async function eliminarProducto(producto) {
    const confirmar = window.confirm(
      `¿Seguro que querés eliminar "${producto.nombre}"?\n\n` +
      'Esta acción no se puede deshacer.'
    )

    if (!confirmar) {
      return
    }

    setMensaje('')
    setErrorFormulario('')

    try {
      const token = obtenerCSRF()

      if (!token) {
        throw new Error(
          'No se encontró el token de seguridad. Iniciá sesión nuevamente.'
        )
      }

      setEliminandoId(producto.id)

      // DELETE: eliminar en Django y PostgreSQL
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

      // Si estábamos editando ese producto,
      // limpiar también el formulario.
      if (editandoId === producto.id) {
        setEditandoId(null)
        setFormulario({ ...formularioInicial })
      }

      setMensaje('Producto eliminado correctamente.')

    } catch (error) {
      setErrorFormulario(error.message)
    } finally {
      setEliminandoId(null)
    }
  }

  // Buscar productos por código o nombre
  const productosFiltrados = productos.filter((producto) => {
    const texto = `${producto.codigo} ${producto.nombre}`
      .toLowerCase()

    return texto.includes(busqueda.trim().toLowerCase())
  })

  // Mostrar el nombre de la categoría
  function nombreCategoria(id) {
    const categoria = categorias.find(
      (item) => String(item.id) === String(id)
    )

    return categoria?.nombre || 'Sin categoría'
  }

  // Mostrar el nombre del proveedor
  function nombreProveedor(id) {
    const proveedor = proveedores.find(
      (item) => String(item.id) === String(id)
    )

    return proveedor?.nombre || 'Sin proveedor'
  }

  const formatoPrecio = new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 2
  })

  return (
    <div className="productos-pagina">

      {/* FORMULARIO */}
      <section
        className="seccion panel"
        ref={formularioRef}
      >
        <div className="productos-encabezado">
          <div>
            <h2>
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

          {modoEdicion && (
            <button
              type="button"
              className="productos-boton-secundario"
              onClick={nuevoProducto}
              disabled={guardando}
            >
              Cancelar edición
            </button>
          )}
        </div>

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
              <option value="">Seleccionar categoría</option>

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
              <option value="">Seleccionar proveedor</option>

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

      {/* MENSAJES */}
      {mensaje && (
        <p className="productos-exito" role="status">
          {mensaje}
        </p>
      )}

      {errorFormulario && (
        <p className="productos-error" role="alert">
          {errorFormulario}
        </p>
      )}

      {errorCarga && (
        <p className="productos-error" role="alert">
          {errorCarga}
        </p>
      )}

      {/* TABLA DE PRODUCTOS */}
      <section className="seccion panel">

        <div className="productos-encabezado">
          <div>
            <h2>Productos registrados</h2>
            <p>
              Consultá y administrá los productos
              guardados en PostgreSQL.
            </p>
          </div>

          <button
            type="button"
            className="boton-volver"
            onClick={nuevoProducto}
            disabled={guardando}
          >
            + Nuevo producto
          </button>
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
          <div className="tabla-contenedor productos-tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Categoría</th>
                  <th>Proveedor</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan="9"
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

                      <td>{producto.stock_minimo}</td>

                      <td>
                        {nombreCategoria(producto.categoria)}
                      </td>

                      <td>
                        {nombreProveedor(producto.proveedor)}
                      </td>

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

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <button
        type="button"
        className="boton-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>

    </div>
  )
}

export default Productos
