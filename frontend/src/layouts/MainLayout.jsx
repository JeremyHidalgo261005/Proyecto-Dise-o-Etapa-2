
import Sidebar from '../components/Sidebar'

function MainLayout({ pagina, cambiarPagina, children }) {
  return (
    <div className="aplicacion">
      <Sidebar
        pagina={pagina}
        cambiarPagina={cambiarPagina}
      />

      <main className="contenido">
        <header className="encabezado">
          <div>
            <h1>{pagina}</h1>
            <p>Sistema de administración de MiniGestor</p>
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
