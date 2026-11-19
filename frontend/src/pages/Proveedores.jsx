import { IndicadorCarga, TablaEnCarga } from '../components/CargaUI'
import { useErrorConAviso, useNotificar } from '../components/avisos'
import { cerrarConAnimacion } from '../components/transiciones'

import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmarLote from '../components/ConfirmarLote'
import { BarraSeleccion, CabeceraSeleccion, CeldaSeleccion } from '../components/SeleccionTabla'
import { useSeleccionTabla } from '../components/useSeleccionTabla'
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
  const enviandoFormulario = useRef(false)
  const fondoModal = useRef(null)
  const [porEliminar, setPorEliminar] = useState(null)

  const [errorCarga, setErrorCarga] = useErrorConAviso()
  const [error, setError] = useErrorConAviso()
  const notificar = useNotificar()

  const modoEdicion = editandoId !== null
  const [modalAbierto, setModalAbierto] = useState(false)

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
  }, [setErrorCarga])

  
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


  const limpiarFormulario = useCallback(() => {
    setFormulario({ ...formularioInicial })
    setEditandoId(null)
    setError('')
  }, [setError])

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

    setModalAbierto(true)
  }

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


  // CREATE y UPDATE
  async function guardarProveedor(evento) {
    evento.preventDefault()
    if (enviandoFormulario.current) return

    setError('')

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

    enviandoFormulario.current = true
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

        notificar('Proveedor actualizado correctamente.', 'exito')
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

        notificar('Proveedor registrado correctamente.', 'exito')
      }

      cerrarFormulario()
    } catch (err) {
      setError(err.message)
    } finally {
      enviandoFormulario.current = false
      setGuardando(false)
    }
  }

  // DELETE: eliminar proveedor
  async function eliminarProveedor(proveedor) {
    setError('')

    const token = obtenerCSRF()

    if (!token) throw new Error('Iniciá sesión nuevamente como administrador.')

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

  const seleccion = useSeleccionTabla(proveedoresFiltrados)
  const [registro] = seleccion.elegidos

  return (
    <div className="proveedores-pagina">
      {porEliminar && (
        <ConfirmarLote registros={porEliminar} nombre={(registro) => registro.nombre}
          mensaje="¿Querés eliminar la selección? Esta acción no se puede deshacer."
          onCancelar={() => setPorEliminar(null)} ejecutar={eliminarProveedor} alTerminar={seleccion.limpiar} />
      )}


      <button
        className="boton-volver proveedores-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>

      {/* FORMULARIO */}
      {modalAbierto && (
        <div className="modal-fondo" ref={fondoModal} onClick={cerrarModal}>
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
                  placeholder="Distribuidora Central"
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
                  placeholder="ventas@proveedor.com"
                />
              </label>

              <label>
                Dirección
                <textarea
                  name="direccion"
                  value={formulario.direccion}
                  onChange={cambiarCampo}
                  rows={3}
                  placeholder="San José, Costa Rica"
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
                    ? <IndicadorCarga>Guardando…</IndicadorCarga>
                    : modoEdicion
                      ? 'Guardar cambios'
                      : 'Registrar proveedor'}
                </button>
              </div>
            </form>
          </section>
        </div>
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
            data-tooltip="Buscar proveedores por nombre"
            type="search"
            value={busqueda}
            onChange={(evento) => { seleccion.limpiar(); setBusqueda(evento.target.value) }}
            placeholder="Buscar por nombre, teléfono, correo..."
          />
        </div>

        <BarraSeleccion seleccion={seleccion} acciones={[
          seleccion.elegidos.length === 1 && { icono: 'editar', texto: 'Editar', ejecutar: () => editarProveedor(registro), deshabilitada: guardando },
          { icono: 'eliminar', texto: 'Eliminar', ejecutar: () => setPorEliminar(seleccion.elegidos), deshabilitada: guardando }
        ]} />

        {cargando ? (
          <TablaEnCarga columnas={6} mensaje="Cargando proveedores…" />
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
                  <CabeceraSeleccion seleccion={seleccion} deshabilitada={!proveedoresFiltrados.length} />
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Dirección</th>
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
                    <tr key={proveedor.id} data-seleccionada={seleccion.marcada(proveedor)}>
                      <CeldaSeleccion marcada={seleccion.marcada(proveedor)} nombre={proveedor.nombre}
                        onChange={() => seleccion.alternar(proveedor.id)} />
                      <td>{proveedor.id}</td>
                      <td>{proveedor.nombre}</td>
                      <td>{proveedor.telefono || '—'}</td>
                      <td>{proveedor.correo || '—'}</td>
                      <td>{proveedor.direccion || '—'}</td>

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
