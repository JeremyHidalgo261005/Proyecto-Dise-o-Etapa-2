
import { useState } from 'react'
import Sidebar from '../components/Sidebar'

function MainLayout({
  pagina,
  cambiarPagina,
  children,
  usuario,
  onCerrarSesion,
  cerrandoSesion
}) {

  // Controlar el estado del Sidebar
  const [contraido, setContraido] = useState(false)

  // Alternar entre expandido y contraído
  function alternarSidebar() {
    setContraido((estadoActual) => !estadoActual)
  }

  return (
    <div className="aplicacion">

      {/* MENÚ LATERAL */}
      <Sidebar
        pagina={pagina}
        cambiarPagina={cambiarPagina}
        usuario={usuario}
        onCerrarSesion={onCerrarSesion}
        cerrandoSesion={cerrandoSesion}
        contraido={contraido}
        alternarSidebar={alternarSidebar}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="contenido">

        {/* ENCABEZADO DE LA PÁGINA */}
        <header className="encabezado">
          <div>
            <h1>{pagina === 'Categorias' ? 'Categorías' : pagina}</h1>

            <p>Sistema de administración de MiniGestor</p>
          </div>
        </header>

        {/* CONTENIDO DE CADA MÓDULO */}
        {children}

      </main>

    </div>
  )
}

export default MainLayout
