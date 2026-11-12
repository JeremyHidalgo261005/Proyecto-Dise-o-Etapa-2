
import { useState } from 'react'
import './Login.css'

function Login({ onLogin, aviso = '' }) {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function manejarIngreso(evento) {
    evento.preventDefault()
    setError('')

    if (!usuario.trim() || !contrasena) {
      setError('Ingresá el usuario y la contraseña.')
      return
    }

    setCargando(true)

    try {
      await onLogin({
        usuario: usuario.trim(),
        contrasena
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="login-pagina">
      <div className="login-contenedor">

        <section className="login-lado-visual">
          <div className="login-marca">
            <span className="login-logo">M</span>
            <span>MiniGestor</span>
          </div>

          <div className="login-presentacion">
            <span className="login-etiqueta">
              Administración inteligente
            </span>

            <h1>
              Tu minisúper,
              <br />
              bajo control.
            </h1>

            <p>
              Administrá productos, proveedores,
              inventario y ventas desde un solo lugar.
            </p>

            <div className="login-decoracion">
              <div>
                <strong>Productos</strong>
                <span>Organizá tu negocio</span>
              </div>

              <div>
                <strong>Inventario</strong>
                <span>Controlá las existencias</span>
              </div>

              <div>
                <strong>Ventas</strong>
                <span>Registrá cada operación</span>
              </div>
            </div>
          </div>

          <span className="login-pie">
            MiniGestor · Sistema de administración
          </span>
        </section>

        <section className="login-lado-formulario">
          <div className="login-tarjeta">

            <span className="login-bienvenida">
              Bienvenido de nuevo
            </span>

            <h2>Iniciar sesión</h2>

            <p className="login-descripcion">
              Ingresá tus credenciales para acceder
              a MiniGestor.
            </p>

            <form onSubmit={manejarIngreso}>
              <label htmlFor="login-usuario">
                Usuario
              </label>

              <input
                id="login-usuario"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Tu nombre de usuario"
                autoComplete="username"
                maxLength={150}
                required
              />

              <label htmlFor="login-contrasena">
                Contraseña
              </label>

              <div className="login-campo-password">
                <input
                  id="login-contrasena"
                  type={mostrar ? 'text' : 'password'}
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="login-mostrar"
                  onClick={() => setMostrar(!mostrar)}
                  aria-label={
                    mostrar
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                >
                  {mostrar ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {(error || aviso) && (
                <p className="login-error" role="alert">
                  {error || aviso}
                </p>
              )}

              <button
                className="login-boton"
                type="submit"
                disabled={cargando}
              >
                {cargando
                  ? 'Verificando acceso...'
                  : 'Ingresar al sistema'}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <p className="login-seguridad">
              Acceso exclusivo para personal autorizado.
            </p>
          </div>
        </section>

      </div>
    </main>
  )
}

export default Login
