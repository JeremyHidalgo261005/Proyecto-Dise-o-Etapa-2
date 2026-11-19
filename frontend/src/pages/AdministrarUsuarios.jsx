import { EsqueletoTabla, IndicadorCarga } from '../components/CargaUI'
import { useErrorConAviso, useNotificar } from '../components/avisos'
import { useEffect, useRef, useState } from 'react'
import ConfirmarLote from '../components/ConfirmarLote'
import { BarraSeleccion, CabeceraSeleccion, CeldaSeleccion } from '../components/SeleccionTabla'
import { useSeleccionTabla } from '../components/useSeleccionTabla'
import { consultarUsuarios, guardarUsuarios } from './apiUsuarios'
import './Usuarios.css'

const inicial = {
  username: '', first_name: '', last_name: '', email: '', rol: '',
  contrasena_nueva: '', confirmar_contrasena: ''
}
const camposPersonales = [
  ['first_name', 'Nombre', 'Ej. Juan', 'text', 150],
  ['last_name', 'Apellidos', 'Ej. Pérez', 'text', 150],
  ['username', 'Nombre de usuario', 'Ej. jperez', 'text', 150],
  ['email', 'Correo electrónico', 'Ej. juan@correo.com', 'email', 254]
]
const camposContrasena = [
  ['contrasena_nueva', 'Contraseña', 'Ingresá una contraseña segura'],
  ['confirmar_contrasena', 'Confirmar contraseña', 'Repetí la contraseña']
]
const nombreCompleto = (usuario) => [usuario.first_name, usuario.last_name].filter(Boolean).join(' ') || usuario.username

