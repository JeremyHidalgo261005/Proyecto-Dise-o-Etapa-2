
import { useState } from 'react'
import IconoNavegacion from './IconoNavegacion'
import './Sidebar.css'

function Sidebar({
  pagina,
  cambiarPagina,
  usuario,
  onCerrarSesion,
  cerrandoSesion,
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

  // Obtener inicial del usuario
  const nombreUsuario = usuario?.nombre || 'Usuario'
  const inicialUsuario = nombreUsuario.charAt(0).toUpperCase()

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
          title={contraido ? 'Expandir menú' : 'Contraer menú'}
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
              title={contraido ? obtenerNombre(opcion) : undefined}
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

        {/* INFORMACIÓN DEL USUARIO Y CIERRE DE SESIÓN */}
        <div className="sidebar-footer">

          <div className="sidebar-usuario">

            <div className="usuario-avatar">
              {inicialUsuario}
            </div>

            <div className="usuario-datos">
              <p className="usuario-nombre">
                {nombreUsuario}
              </p>

              <span className="usuario-rol">
                {usuario?.rol}
              </span>
            </div>

          </div>

          <button
            type="button"
            className="sidebar-cerrar-sesion"
            onClick={onCerrarSesion}
            disabled={cerrandoSesion}
            title={contraido ? 'Cerrar sesión' : undefined}
          >
            <span className="cerrar-sesion-icono" aria-hidden="true">
              ↪
            </span>

            <span className="cerrar-sesion-texto">
              {cerrandoSesion
                ? 'Cerrando...'
                : 'Cerrar sesión'}
            </span>
          </button>

        </div>
      </div>

    </aside>
  )
}

export default Sidebar
