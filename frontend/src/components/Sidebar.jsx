
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

  const opcionesAdministrador = [
    'Dashboard',
    'Productos',
    'Categorias',
    'Proveedores',
    'Inventario',
    'Ventas',
    'Importar CSV',
    'Recomendaciones'
  ]

  const opcionesCajero = [
    'Dashboard',
    'Productos',
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

  // Iconos para las opciones del menú
  function obtenerIcono(opcion) {
    const iconos = {
      Dashboard: '▦',
      Productos: '▤',
      Categorias: '▧',
      Proveedores: '▥',
      Inventario: '▣',
      Ventas: '▱',
      'Importar CSV': '⇧',
      Recomendaciones: '✧'
    }

    return iconos[opcion] || '•'
  }

  // Obtener inicial del usuario
  const nombreUsuario = usuario?.nombre || 'Usuario'
  const inicialUsuario = nombreUsuario.charAt(0).toUpperCase()

  return (
    <aside className={`sidebar ${contraido ? 'contraido' : ''}`}>

      {/* ENCABEZADO DEL SIDEBAR */}
      <div className="sidebar-encabezado">

        <div className="sidebar-logo">
          <div className="logo-icono">M</div>

          <div className="sidebar-logo-texto">
            <h2>MiniGestor</h2>
            <p>Gestión de minisúper</p>
          </div>
        </div>

        {/* BOTÓN CONTRAER / EXPANDIR */}
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

      {/* MENÚ DE NAVEGACIÓN */}
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
            onClick={() => cambiarPagina(opcion)}
            aria-current={
              pagina === opcion ? 'page' : undefined
            }
            title={contraido ? obtenerNombre(opcion) : undefined}
          >
            <span className="menu-icono" aria-hidden="true">
              {obtenerIcono(opcion)}
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

    </aside>
  )
}

export default Sidebar