function AdministrarUsuarios({ usuarioActual, cambiarPagina, onPerfilActualizado }) {
  const [usuarios, setUsuarios] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [consulta, setConsulta] = useState({ buscar: '' })
  const [cargando, setCargando] = useState(true)
  const [formulario, setFormulario] = useState(null)
  const [edicion, setEdicion] = useState(null)
  const [porCambiar, setPorCambiar] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const enviandoFormulario = useRef(false)
  const [error, setError] = useErrorConAviso()
  const [errorFormulario, setErrorFormulario] = useErrorConAviso()
  const notificar = useNotificar()

  useEffect(() => {
    const controlador = new AbortController()
    const parametros = new URLSearchParams(consulta)
    consultarUsuarios('usuarios/?' + parametros, controlador.signal).then(setUsuarios).catch((error) => {
      if (error.name !== 'AbortError') setError(error.message)
    }).finally(() => {
      if (!controlador.signal.aborted) setCargando(false)
    })
    return () => controlador.abort()
  }, [consulta, setError])

  function listar(buscar = consulta.buscar) {
    setCargando(true)
    setError('')
    seleccion.limpiar()
    setConsulta({ buscar })
  }

  function editar(usuario = null) {
    setEdicion(usuario)
    setErrorFormulario('')
    setFormulario(usuario ? {
      username: usuario.username, first_name: usuario.first_name, last_name: usuario.last_name,
      email: usuario.email, rol: usuario.rol || '',
    } : inicial)
  }

  function cambiarCampo(evento) {
    const { name, value } = evento.target
    setFormulario((anterior) => ({ ...anterior, [name]: value }))
  }

  async function guardar(evento) {
    evento.preventDefault()
    if (enviandoFormulario.current) return
    const obligatorios = [
      ...camposPersonales,
      ...(!esCuentaPropia ? [['rol', 'Rol']] : []),
      ...(!edicion ? camposContrasena : [])
    ]
    const faltantes = obligatorios.filter(([campo]) => !formulario[campo].trim())
    if (faltantes.length) {
      setErrorFormulario('Completá los campos obligatorios: ' + faltantes.map(([, titulo]) => titulo).join(', ') + '.')
      evento.currentTarget.elements.namedItem(faltantes[0][0])?.focus()
      return
    }
    if (evento.currentTarget.elements.email.validity.typeMismatch) {
      setErrorFormulario('Ingresá un correo electrónico válido.')
      evento.currentTarget.elements.email.focus()
      return
    }
    if (!edicion && formulario.contrasena_nueva !== formulario.confirmar_contrasena) {
      setErrorFormulario('Las contraseñas no coinciden.')
      evento.currentTarget.elements.confirmar_contrasena.focus()
      return
    }

    enviandoFormulario.current = true
    setGuardando(true)
    setErrorFormulario('')
    try {
      const datos = { ...formulario }
      if (esCuentaPropia) delete datos.rol
      const ruta = edicion ? 'usuarios/' + edicion.id + '/' : 'usuarios/'
      const guardado = await guardarUsuarios(ruta, edicion ? 'PATCH' : 'POST', datos)
      if (guardado.id === usuarioActual.id) {
        onPerfilActualizado({
          nombre: nombreCompleto(guardado), usuario: guardado.username, email: guardado.email
        })
      }
      setFormulario(null)
      notificar(edicion ? 'Usuario actualizado.' : 'Usuario registrado.', 'exito')
      listar()
    } catch (error) {
      setErrorFormulario(error.message)
    } finally {
      enviandoFormulario.current = false
      setGuardando(false)
    }
  }

  const seleccion = useSeleccionTabla(cargando || error ? [] : usuarios)
  const [registro] = seleccion.elegidos
  const esCuentaPropia = edicion?.id === usuarioActual.id
  const cuentas = seleccion.elegidos.filter((usuario) => usuario.editable && usuario.id !== usuarioActual.id)
  const accionesEstado = [true, false].map((activo) => {
    const registros = cuentas.filter((usuario) => usuario.is_active !== activo)
    const accion = activo ? 'Activar' : 'Desactivar'
    return registros.length > 0 && {
      icono: accion.toLowerCase(),
      texto: accion + (registros.length < seleccion.elegidos.length ? ' (' + registros.length + ')' : ''),
      deshabilitada: guardando,
      ejecutar: () => setPorCambiar({ registros, activo, accion })
    }
  })

  return (
    <>
      <button type="button" className="boton-volver productos-volver" onClick={() => cambiarPagina('Dashboard')}>
        Volver al Dashboard
      </button>
      <section className="seccion panel">
        <header className="productos-encabezado">
          <h2>Usuarios registrados</h2>
          <button type="button" className="boton-volver" onClick={() => editar()} disabled={guardando}>
            + Nuevo usuario
          </button>
        </header>

        {formulario && (
          <section className="usuarios-editor">
            <h3>{edicion ? 'Editar usuario' : 'Registrar usuario'}</h3>
            {errorFormulario && <p className="productos-error" role="alert">{errorFormulario}</p>}
            <form className="productos-formulario usuarios-formulario" noValidate onSubmit={guardar}>
              {camposPersonales.map(([campo, titulo, ejemplo, tipo, maxLength]) => (
                <label key={campo}>
                  <span>{titulo} <span className="usuario-obligatorio" aria-hidden="true">*</span></span>
                  <input name={campo} type={tipo} value={formulario[campo]} placeholder={ejemplo}
                    onChange={cambiarCampo} maxLength={maxLength} autoComplete="off" required />
                </label>
              ))}
              <label>
                <span>Rol {!esCuentaPropia && <span className="usuario-obligatorio" aria-hidden="true">*</span>}</span>
                <select name="rol" value={formulario.rol} onChange={cambiarCampo} required disabled={esCuentaPropia}>
                  <option value="" disabled>Seleccioná un rol</option>
                  <option>Administrador</option>
                  <option>Cajero</option>
                </select>
              </label>
              {!edicion && camposContrasena.map(([campo, titulo, ejemplo]) => (
                <label key={campo}>
                  <span>{titulo} <span className="usuario-obligatorio" aria-hidden="true">*</span></span>
                  <input name={campo} type="password" autoComplete="new-password" placeholder={ejemplo}
                    value={formulario[campo]} onChange={cambiarCampo} maxLength={128} required />
                </label>
              ))}
              <div className="usuarios-acciones usuarios-fila-completa">
                <button type="button" className="productos-boton-secundario" disabled={guardando}
                  onClick={() => setFormulario(null)}>Cancelar</button>
                <button type="submit" className="boton-volver" disabled={guardando}>
                  {guardando ? <IndicadorCarga>Guardando…</IndicadorCarga> : 'Guardar usuario'}
                </button>
              </div>
            </form>
          </section>
        )}

        <form className="productos-barra-busqueda usuarios-busqueda"
          onSubmit={(evento) => { evento.preventDefault(); listar(busqueda.trim()) }}>
          <label htmlFor="buscar-usuario">Buscar usuarios</label>
          <div className="usuarios-acciones">
            <input id="buscar-usuario" type="search" data-tooltip="Buscar por nombre, usuario o correo" value={busqueda}
              onChange={(evento) => { seleccion.limpiar(); setBusqueda(evento.target.value) }} placeholder="Nombre, usuario o correo" />
            <button type="submit" className="boton-volver">Buscar</button>
          </div>
        </form>

        <BarraSeleccion seleccion={seleccion} acciones={[
          seleccion.elegidos.length === 1 && registro.editable && {
            icono: 'editar', texto: 'Editar', ejecutar: () => editar(registro), deshabilitada: guardando
          },
          ...accionesEstado
        ]} />
        <div className="tabla-contenedor" role="region" aria-label="Usuarios registrados" tabIndex={0}>
          <table className="usuarios-tabla">
            <thead><tr><CabeceraSeleccion seleccion={seleccion} deshabilitada={cargando || Boolean(error) || !usuarios.length} /><th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead>
            <tbody>
              {!cargando && !error && usuarios.map((usuario) => (
                <tr key={usuario.id} data-seleccionada={seleccion.marcada(usuario)}>
                  <CeldaSeleccion marcada={seleccion.marcada(usuario)} nombre={nombreCompleto(usuario)}
                    onChange={() => seleccion.alternar(usuario.id)} />
                  <td>{usuario.username}</td>
                  <td>{nombreCompleto(usuario)}</td>
                  <td>{usuario.email || '—'}</td>
                  <td>{usuario.rol || 'Sin rol'}</td>
                  <td>{usuario.is_active ? 'Activa' : 'Inactiva'}</td>
                </tr>
              ))}
              {cargando && <EsqueletoTabla columnas={6} mensaje="Consultando usuarios…" />}
              {!cargando && (error || !usuarios.length) && (
                <tr><td className="tabla-vacia" colSpan="6">
                  {error ? <span role="alert">{error}</span>
                    : 'No hay usuarios para esta búsqueda.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {porCambiar && (
        <ConfirmarLote registros={porCambiar.registros} nombre={nombreCompleto} accion={porCambiar.accion}
          mensaje={porCambiar.activo ? 'Las cuentas recuperarán el acceso según su rol.'
            : 'Las cuentas seleccionadas perderán el acceso a MiniGestor.'}
          onCancelar={() => setPorCambiar(null)}
          ejecutar={(usuario) => guardarUsuarios('usuarios/' + usuario.id + '/estado/', 'PATCH', { activo: porCambiar.activo })}
          alTerminar={() => listar()} />
      )}
    </>
  )
}

export default AdministrarUsuarios
