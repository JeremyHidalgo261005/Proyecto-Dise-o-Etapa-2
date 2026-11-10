
import './Sidebar.css'

function Sidebar({ pagina, cambiarPagina }) {
  const opciones = [
    'Dashboard',
    'Inventario',
    'Ventas',
    'Proveedores',
    'Importar CSV',
    'Recomendaciones'
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icono">M</div>
        <div>
          <h2>MiniGestor</h2>
          <p>Administración de minisúper</p>
        </div>
      </div>

      <nav className="sidebar-menu" aria-label="Menú principal">
        {opciones.map((opcion) => (
          <button
            key={opcion}
            type="button"
            className={`menu-opcion ${pagina === opcion ? 'activo' : ''}`}
            onClick={() => cambiarPagina(opcion)}
            aria-current={pagina === opcion ? 'page' : undefined}
          >
            {opcion}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>MiniGestor</p>
        <span>Versión de desarrollo</span>
      </div>
    </aside>
  )
}

export default Sidebar
