
import './Sidebar.css'

function Sidebar({ pagina, cambiarPagina, usuario }) {

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

  return (
    <aside className="sidebar">

      <div className="sidebar-logo">
        <div className="logo-icono">M</div>

        <div>
          <h2>MiniGestor</h2>
          <p>Administración de minisúper</p>
        </div>
      </div>

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
          >
            {obtenerNombre(opcion)}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>MiniGestor</p>
        <span>Tu negocio, bajo control</span>
      </div>

    </aside>
  )
}

export default Sidebar
