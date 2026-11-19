import { useEffect, useRef, useState } from 'react'
import AvatarPerfil from './AvatarPerfil'
import ConfirmarEliminacion from './ConfirmarEliminacion'
import './Perfil.css'

const iconos = {
  perfil: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  usuarios: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.9 M16 4.2a4 4 0 0 1 0 7.6',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M15 17l5-5-5-5 M20 12H9'
}

function IconoPerfil({ tipo }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconos[tipo]} />
    </svg>
  )
}

function MenuPerfil({ usuario, cambiarPagina, onCerrarSesion }) {
  const [abierto, setAbierto] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const menu = useRef(null)
  const boton = useRef(null)

  useEffect(() => {
    if (!abierto) return

    function alPresionar(evento) {
      if (!menu.current?.contains(evento.target)) setAbierto(false)
    }
    function alTeclado(evento) {
      if (evento.key === 'Escape') {
        setAbierto(false)
        boton.current?.focus()
      }
    }

    document.addEventListener('pointerdown', alPresionar)
    document.addEventListener('keydown', alTeclado)
    return () => {
      document.removeEventListener('pointerdown', alPresionar)
      document.removeEventListener('keydown', alTeclado)
    }
  }, [abierto])

  function navegar(pagina) {
    setAbierto(false)
    cambiarPagina(pagina)
  }

  return (
    <div className="perfil-menu-contenedor" ref={menu}>
      <button ref={boton} type="button" className="perfil-menu-boton" aria-expanded={abierto}
        data-tooltip={abierto ? "Cerrar opciones de perfil" : "Abrir opciones de perfil"} aria-controls="opciones-perfil" aria-label={'Opciones de perfil de ' + usuario.nombre}
        onClick={() => setAbierto((actual) => !actual)}>
        <span className="perfil-menu-nombre">{usuario.nombre}</span>
        <AvatarPerfil nombre={usuario.nombre} imagen={usuario.imagen_url} />
      </button>

      <div className="perfil-menu" id="opciones-perfil" data-abierto={abierto} inert={!abierto}>
        <button type="button" data-tooltip="Editar tus datos personales" onClick={() => navegar('Mi perfil')}>
          <IconoPerfil tipo="perfil" /> Mi perfil
        </button>
        {usuario.rol === 'Administrador' && (
          <button type="button" data-tooltip="Gestionar cuentas y permisos" onClick={() => navegar('Administrar usuarios')}>
            <IconoPerfil tipo="usuarios" /> Administrar usuarios
          </button>
        )}
        <button type="button" data-tooltip="Cerrar tu sesión en MiniGestor"
          onClick={() => { setAbierto(false); setConfirmarSalida(true) }}>
          <IconoPerfil tipo="salir" /> Cerrar sesión
        </button>
      </div>

      {confirmarSalida && (
        <ConfirmarEliminacion titulo="Cerrar sesión" mensaje="¿Querés cerrar tu sesión en MiniGestor?"
          accion="Cerrar sesión" procesando="Cerrando…"
          onCancelar={() => setConfirmarSalida(false)} onEliminar={onCerrarSesion} />
      )}
    </div>
  )
}

export default MenuPerfil
