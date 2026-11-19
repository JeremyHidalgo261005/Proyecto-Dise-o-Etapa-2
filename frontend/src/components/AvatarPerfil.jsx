import { useState } from 'react'

function AvatarPerfil({ nombre, imagen }) {
  const [fallida, setFallida] = useState(null)

  return (
    <span className="perfil-avatar" aria-hidden="true">
      {imagen && imagen !== fallida
        ? <img src={imagen} alt="" onError={() => setFallida(imagen)} />
        : (nombre || 'Usuario').trim().charAt(0).toUpperCase()}
    </span>
  )
}

export default AvatarPerfil
