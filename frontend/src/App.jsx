
import { useEffect, useState } from 'react'

import Login from './pages/Login'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import Productos from './pages/Productos'
import Categorias from './pages/Categorias'
import Proveedores from './pages/Proveedores'
import Ventas from './pages/Ventas'
import HistorialVentas from './pages/HistorialVentas'
import MiPerfil from './pages/MiPerfil'
import AdministrarUsuarios from './pages/AdministrarUsuarios'
import Inventario from './pages/Inventario'
import ImportarCSV from './pages/ImportarCSV'
import Recomendaciones from './pages/Recomendaciones'

import { IndicadorCarga } from './components/CargaUI'
import './App.css'

// Obtener token de seguridad de Django
async function obtenerTokenCSRF() {
  const respuesta = await fetch('/api/auth/csrf/', {
    credentials: 'same-origin'
  })

  if (!respuesta.ok) {
    throw new Error(
      'No se pudo establecer la conexión de seguridad.'
    )
  }

  const datos = await respuesta.json()
  return datos.csrfToken
}

function App() {
  const [pagina, setPagina] = useState('Dashboard')
  const [origenHistorial, setOrigenHistorial] = useState('Dashboard')
  const [usuarioActual, setUsuarioActual] = useState(null)

  const [verificandoSesion, setVerificandoSesion] = useState(true)

  const [errorSesion, setErrorSesion] = useState('')
  const [errorAcceso, setErrorAcceso] = useState('')

  // Comprobar si hay una sesión activa
  useEffect(() => {
    const controlador = new AbortController()

    async function consultarSesion() {
      try {
        const respuesta = await fetch('/api/auth/session/', {
          credentials: 'same-origin',
          signal: controlador.signal
        })

        if (!respuesta.ok) {
          throw new Error('No se pudo comprobar la sesión.')
        }

        const datos = await respuesta.json()

        if (!controlador.signal.aborted) {
          if (datos.autenticado && datos.rol) {
            setUsuarioActual(datos)
          } else {
            setUsuarioActual(null)
          }
        }

      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorSesion(
            'No se pudo consultar la sesión. Revisá que Django esté encendido.'
          )
        }
      } finally {
        if (!controlador.signal.aborted) {
          setVerificandoSesion(false)
        }
      }
    }

    consultarSesion()

    return () => controlador.abort()
  }, [])

  // Iniciar sesión utilizando Django
  async function iniciarSesion({ usuario, contrasena }) {
    const token = await obtenerTokenCSRF()

    const respuesta = await fetch('/api/auth/login/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': token
      },
      body: JSON.stringify({
        usuario,
        contrasena
      })
    })

    const datos = await respuesta.json()

    if (!respuesta.ok) {
      throw new Error(
        datos.detail || 'No se pudo iniciar sesión.'
      )
    }

    if (!datos.autenticado || !datos.rol) {
      throw new Error(
        'El usuario no tiene acceso autorizado.'
      )
    }

    setUsuarioActual(datos)
    setPagina('Dashboard')
    setErrorSesion('')
    setErrorAcceso('')
  }

  // Cerrar sesión en Django
  async function cerrarSesion() {
    const token = await obtenerTokenCSRF()
    const respuesta = await fetch('/api/auth/logout/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': token }
    })

    if (!respuesta.ok) throw new Error('No se pudo cerrar la sesión.')

    setUsuarioActual(null)
    setPagina('Dashboard')
    setErrorAcceso('')
    setErrorSesion('')
  }

  function actualizarPerfil(datos) {
    setUsuarioActual((actual) => ({ ...actual, ...datos }))
  }

  // Controlar la navegación según el rol
  function cambiarPagina(destino) {
    const paginasCajero = [
      'Dashboard',
      'Inventario',
      'Ventas',
      'Historial de ventas',
      'Mi perfil'
    ]

    if (
      (destino === 'Administrar usuarios' && usuarioActual?.rol !== 'Administrador') ||
      (usuarioActual?.rol === 'Cajero' && !paginasCajero.includes(destino))
    ) {
      setErrorAcceso(
        'No tenés permiso para ingresar a esta sección.'
      )
      return
    }

    if (destino === 'Historial de ventas') {
      setOrigenHistorial(pagina === 'Ventas' ? 'Ventas' : 'Dashboard')
    }
    setErrorAcceso('')
    setPagina(destino)
  }

  // Mostrar la página seleccionada
  function mostrarPagina() {
    switch (pagina) {
      case 'Dashboard':
        return (
          <Dashboard
            cambiarPagina={cambiarPagina}
            usuario={usuarioActual}
          />
        )

      case 'Inventario':
        return (
          <Productos
            cambiarPagina={cambiarPagina}
            usuario={usuarioActual}
          />
        )

      case 'Categorias':
        return (
          <Categorias
            cambiarPagina={cambiarPagina}
          />
        )

      case 'Proveedores':
        return (
          <Proveedores
            cambiarPagina={cambiarPagina}
          />
        )

      case 'Mi perfil':
        return <MiPerfil cambiarPagina={cambiarPagina} onPerfilActualizado={actualizarPerfil} />

      case 'Administrar usuarios':
        return <AdministrarUsuarios usuarioActual={usuarioActual} cambiarPagina={cambiarPagina}
          onPerfilActualizado={actualizarPerfil} />

      case 'Historial de ventas':
        return <HistorialVentas cambiarPagina={cambiarPagina} origen={origenHistorial} />

      case 'Movimientos':
        return (
          <Inventario
            cambiarPagina={cambiarPagina}
            usuario={usuarioActual}
          />
        )

      case 'Importar CSV':
        return (
          <ImportarCSV
            cambiarPagina={cambiarPagina}
          />
        )

      case 'Recomendaciones':
        return (
          <Recomendaciones
            cambiarPagina={cambiarPagina}
            usuario={usuarioActual}
          />
        )

      default:
        return (
          <section className="panel pagina-pendiente">
            <h2>{pagina}</h2>

            <p>
              Esta sección se encuentra en desarrollo.
            </p>

            <button
              className="boton-volver"
              onClick={() => cambiarPagina('Dashboard')}
            >
              Volver
            </button>
          </section>
        )
    }
  }

  // Mostrar carga mientras se verifica la sesión
  if (verificandoSesion) {
    return (
      <div className="login-cargando" role="status">
        <IndicadorCarga>Comprobando sesión de MiniGestor…</IndicadorCarga>
      </div>
    )
  }

  // Sin sesión activa, mostrar Login
  if (!usuarioActual) {
    return (
      <Login
        onLogin={iniciarSesion}
        aviso={errorSesion}
      />
    )
  }

  // Mostrar el sistema para usuarios autenticados
  return (
    <MainLayout
      pagina={pagina}
      cambiarPagina={cambiarPagina}
      usuario={usuarioActual}
      onCerrarSesion={cerrarSesion}
    >
      {errorAcceso && (
        <p className="sesion-error" role="alert">
          {errorAcceso}
        </p>
      )}

      {(pagina === 'Ventas' || (pagina === 'Historial de ventas' && origenHistorial === 'Ventas')) && (
        <div className="ui-vista-modulo" hidden={pagina !== 'Ventas'}>
          <Ventas cambiarPagina={cambiarPagina} usuario={usuarioActual} />
        </div>
      )}
      {pagina !== 'Ventas' && <div className="ui-vista-modulo" key={pagina}>{mostrarPagina()}</div>}
    </MainLayout>
  )
}

export default App
