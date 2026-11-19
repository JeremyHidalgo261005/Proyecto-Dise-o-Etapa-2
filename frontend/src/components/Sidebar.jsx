
import { useState } from 'react'
import IconoNavegacion from './IconoNavegacion'
import './Sidebar.css'

function Sidebar({
  pagina,
  cambiarPagina,
  usuario,
  contraido,
  alternarSidebar
}) {

  // Controlar el despliegue del menú vertical en celulares
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)

  const opcionesAdministrador = [
    'Dashboard',
    'Inventario',
    'Categorias',
    'Proveedores',
    'Movimientos',
    'Ventas',
    'Importar CSV',
    'Recomendaciones'
  ]

  const opcionesCajero = [
    'Dashboard',
    'Inventario',
    'Ventas'
  ]

  // Seleccionar el menú según el rol
  const opciones = usuario?.rol === 'Administrador'
    ? opcionesAdministrador
    : usuario?.rol === 'Cajero'
      ? opcionesCajero
      : []

  // Mostrar nombres más bonitos en el menú
  function obtenerNombre(opcion) {
    if (opcion === 'Categorias') {
      return 'Categorías'
    }

    return opcion
  }

  function seleccionarOpcion(opcion) {
    cambiarPagina(opcion)
    setMenuMovilAbierto(false)
  }

  return (
    <aside className={`sidebar ${contraido ? 'contraido' : ''} ${menuMovilAbierto ? 'movil-abierto' : ''}`}>

      {/* ENCABEZADO DEL SIDEBAR */}
      <div className="sidebar-encabezado">

        <div className="sidebar-logo">
          <div className="logo-icono">M</div>

          <div className="sidebar-logo-texto">
            <h2>MiniGestor</h2>
            <p>Gestión de minisúper</p>
          </div>
        </div>

        {/* BOTÓN DESPLEGABLE PARA VERSIÓN MÓVIL (HAMBURGUESA / EXPANDIBLE) */}
        <button
          type="button"
          className="sidebar-movil-toggle"
          onClick={() => setMenuMovilAbierto((prev) => !prev)}
          aria-label={menuMovilAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuMovilAbierto}
        >
          <span className="movil-toggle-icono">
            {menuMovilAbierto ? '✕' : '☰'}
          </span>
          <span className="movil-toggle-texto">
            {obtenerNombre(pagina)}
          </span>
          <span className="movil-toggle-flecha">
            {menuMovilAbierto ? '▲' : '▼'}
          </span>
        </button>

        {/* BOTÓN CONTRAER / EXPANDIR (ESCRITORIO) */}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={alternarSidebar}
          aria-label={contraido ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!contraido}
          data-tooltip={contraido ? 'Expandir menú' : 'Contraer menú'}
        >
          {contraido ? '»' : '«'}
        </button>

      </div>

      {/* CONTENEDOR DESPLEGABLE VERTICAL PARA MÓVIL */}
      <div className={`sidebar-desplegable-cuerpo ${menuMovilAbierto ? 'abierto' : ''}`}>
        {/* MENÚ DE NAVEGACIÓN VERTICAL */}
        <nav
          className="sidebar-menu"
          aria-label="Menú principal"
        >
          {opciones.map((opcion) => (
            <button
              key={opcion}
              type="button"
              className={`menu-opcion ${
                pagina === opcion ? 'activo' : ''
              }`}
              onClick={() => seleccionarOpcion(opcion)}
              aria-current={
                pagina === opcion ? 'page' : undefined
              }
              aria-label={obtenerNombre(opcion)}
              data-tooltip={obtenerNombre(opcion)}
            >
              <span className="menu-icono" aria-hidden="true">
                <IconoNavegacion destino={opcion} />
              </span>

              <span className="menu-texto">
                {obtenerNombre(opcion)}
              </span>
            </button>
          ))}
        </nav>


      </div>

    </aside>
  )
}

export default Sidebar
