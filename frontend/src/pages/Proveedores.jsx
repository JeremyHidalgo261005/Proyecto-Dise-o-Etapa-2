
import { useEffect, useState } from 'react'
import './Proveedores.css'

const formularioInicial = {
  nombre: '',
  telefono: '',
  correo: '',
  direccion: ''
}

// Obtener el token de seguridad de Django
function obtenerCSRF() {
  const cookie = document.cookie
    .split('; ')
    .find((valor) => valor.startsWith('csrftoken='))

  return cookie
    ? decodeURIComponent(cookie.substring('csrftoken='.length))
    : ''
}

// Mostrar los errores enviados por Django
function obtenerError(datos, estado) {
  if (!datos || typeof datos !== 'object') {
    return `No se pudo completar la operación. Error ${estado}.`
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

// Comunicación con la API
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
    throw new Error(obtenerError(datos, respuesta.status))
  }

  return datos
}

// Consultar proveedores, incluyendo páginas adicionales
async function consultarProveedores(signal) {
  const todos = []
  let ruta = '/api/proveedores/'

  while (ruta) {
    const datos = await solicitarAPI(ruta, { signal })

    if (Array.isArray(datos)) {
      todos.push(...datos)
      ruta = null
    } else if (Array.isArray(datos?.results)) {
      todos.push(...datos.results)

      if (datos.next) {
        const siguiente = new URL(
          datos.next,
          window.location.origin
        )

        ruta = siguiente.pathname + siguiente.search
      } else {
        ruta = null
      }
    } else {
      throw new Error('La API devolvió un formato inesperado.')
    }
  }

  return todos
}

