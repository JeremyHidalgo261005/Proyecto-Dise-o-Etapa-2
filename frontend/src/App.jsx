
import { useState } from 'react'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import Productos from './pages/Productos'
import Categorias from './pages/Categorias'
import Proveedores from './pages/Proveedores'
import Ventas from './pages/Ventas'
import Inventario from './pages/Inventario'
import './App.css'

function App() {
  const [pagina, cambiarPagina] = useState('Dashboard')

  function mostrarPagina() {
    switch (pagina) {
      case 'Dashboard':
        return <Dashboard cambiarPagina={cambiarPagina} />

      case 'Productos':
        return <Productos cambiarPagina={cambiarPagina} />

      case 'Categorias':
        return <Categorias cambiarPagina={cambiarPagina} />

      case 'Proveedores':
        return <Proveedores cambiarPagina={cambiarPagina} />

      case 'Ventas':
        return <Ventas cambiarPagina={cambiarPagina} />

      case 'Inventario':
        return <Inventario cambiarPagina={cambiarPagina} />

      default:
        return (
          <section className="panel pagina-pendiente">
            <h2>{pagina}</h2>

            <p>
              Esta sección se encuentra en desarrollo.
            </p>

            <button
              className="boton-volver"
              onClick={() => cambiarPagina('Dashboard')}
            >
              Volver al Dashboard
            </button>
          </section>
        )
    }
  }

  return (
    <MainLayout
      pagina={pagina}
      cambiarPagina={cambiarPagina}
    >
      {mostrarPagina()}
    </MainLayout>
  )
}

export default App
