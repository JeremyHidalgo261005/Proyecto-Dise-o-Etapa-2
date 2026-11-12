
import Sidebar from '../components/Sidebar'

function MainLayout({
  pagina,
  cambiarPagina,
  children,
  usuario,
  onCerrarSesion,
  cerrandoSesion
}) {
  return (
    <div className="aplicacion">
      <Sidebar
        pagina={pagina}
        cambiarPagina={cambiarPagina}
        usuario={usuario}
      />

      <main className="contenido">
        <header className="encabezado">
          <div>
            <h1>{pagina}</h1>

            <p>Sistema de administración de MiniGestor</p>

            <div className="sesion-controles">
              <span>
                {usuario.nombre} · {usuario.rol}
              </span>

              <button
                type="button"
                className="boton-cerrar-sesion"
                onClick={onCerrarSesion}
                disabled={cerrandoSesion}
              >
                {cerrandoSesion
                  ? 'Cerrando...'
                  : 'Cerrar sesión'}
              </button>
            </div>
          </div>

          {pagina === 'Dashboard' && (
            <div className="bienvenida-compacta">
              <span className="mini-etiqueta">
                Centro de control
              </span>

              <strong>
                Gestioná tu minisúper de forma clara y rápida
              </strong>
            </div>
          )}
        </header>

        {children}
      </main>
    </div>
  )
}

export default MainLayout