function Proveedores({ cambiarPagina }) {
  const [proveedores, setProveedores] = useState([])
  const [formulario, setFormulario] = useState(formularioInicial)

  const [editandoId, setEditandoId] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)

  const [errorCarga, setErrorCarga] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const modoEdicion = editandoId !== null
  const [modalAbierto, setModalAbierto] = useState(false)
  const errorPagina = modalAbierto ? errorCarga : (error || errorCarga)

  // READ: cargar proveedores desde PostgreSQL
  useEffect(() => {
    const controlador = new AbortController()

    async function cargarDatos() {
      try {
        const lista = await consultarProveedores(
          controlador.signal
        )

        if (!controlador.signal.aborted) {
          setProveedores(lista)
          setErrorCarga('')
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setErrorCarga(err.message)
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

  useEffect(() => {
    if (!modalAbierto) return

    function alPresionar(evento) {
      if (evento.key === 'Escape') cerrarModal()
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [modalAbierto, guardando])

  
function cambiarCampo(evento) {
  const { name, value } = evento.target

  let nuevoValor = value

  if (name === 'telefono') {
    // Permitir solamente números
    const numeros = value.replace(/[^0-9]/g, '').slice(0, 8)

    // Agregar automáticamente el guion
    nuevoValor = numeros.length > 4
      ? `${numeros.slice(0, 4)}-${numeros.slice(4)}`
      : numeros
  }

  setFormulario((anterior) => ({
    ...anterior,
    [name]: nuevoValor
  }))
  }


  function limpiarFormulario() {
    setFormulario({ ...formularioInicial })
    setEditandoId(null)
    setError('')
  }

  // Preparar formulario para editar un proveedor
  function editarProveedor(proveedor) {
    setEditandoId(proveedor.id)

    setFormulario({
      nombre: proveedor.nombre || '',
      telefono: proveedor.telefono || '',
      correo: proveedor.correo || '',
      direccion: proveedor.direccion || ''
    })

    setError('')
    setMensaje('')

    setModalAbierto(true)
  }

  function abrirModalNuevo() {
    limpiarFormulario()
    setMensaje('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    if (guardando) return
    limpiarFormulario()
    setModalAbierto(false)
  }

  // CREATE y UPDATE
  async function guardarProveedor(evento) {
    evento.preventDefault()

    setError('')
    setMensaje('')

    if (!formulario.nombre.trim()) {
      setError('El nombre del proveedor es obligatorio.')
      return
    }

    const token = obtenerCSRF()

    if (!token) {
      setError(
        'No se encontró el token de seguridad. Iniciá sesión en /admin/ desde localhost:5173.'
      )
      return
    }

    const datosProveedor = {
      nombre: formulario.nombre.trim(),
      telefono: formulario.telefono.trim(),
      correo: formulario.correo.trim(),
      direccion: formulario.direccion.trim()
    }

    setGuardando(true)

    try {
      if (modoEdicion) {
        // UPDATE: editar proveedor
        const actualizado = await solicitarAPI(
          `/api/proveedores/${editandoId}/`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': token
            },
            body: JSON.stringify(datosProveedor)
          }
        )

        setProveedores((anteriores) =>
          anteriores.map((proveedor) =>
            proveedor.id === editandoId
              ? actualizado
              : proveedor
          )
        )

        setMensaje('Proveedor actualizado correctamente.')
      } else {
        // CREATE: registrar proveedor
        const creado = await solicitarAPI(
          '/api/proveedores/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': token
            },
            body: JSON.stringify(datosProveedor)
          }
        )

        setProveedores((anteriores) => [
          ...anteriores,
          creado
        ])

        setMensaje('Proveedor registrado correctamente.')
      }

      limpiarFormulario()
      setModalAbierto(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // DELETE: eliminar proveedor
  async function eliminarProveedor(proveedor) {
    const confirmar = window.confirm(
      `¿Seguro que querés eliminar al proveedor "${proveedor.nombre}"?\n\n` +
      'Esta acción no se puede deshacer.'
    )

    if (!confirmar) return

    setError('')
    setMensaje('')

    const token = obtenerCSRF()

    if (!token) {
      setError('Iniciá sesión nuevamente como administrador.')
      return
    }

    setEliminandoId(proveedor.id)

    try {
      await solicitarAPI(
        `/api/proveedores/${proveedor.id}/`,
        {
          method: 'DELETE',
          headers: {
            'X-CSRFToken': token
          }
        }
      )

      setProveedores((anteriores) =>
        anteriores.filter((item) =>
          item.id !== proveedor.id
        )
      )

      if (editandoId === proveedor.id) {
        limpiarFormulario()
      }

      setMensaje('Proveedor eliminado correctamente.')
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminandoId(null)
    }
  }

  // Buscar por cualquier dato del proveedor
  const proveedoresFiltrados = proveedores.filter((proveedor) => {
    const texto = [
      proveedor.nombre,
      proveedor.telefono,
      proveedor.correo,
      proveedor.direccion
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return texto.includes(busqueda.trim().toLowerCase())
  })

  return (
    <div className="proveedores-pagina">

      <button
        className="boton-volver proveedores-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>

      {/* FORMULARIO */}
      {modalAbierto && (
        <div className="modal-fondo" onClick={cerrarModal}>
          <section
            className="modal-caja panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-proveedor"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="proveedores-encabezado">
              <div>
                <h2 id="titulo-modal-proveedor">
                  {modoEdicion ? 'Editar proveedor' : 'Registrar proveedor'}
                </h2>
                <p>
                  {modoEdicion
                    ? 'Modificá la información del proveedor seleccionado.'
                    : 'Registrá los proveedores que abastecen al minisúper.'}
                </p>
              </div>

              <button
                type="button"
                className="proveedores-secundario"
                onClick={cerrarModal}
                disabled={guardando}
              >
                Cerrar
              </button>
            </div>

            {error && (
              <p className="proveedores-error" role="alert">{error}</p>
            )}

            <form
              className="proveedores-formulario"
              onSubmit={guardarProveedor}
            >
              <label>
                Nombre del proveedor
                <input
                  type="text"
                  name="nombre"
                  value={formulario.nombre}
                  onChange={cambiarCampo}
                  placeholder="Ejemplo: Distribuidora Central"
                  required
                />
              </label>

              
              <label>
                Teléfono
                <input
                  type="tel"
                  name="telefono"
                  value={formulario.telefono}
                  onChange={cambiarCampo}
                  placeholder="2222-1234"
                  maxLength={9}
                  pattern="[0-9]{4}-[0-9]{4}"
                  title="El teléfono debe tener el formato 2222-1234"
                  inputMode="numeric"
                />
              </label>


              <label>
                Correo electrónico
                <input
                  type="email"
                  name="correo"
                  value={formulario.correo}
                  onChange={cambiarCampo}
                  placeholder="Ejemplo: ventas@proveedor.com"
                />
              </label>

              <label>
                Dirección
                <textarea
                  name="direccion"
                  value={formulario.direccion}
                  onChange={cambiarCampo}
                  rows={3}
                  placeholder="Dirección del proveedor"
                />
              </label>

              <div className="proveedores-formulario-acciones">
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
                      : 'Registrar proveedor'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MENSAJES */}
      {mensaje && (
        <p className="proveedores-exito" role="status">
          {mensaje}
        </p>
      )}

      {(error || errorCarga) && (
        <p className="proveedores-error" role="alert">
          {error || errorCarga}
        </p>
      )}

      {/* TABLA */}
      <section className="seccion panel">
        <div className="proveedores-encabezado">
          <div>
            <h2>Proveedores registrados</h2>
            <p>
              Consultá y administrá los proveedores
              guardados en PostgreSQL.
            </p>
          </div>

          <button
            type="button"
            className="boton-volver"
            onClick={abrirModalNuevo}
            disabled={guardando}
          >
            + Nuevo proveedor
          </button>
        </div>

        <div className="proveedores-busqueda">
          <label htmlFor="buscar-proveedores">
            Buscar proveedor
          </label>

          <input
            id="buscar-proveedores"
            type="search"
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
            placeholder="Buscar por nombre, teléfono, correo..."
          />
        </div>

        {cargando ? (
          <p>Cargando proveedores...</p>
        ) : !errorCarga && (
          <div
            className="tabla-contenedor proveedores-tabla-scroll"
            role="region"
            aria-label="Tabla de proveedores registrados"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Dirección</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {proveedoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="tabla-vacia">
                      No se encontraron proveedores.
                    </td>
                  </tr>
                ) : (
                  proveedoresFiltrados.map((proveedor) => (
                    <tr key={proveedor.id}>
                      <td>{proveedor.id}</td>
                      <td>{proveedor.nombre}</td>
                      <td>{proveedor.telefono || '—'}</td>
                      <td>{proveedor.correo || '—'}</td>
                      <td>{proveedor.direccion || '—'}</td>

                      <td>
                        <div className="proveedores-acciones">
                          <button
                            type="button"
                            className="proveedores-editar"
                            onClick={() =>
                              editarProveedor(proveedor)
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
                            className="proveedores-eliminar"
                            onClick={() =>
                              eliminarProveedor(proveedor)
                            }
                            disabled={
                              guardando ||
                              eliminandoId !== null
                            }
                          >
                            {eliminandoId === proveedor.id
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

    </div>
  )
}

export default Proveedores
