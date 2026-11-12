
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

  function editarCategoria(categoria) {
    setFormulario({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || ''
    })

    setEditandoId(categoria.id)
    setError('')
    setMensaje('')

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
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

  return (
    <div className="categorias-pagina">

      <section className="seccion panel">
        <div className="categorias-encabezado">
          <div>
            <h2>
              {modoEdicion
                ? 'Editar categoría'
                : 'Registrar categoría'}
            </h2>
            <p>
              Organizá los productos del minisúper
              mediante categorías.
            </p>
          </div>

          {modoEdicion && (
            <button
              type="button"
              className="categorias-secundario"
              onClick={limpiarFormulario}
              disabled={guardando}
            >
              Cancelar edición
            </button>
          )}
        </div>

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

      {mensaje && (
        <p className="categorias-exito" role="status">
          {mensaje}
        </p>
      )}

      {(error || errorCarga) && (
        <p className="categorias-error" role="alert">
          {error || errorCarga}
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

      <button
        className="boton-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>
    </div>
  )
}

export default Categorias
