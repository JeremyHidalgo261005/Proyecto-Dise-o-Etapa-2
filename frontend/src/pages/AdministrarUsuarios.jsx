import { useEffect, useState } from 'react'
import ConfirmarEliminacion from '../components/ConfirmarEliminacion'
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
  const [error, setError] = useState('')
  const [errorFormulario, setErrorFormulario] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const controlador = new AbortController()
    const parametros = new URLSearchParams(consulta)
    consultarUsuarios('usuarios/?' + parametros, controlador.signal).then(setUsuarios).catch((error) => {
      if (error.name !== 'AbortError') setError(error.message)
    }).finally(() => {
      if (!controlador.signal.aborted) setCargando(false)
    })
    return () => controlador.abort()
  }, [consulta])

  function listar(buscar = consulta.buscar) {
    setCargando(true)
    setError('')
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
    if (guardando) return
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
      setMensaje(edicion ? 'Usuario actualizado.' : 'Usuario registrado.')
      listar()
    } catch (error) {
      setErrorFormulario(error.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado() {
    const activo = !porCambiar.is_active
    await guardarUsuarios('usuarios/' + porCambiar.id + '/estado/', 'PATCH', { activo })
    setMensaje(activo ? 'Cuenta activada.' : 'Cuenta desactivada.')
    listar()
  }

  const esCuentaPropia = edicion?.id === usuarioActual.id
  const accion = porCambiar?.is_active ? 'Desactivar' : 'Activar'

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
        {mensaje && <p role="status">{mensaje}</p>}

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
                  {guardando ? 'Guardando…' : 'Guardar usuario'}
                </button>
              </div>
            </form>
          </section>
        )}

        <form className="productos-barra-busqueda usuarios-busqueda"
          onSubmit={(evento) => { evento.preventDefault(); listar(busqueda.trim()) }}>
          <label htmlFor="buscar-usuario">Buscar usuarios</label>
          <div className="usuarios-acciones">
            <input id="buscar-usuario" type="search" value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Nombre, usuario o correo" />
            <button type="submit" className="boton-volver">Buscar</button>
          </div>
        </form>

        <div className="tabla-contenedor" role="region" aria-label="Usuarios registrados" tabIndex={0}>
          <table className="usuarios-tabla">
            <thead><tr><th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {!cargando && !error && usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>{usuario.username}</td>
                  <td>{nombreCompleto(usuario)}</td>
                  <td>{usuario.email || '—'}</td>
                  <td>{usuario.rol || 'Sin rol'}</td>
                  <td>{usuario.is_active ? 'Activa' : 'Inactiva'}</td>
                  <td>
                    <div className="usuarios-acciones">
                      <button type="button" className="productos-boton-secundario"
                        disabled={!usuario.editable || guardando} onClick={() => editar(usuario)}>Editar</button>
                      {usuario.id !== usuarioActual.id && (
                        <button type="button" className="productos-boton-secundario"
                          disabled={!usuario.editable || guardando} onClick={() => setPorCambiar(usuario)}>
                          {usuario.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(cargando || error || !usuarios.length) && (
                <tr><td className="tabla-vacia" colSpan="6">
                  {error ? <span role="alert">{error}</span>
                    : cargando ? 'Consultando usuarios…' : 'No hay usuarios para esta búsqueda.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {porCambiar && (
        <ConfirmarEliminacion titulo={accion + ' cuenta'} nombre={nombreCompleto(porCambiar)}
          mensaje={porCambiar.is_active ? 'La persona perderá el acceso a MiniGestor.'
            : 'La persona recuperará el acceso según su rol.'}
          accion={accion} procesando="Guardando…" peligro={porCambiar.is_active}
          onCancelar={() => setPorCambiar(null)} onEliminar={cambiarEstado} />
      )}
    </>
  )
}

export default AdministrarUsuarios
