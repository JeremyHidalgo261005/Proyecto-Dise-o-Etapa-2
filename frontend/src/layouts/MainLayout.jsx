
import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import MenuPerfil from '../components/MenuPerfil'

function MainLayout({
  pagina,
  cambiarPagina,
  children,
  usuario,
  onCerrarSesion
}) {

  const importandoCSV = pagina === 'Importar CSV'

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
        contraido={contraido}
        alternarSidebar={alternarSidebar}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="contenido">

        {/* ENCABEZADO DE LA PÁGINA */}
        <header className="encabezado encabezado-con-perfil">
          <div className={importandoCSV ? 'importar-encabezado-titulo' : undefined}>
            <h1>{importandoCSV ? 'Importar productos CSV' : pagina === 'Categorias' ? 'Categorías' : pagina}</h1>
            <p>{pagina === 'Dashboard' ? 'Te damos la bienvenida, ' + usuario.nombre : 'Sistema de administración de MiniGestor'}</p>
          </div>
          <MenuPerfil usuario={usuario} cambiarPagina={cambiarPagina} onCerrarSesion={onCerrarSesion} />
        </header>

        {/* CONTENIDO DE CADA MÓDULO */}
        {children}

      </main>

    </div>
  )
}

export default MainLayout
