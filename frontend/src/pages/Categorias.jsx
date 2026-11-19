import { IndicadorCarga, TablaEnCarga } from '../components/CargaUI'
import { useErrorConAviso, useNotificar } from '../components/avisos'
import { cerrarConAnimacion } from '../components/transiciones'

import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmarLote from '../components/ConfirmarLote'
import { BarraSeleccion, CabeceraSeleccion, CeldaSeleccion } from '../components/SeleccionTabla'
import { useSeleccionTabla } from '../components/useSeleccionTabla'
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
  const enviandoFormulario = useRef(false)
  const fondoModal = useRef(null)
  const [porEliminar, setPorEliminar] = useState(null)

  const [errorCarga, setErrorCarga] = useErrorConAviso()
  const [error, setError] = useErrorConAviso()
  const notificar = useNotificar()
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
  }, [setErrorCarga])

  function cambiarCampo(evento) {
    const { name, value } = evento.target

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value
    }))
  }

  const limpiarFormulario = useCallback(() => {
    setFormulario({ ...formularioInicial })
    setEditandoId(null)
    setError('')
  }, [setError])

  function abrirModalNuevo() {
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


  function editarCategoria(categoria) {
    setFormulario({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || ''
    })

    setEditandoId(categoria.id)
    setError('')

    setModalAbierto(true)
  }

  // CREATE y UPDATE
  async function guardarCategoria(evento) {
    evento.preventDefault()
    if (enviandoFormulario.current) return
    setError('')

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

    enviandoFormulario.current = true
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

        notificar('Categoría actualizada correctamente.', 'exito')
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

        notificar('Categoría registrada correctamente.', 'exito')
      }

      cerrarFormulario()
    } catch (err) {
      setError(err.message)
    } finally {
      enviandoFormulario.current = false
      setGuardando(false)
    }
  }

  // DELETE: eliminar categoría
  async function eliminarCategoria(categoria) {
    setError('')

    const token = obtenerCSRF()

    if (!token) throw new Error('Iniciá sesión nuevamente como administrador.')

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
  }

  const categoriasFiltradas = categorias.filter((categoria) =>
    `${categoria.nombre} ${categoria.descripcion || ''}`
      .toLowerCase()
      .includes(busqueda.trim().toLowerCase())
  )
  const errorPagina = modalAbierto ? errorCarga : (error || errorCarga)

  const seleccion = useSeleccionTabla(categoriasFiltradas)
  const [registro] = seleccion.elegidos

  return (
    <div className="categorias-pagina">
      {porEliminar && (
        <ConfirmarLote registros={porEliminar} nombre={(registro) => registro.nombre}
          mensaje="¿Querés eliminar la selección? Esta acción no se puede deshacer."
          onCancelar={() => setPorEliminar(null)} ejecutar={eliminarCategoria} alTerminar={seleccion.limpiar} />
      )}


      <button
        className="boton-volver categorias-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>

      {modalAbierto && (
        <div className="modal-fondo" ref={fondoModal} onClick={cerrarModal}>
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
                  placeholder="Lácteos"
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
                  placeholder="Productos derivados de la leche"
                />
              </label>

              <button
                type="submit"
                className="boton-volver"
                disabled={guardando || cargando || Boolean(errorCarga)}
              >
                {guardando
                  ? <IndicadorCarga>Guardando…</IndicadorCarga>
                  : modoEdicion
                    ? 'Guardar cambios'
                    : 'Registrar categoría'}
              </button>
            </form>
          </section>
        </div>
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
            data-tooltip="Buscar categorías por nombre"
            type="search"
            value={busqueda}
            onChange={(evento) => { seleccion.limpiar(); setBusqueda(evento.target.value) }}
            placeholder="Buscar por nombre o descripción..."
          />
        </div>

        <BarraSeleccion seleccion={seleccion} acciones={[
          seleccion.elegidos.length === 1 && { icono: 'editar', texto: 'Editar', ejecutar: () => editarCategoria(registro), deshabilitada: guardando },
          { icono: 'eliminar', texto: 'Eliminar', ejecutar: () => setPorEliminar(seleccion.elegidos), deshabilitada: guardando }
        ]} />

        {cargando ? (
          <TablaEnCarga columnas={4} mensaje="Cargando categorías…" />
        ) : !errorCarga && (
          <div className="tabla-contenedor categorias-tabla-scroll">
            <table>
              <thead>
                <tr>
                  <CabeceraSeleccion seleccion={seleccion} deshabilitada={!categoriasFiltradas.length} />
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
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
                    <tr key={categoria.id} data-seleccionada={seleccion.marcada(categoria)}>
                      <CeldaSeleccion marcada={seleccion.marcada(categoria)} nombre={categoria.nombre}
                        onChange={() => seleccion.alternar(categoria.id)} />
                      <td>{categoria.id}</td>
                      <td>{categoria.nombre}</td>
                      <td>{categoria.descripcion || 'Sin descripción'}</td>
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
