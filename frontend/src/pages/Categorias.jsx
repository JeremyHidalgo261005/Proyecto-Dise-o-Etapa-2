
import { useEffect, useState } from 'react'
import './Categorias.css'

const formularioInicial = {
  nombre: '',
  descripcion: ''
}

function obtenerCSRF() {
  const cookie = document.cookie
    .split('; ')
    .find((valor) => valor.startsWith('csrftoken='))

  return cookie
    ? decodeURIComponent(cookie.substring('csrftoken='.length))
    : ''
}

function obtenerLista(datos) {
  if (Array.isArray(datos)) return datos
  if (Array.isArray(datos?.results)) return datos.results
  throw new Error('La API devolvió un formato inesperado.')
}

function obtenerError(datos, estado) {
  if (!datos || typeof datos !== 'object') {
    return `No se pudo completar la operación. Error ${estado}.`
  }

  return Object.entries(datos)
    .map(([campo, valor]) => {
      const mensaje = Array.isArray(valor)
        ? valor.join(', ')
        : typeof valor === 'string'
          ? valor
          : JSON.stringify(valor)

      return campo === 'detail'
        ? mensaje
        : `${campo}: ${mensaje}`
    })
    .join(' | ')
}

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

function Categorias({ cambiarPagina }) {
  const [categorias, setCategorias] = useState([])
  const [formulario, setFormulario] = useState(formularioInicial)
  const [editandoId, setEditandoId] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)

  const [errorCarga, setErrorCarga] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  const modoEdicion = editandoId !== null

  // READ: consultar categorías
  useEffect(() => {
    const controlador = new AbortController()

    async function cargarCategorias() {
      try {
        const datos = await solicitarAPI('/api/categorias/', {
          signal: controlador.signal
        })

        if (!controlador.signal.aborted) {
          setCategorias(obtenerLista(datos))
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

    cargarCategorias()

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

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value
    }))
  }

  function limpiarFormulario() {
    setFormulario({ ...formularioInicial })
    setEditandoId(null)
    setError('')
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

  function editarCategoria(categoria) {
    setFormulario({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || ''
    })

    setEditandoId(categoria.id)
    setError('')
    setMensaje('')

    setModalAbierto(true)
  }

  // CREATE y UPDATE
  async function guardarCategoria(evento) {
    evento.preventDefault()
    setError('')
    setMensaje('')

    const nombre = formulario.nombre.trim()

    if (!nombre) {
      setError('El nombre de la categoría es obligatorio.')
      return
    }

    if (nombre.length > 100) {
      setError('El nombre no puede superar los 100 caracteres.')
      return
    }

    const token = obtenerCSRF()

    if (!token) {
      setError(
        'Iniciá sesión en /admin/ desde localhost:5173.'
      )
      return
    }

    const datosCategoria = {
      nombre,
      descripcion: formulario.descripcion.trim()
    }

    setGuardando(true)

    try {
      if (modoEdicion) {
        const actualizada = await solicitarAPI(
          `/api/categorias/${editandoId}/`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': token
            },
            body: JSON.stringify(datosCategoria)
          }
        )

        setCategorias((anteriores) =>
          anteriores.map((categoria) =>
            categoria.id === editandoId
              ? actualizada
              : categoria
          )
        )

        setMensaje('Categoría actualizada correctamente.')
      } else {
        const creada = await solicitarAPI(
          '/api/categorias/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': token
            },
            body: JSON.stringify(datosCategoria)
          }
        )

        setCategorias((anteriores) => [
          ...anteriores,
          creada
        ])

        setMensaje('Categoría registrada correctamente.')
      }

      limpiarFormulario()
      setModalAbierto(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // DELETE: eliminar categoría
  async function eliminarCategoria(categoria) {
    const confirmar = window.confirm(
      `¿Seguro que querés eliminar la categoría "${categoria.nombre}"?`
    )

    if (!confirmar) return

    setError('')
    setMensaje('')

    const token = obtenerCSRF()

    if (!token) {
      setError('Iniciá sesión nuevamente como administrador.')
      return
    }

    setEliminandoId(categoria.id)

    try {
      await solicitarAPI(
        `/api/categorias/${categoria.id}/`,
        {
          method: 'DELETE',
          headers: {
            'X-CSRFToken': token
          }
        }
      )

      setCategorias((anteriores) =>
        anteriores.filter((item) =>
          item.id !== categoria.id
        )
      )

      if (editandoId === categoria.id) {
        limpiarFormulario()
      }

      setMensaje('Categoría eliminada correctamente.')
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminandoId(null)
    }
  }

  const categoriasFiltradas = categorias.filter((categoria) =>
    `${categoria.nombre} ${categoria.descripcion || ''}`
      .toLowerCase()
      .includes(busqueda.trim().toLowerCase())
  )
  const errorPagina = modalAbierto ? errorCarga : (error || errorCarga)

  return (
    <div className="categorias-pagina">

      <button
        className="boton-volver categorias-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>

      {modalAbierto && (
        <div className="modal-fondo" onClick={cerrarModal}>
          <section
            className="modal-caja panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-categoria"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="categorias-encabezado">
              <div>
                <h2 id="titulo-modal-categoria">
                  {modoEdicion
                    ? 'Editar categoría'
                    : 'Registrar categoría'}
                </h2>
                <p>
                  Organizá los productos del minisúper
                  mediante categorías.
                </p>
              </div>

              <button
                type="button"
                className="categorias-secundario"
                onClick={cerrarModal}
                disabled={guardando}
              >
                Cerrar
              </button>
            </div>

            {error && (
              <p className="categorias-error" role="alert">
                {error}
              </p>
            )}

            <form
              className="categorias-formulario"
              onSubmit={guardarCategoria}
            >
              <label>
                Nombre de la categoría
                <input
                  type="text"
                  name="nombre"
                  value={formulario.nombre}
                  onChange={cambiarCampo}
                  maxLength={100}
                  placeholder="Ejemplo: Lácteos"
                  required
                />
              </label>

              <label>
                Descripción
                <textarea
                  name="descripcion"
                  value={formulario.descripcion}
                  onChange={cambiarCampo}
                  rows={3}
                  placeholder="Descripción de la categoría"
                />
              </label>

              <button
                type="submit"
                className="boton-volver"
                disabled={guardando || cargando || Boolean(errorCarga)}
              >
                {guardando
                  ? 'Guardando...'
                  : modoEdicion
                    ? 'Guardar cambios'
                    : 'Registrar categoría'}
              </button>
            </form>
          </section>
        </div>
      )}

      {mensaje && (
        <p className="categorias-exito" role="status">
          {mensaje}
        </p>
      )}

      {errorPagina && (
        <p className="categorias-error" role="alert">
          {errorPagina}
        </p>
      )}

      <section className="seccion panel">
        <div className="categorias-encabezado">
          <div>
            <h2>Categorías registradas</h2>
            <p>
              Consultá las categorías guardadas en PostgreSQL.
            </p>
          </div>

          <button
            type="button"
            className="boton-volver"
            onClick={abrirModalNuevo}
            disabled={guardando}
          >
            + Nueva categoría
          </button>
        </div>

        <div className="categorias-busqueda">
          <label htmlFor="buscar-categorias">
            Buscar categoría
          </label>

          <input
            id="buscar-categorias"
            type="search"
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
            placeholder="Buscar por nombre o descripción..."
          />
        </div>

        {cargando ? (
          <p>Cargando categorías...</p>
        ) : !errorCarga && (
          <div className="tabla-contenedor categorias-tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {categoriasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="tabla-vacia">
                      No se encontraron categorías.
                    </td>
                  </tr>
                ) : (
                  categoriasFiltradas.map((categoria) => (
                    <tr key={categoria.id}>
                      <td>{categoria.id}</td>
                      <td>{categoria.nombre}</td>
                      <td>{categoria.descripcion || 'Sin descripción'}</td>
                      <td>
                        <div className="categorias-acciones">
                          <button
                            type="button"
                            className="categorias-editar"
                            onClick={() => editarCategoria(categoria)}
                            disabled={guardando || eliminandoId !== null}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="categorias-eliminar"
                            onClick={() => eliminarCategoria(categoria)}
                            disabled={guardando || eliminandoId !== null}
                          >
                            {eliminandoId === categoria.id
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

export default Categorias
