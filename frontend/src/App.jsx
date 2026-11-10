
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import './App.css'

function App() {
  const [pagina, cambiarPagina] = useState('Dashboard')

  const accesos = [
  { nombre: 'Nueva venta', destino: 'Ventas' },
  { nombre: 'Nuevo producto', destino: 'Inventario' },
  { nombre: 'Nueva categoría', destino: 'Inventario' },
  { nombre: 'Nuevo proveedor', destino: 'Proveedores' }
]

  return (
    <div className="aplicacion">
      <Sidebar pagina={pagina} cambiarPagina={cambiarPagina} />

      <main className="contenido">
        <header className="encabezado">
          <div>
            <h1>{pagina}</h1>
            <p>Sistema de administración de MiniGestor</p>
          </div>
          <span className="etiqueta-desarrollo">
            Versión de desarrollo
          </span>
        </header>

        {pagina === 'Dashboard' ? (
          <>
            <section className="bienvenida">
  <div className="bienvenida-texto">
    <span className="mini-etiqueta">Centro de control</span>
    <h2>Gestioná tu minisúper de forma clara y rápida</h2>
    <p>
      Registrá ventas, agregá productos, organizá categorías
      y mantené el inventario bajo control desde un solo lugar.
    </p>
  </div>

  <div className="bienvenida-badge">
    <span>MiniGestor</span>
    <strong>Dashboard principal</strong>
  </div>
</section>

            <section className="seccion">
              <h2>Accesos rápidos</h2>

              <div className="accesos-grid">
                {accesos.map((acceso) => (
                  <button
                    key={acceso.nombre}
                    className="acceso-card"
                    onClick={() => cambiarPagina(acceso.destino)}
                  >
                    <span>{acceso.nombre}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="resumen-grid">
              <div className="resumen-card">
                <h3>Productos registrados</h3>
                <p>Pendiente</p>
                <span>Sin conexión a la base de datos</span>
              </div>

              <div className="resumen-card">
                <h3>Ventas del día</h3>
                <p>Pendiente</p>
                <span>Sin ventas cargadas</span>
              </div>

              <div className="resumen-card">
                <h3>Productos con stock bajo</h3>
                <p>Pendiente</p>
                <span>Sin inventario cargado</span>
              </div>
            </section>

            <section className="seccion panel">
              <h2>Ventas recientes</h2>
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>ID de venta</th>
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan="4" className="tabla-vacia">
                        Todavía no hay ventas registradas.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="panel pagina-pendiente">
            <h2>{pagina}</h2>
            <p>
              Esta sección se encuentra en desarrollo.
              Próximamente tendrá sus propias funciones.
            </p>
            <button
              className="boton-volver"
              onClick={() => cambiarPagina('Dashboard')}
            >
              Volver al Dashboard
            </button>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
