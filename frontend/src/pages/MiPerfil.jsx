import { BloqueCarga, IndicadorCarga } from '../components/CargaUI'
import { useErrorConAviso, useNotificar } from '../components/avisos'
import { useEffect, useRef, useState } from 'react'
import AvatarPerfil from '../components/AvatarPerfil'
import { consultarUsuarios, guardarUsuarios } from './apiUsuarios'
import './Usuarios.css'

const camposPersonales = [
  ['username', 'Nombre de usuario', 'text', 'username', 150],
  ['email', 'Correo electrónico', 'email', 'email', 254],
  ['first_name', 'Nombre', 'text', 'given-name', 150],
  ['last_name', 'Apellidos', 'text', 'family-name', 150]
]
const camposContrasena = ['contrasena_actual', 'contrasena_nueva', 'confirmar_contrasena']

const datosDelFormulario = ({ usuario, first_name, last_name, email }) => ({
  username: usuario, first_name, last_name, email, contrasena_actual: '', contrasena_nueva: '', confirmar_contrasena: ''
})

function MiPerfil({ cambiarPagina, onPerfilActualizado }) {
  const [perfil, setPerfil] = useState(null)
  const [formulario, setFormulario] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [vista, setVista] = useState(null)
  const [cambiarContrasena, setCambiarContrasena] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const enviandoFormulario = useRef(false)
  const [error, setError] = useErrorConAviso()
  const notificar = useNotificar()
  const inputImagen = useRef(null)

  useEffect(() => {
    const controlador = new AbortController()
    consultarUsuarios('perfil/', controlador.signal).then((datos) => {
      setPerfil(datos)
      setFormulario(datosDelFormulario(datos))
    }).catch((error) => {
      if (error.name !== 'AbortError') setError(error.message)
    })
    return () => controlador.abort()
  }, [setError])

  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista) }, [vista])

  function actualizarCampo(evento) {
    const { name, value } = evento.target
    setFormulario((actual) => ({ ...actual, [name]: value }))
  }

  function seleccionarImagen(evento) {
    const siguiente = evento.target.files[0]
    if (siguiente?.size > 5 * 1024 * 1024) {
      setError('La imagen debe pesar 5 MB o menos.')
      evento.target.value = ''
      setArchivo(null)
      setVista(null)
      return
    }
    setError('')
    setArchivo(siguiente || null)
    setVista(siguiente ? URL.createObjectURL(siguiente) : null)
  }

  function limpiarCambios(datos) {
    setFormulario(datosDelFormulario(datos))
    setArchivo(null)
    setVista(null)
    setCambiarContrasena(false)
    inputImagen.current.value = ''
  }

  async function guardar(evento) {
    evento.preventDefault()
    if (enviandoFormulario.current) return
    setError('')
    const faltantes = camposPersonales.filter(([campo]) => !formulario[campo].trim())
    if (faltantes.length) {
      setError('Completá los campos obligatorios: ' + faltantes.map(([, titulo]) => titulo).join(', ') + '.')
      evento.currentTarget.elements.namedItem(faltantes[0][0])?.focus()
      return
    }
    if (evento.currentTarget.elements.email.validity.typeMismatch) {
      setError('Ingresá un correo electrónico válido.')
      evento.currentTarget.elements.email.focus()
      return
    }
    if (cambiarContrasena && camposContrasena.some((campo) => !formulario[campo])) {
      setError('Completá los tres campos de contraseña.')
      return
    }
    if (cambiarContrasena && formulario.contrasena_nueva !== formulario.confirmar_contrasena) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }
    enviandoFormulario.current = true
    setGuardando(true)
    try {
      const datos = new FormData()
      for (const [campo] of camposPersonales) datos.set(campo, formulario[campo])
      if (archivo) datos.set('imagen', archivo)
      if (cambiarContrasena) {
        for (const campo of camposContrasena) {
          datos.set(campo, formulario[campo])
        }
      }

      const guardado = await guardarUsuarios('perfil/', 'PATCH', datos)
      setPerfil(guardado)
      limpiarCambios(guardado)
      onPerfilActualizado(guardado)
      notificar('Perfil actualizado correctamente.', 'exito')
    } catch (error) {
      setError(error.message)
    } finally {
      enviandoFormulario.current = false
      setGuardando(false)
    }
  }

  return (
    <>
      <button type="button" className="boton-volver productos-volver" onClick={() => cambiarPagina('Dashboard')}>
        Volver
      </button>
      <section className="seccion panel">
        <h2>Datos personales</h2>
        {error && <p className="productos-error" role="alert">{error}</p>}
        {!perfil && !error && <BloqueCarga mensaje="Consultando tu perfil…" />}
        {perfil && formulario && (
          <>
            <div className="perfil-personal-avatar">
              <AvatarPerfil nombre={perfil.nombre} imagen={vista || perfil.imagen_url} />
              <strong>{perfil.nombre}</strong>
            </div>
            <form className="productos-formulario" noValidate onSubmit={guardar}>
              {camposPersonales.map(([campo, titulo, tipo, autocompletar, maxLength]) => (
                <label key={campo}>
                  <span>{titulo} <span className="usuario-obligatorio" aria-hidden="true">*</span></span>
                  <input name={campo} type={tipo} maxLength={maxLength} value={formulario[campo]}
                    autoComplete={autocompletar} onChange={actualizarCampo} required />
                </label>
              ))}
              <label className="usuarios-fila-completa">
                Imagen de perfil
                <input ref={inputImagen} type="file" name="imagen" accept="image/jpeg,image/png,image/webp"
                  onChange={seleccionarImagen} disabled={guardando} />
                <small>JPEG, PNG o WebP. Máximo 5 MB.</small>
              </label>
              <div className="usuarios-fila-completa">
                <button type="button" className="productos-boton-secundario" aria-expanded={cambiarContrasena}
                  disabled={guardando} onClick={() => setCambiarContrasena(!cambiarContrasena)}>
                  Cambiar contraseña
                </button>
              </div>
              {cambiarContrasena && (
                <>
                  <label>Contraseña actual<input type="password" name="contrasena_actual" autoComplete="current-password"
                    value={formulario.contrasena_actual} onChange={actualizarCampo} required /></label>
                  <label>Nueva contraseña<input type="password" name="contrasena_nueva" autoComplete="new-password"
                    value={formulario.contrasena_nueva} onChange={actualizarCampo} required /></label>
                  <label>Confirmar nueva contraseña<input type="password" name="confirmar_contrasena" autoComplete="new-password"
                    value={formulario.confirmar_contrasena} onChange={actualizarCampo} required /></label>
                </>
              )}
              <div className="usuarios-acciones usuarios-fila-completa">
                <button type="button" className="productos-boton-secundario" disabled={guardando}
                  onClick={() => cambiarPagina('Dashboard')}>
                  Cancelar
                </button>
                <button type="submit" className="boton-volver" disabled={guardando}>
                  {guardando ? <IndicadorCarga>Guardando…</IndicadorCarga> : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </>
  )
}

export default MiPerfil
