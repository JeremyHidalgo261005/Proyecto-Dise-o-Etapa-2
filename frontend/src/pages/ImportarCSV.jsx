import { IndicadorCarga } from '../components/CargaUI'
import { useErrorConAviso, useNotificar } from '../components/avisos'
import { cerrarConAnimacion } from '../components/transiciones'
import { useState, useRef } from 'react'
import './ImportarCSV.css'

async function obtenerTokenCSRF() {
  const respuesta = await fetch('/api/auth/csrf/', {
    credentials: 'same-origin'
  })
  if (!respuesta.ok) {
    throw new Error('No se pudo obtener el token CSRF.')
  }
  const datos = await respuesta.json()
  return datos.csrfToken
}

function ImportarCSV({ cambiarPagina }) {
  const [archivo, setArchivo] = useState(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useErrorConAviso()
  const notificar = useNotificar()
  const enviando = useRef(false)
  const fondoModal = useRef(null)
  const [resultadoModal, setResultadoModal] = useState(null) // { creados, actualizados, omitidos }
  const inputRef = useRef(null)

  function manejarArchivo(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Por favor seleccioná un archivo con formato .CSV')
      setArchivo(null)
      return
    }
    setError('')
    setArchivo(file)
  }

  function onDragOver(e) {
    e.preventDefault()
    setArrastrando(true)
  }

  function onDragLeave(e) {
    e.preventDefault()
    setArrastrando(false)
  }

  function onDrop(e) {
    e.preventDefault()
    setArrastrando(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      manejarArchivo(e.dataTransfer.files[0])
    }
  }

  async function procesarSubida() {
    if (!archivo || enviando.current) return
    enviando.current = true

    setCargando(true)
    setError('')

    try {
      const csrfToken = await obtenerTokenCSRF()
      const formData = new FormData()
      formData.append('archivo', archivo)

      const respuesta = await fetch('/api/productos/importar-csv/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRFToken': csrfToken
        },
        body: formData
      })

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(datos.detail || 'Ocurrió un error al procesar el archivo CSV.')
      }

      setResultadoModal(datos)
      if (datos.omitidos > 0) {
        notificar('Importación completada. Filas omitidas: ' + datos.omitidos + '.', 'advertencia')
      } else if (datos.creados || datos.actualizados) {
        notificar('Archivo CSV importado correctamente.', 'exito')
      } else {
        notificar('La importación terminó sin cambios.', 'info')
      }
      setArchivo(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      enviando.current = false
      setCargando(false)
    }
  }

  function descargarEjemploCSV() {
    const encabezados = 'nombre,codigo,costo,precio,categoria,proveedor,cantidad,cantidad_minima\n'
    const fila1 = 'GALLETAS CHOCOLATE RELLENAS 120G,7441001234567,450.00,600.00,Snacks y Dulces,Distribuidora San José,24,6\n'
    const fila2 = 'LECHE ENTERA 1L,7441009876543,780.00,950.00,Lácteos,Cooperativa Dos Pinos,40,10\n'
    const fila3 = 'ARROZ BLANCO 1.8KG,7441005544332,1200.00,1450.00,Granos Básicos,Arrocera Central,50,12\n'
    
    const blob = new Blob([encabezados + fila1 + fila2 + fila3], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'plantilla_productos_ejemplo.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="importar-contenedor">
      <button
        type="button"
        className="boton-volver productos-volver"
        onClick={() => cambiarPagina('Dashboard')}
      >
        Volver al Dashboard
      </button>

      {error && (
        <div className="mensaje-alerta error" role="alert">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="importar-grid">
        {/* Lado izquierdo: Zona Drag and Drop para subir CSV */}
        <div className="importar-card">
          <h3>
            <span>📤</span> Subir Archivo de Productos
          </h3>
          <p>
            Cargá tu archivo CSV para actualizar el inventario existente o dar de alta nuevos productos y proveedores automáticamente.
          </p>

          <input
            type="file"
            accept=".csv"
            ref={inputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                manejarArchivo(e.target.files[0])
              }
            }}
          />

          <div
            className={`dropzone ${arrastrando ? 'arrastrando' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            {/* Icono de nube con flecha estilizado */}
            <svg
              className="dropzone-icono"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9" />
              <path d="m16 16-4-4-4 4" />
            </svg>

            <span className="dropzone-texto-principal">
              Arrastrá y soltá tu archivo aquí
            </span>
            <span className="dropzone-separador">o</span>

            <button
              type="button"
              className="boton-examinar"
              onClick={(e) => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
            >
              Explorar archivos
            </button>
          </div>

          {archivo && (
            <div className="archivo-seleccionado-caja">
              <div className="archivo-info">
                <span>📄</span>
                <span>{archivo.name} ({Math.round(archivo.size / 1024)} KB)</span>
              </div>
              <button
                type="button"
                className="boton-quitar-archivo"
                aria-label="Quitar archivo" data-tooltip="Quitar archivo"
                onClick={() => {
                  setArchivo(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
              >
                ✕
              </button>
            </div>
          )}

          <button
            type="button"
            className="boton-procesar-csv"
            disabled={!archivo || cargando}
            onClick={procesarSubida}
          >
            {cargando ? <IndicadorCarga>Procesando e importando datos…</IndicadorCarga> : 'Procesar e Importar CSV'}
          </button>
        </div>

        {/* Lado derecho: Guía de formato y ejemplo */}
        <div className="importar-card">
          <h3>
            <span>📋</span> Formato de Producto Requerido
          </h3>
          <p>
            El sistema detectará automáticamente cada fila. Si el producto ya existe (por código o nombre), <strong>sumará las existencias al stock actual</strong> y actualizará los costos. Si es nuevo, se creará junto a su categoría y proveedor.
          </p>

          <div className="formato-guia">
            <ul className="lista-atributos">
              <li><strong>nombre:</strong> Nombre del producto</li>
              <li><strong>costo:</strong> Costo unitario</li>
              <li><strong>precio:</strong> Precio de venta</li>
              <li><strong>categoria:</strong> Categoría</li>
              <li><strong>proveedor:</strong> Proveedor</li>
              <li><strong>cantidad:</strong> Stock a sumar/ingresar</li>
              <li><strong>cantidad_minima:</strong> Stock mínimo</li>
              <li><strong>codigo:</strong> Código/SKU (opcional)</li>
            </ul>

            <div className="tabla-ejemplo-wrapper">
              <table className="tabla-ejemplo">
                <thead>
                  <tr>
                    <th>nombre</th>
                    <th>costo</th>
                    <th>precio</th>
                    <th>categoria</th>
                    <th>proveedor</th>
                    <th>cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Galletas Choco 120g</td>
                    <td>450.00</td>
                    <td>600.00</td>
                    <td>Snacks</td>
                    <td>Dist. San José</td>
                    <td>24</td>
                  </tr>
                  <tr>
                    <td>Leche Entera 1L</td>
                    <td>780.00</td>
                    <td>950.00</td>
                    <td>Lácteos</td>
                    <td>Dos Pinos</td>
                    <td>40</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            className="boton-descargar-plantilla"
            onClick={descargarEjemploCSV}
          >
            <span>📥</span> Descargar plantilla de ejemplo (.csv)
          </button>
        </div>
      </div>

      {/* ========================================================
          MODAL CON FONDO OSCURO QUE SE ACTIVA AL IMPORTAR
         ======================================================== */}
      {resultadoModal && (
        <div
          className="modal-overlay" ref={fondoModal}
          onClick={() => cerrarConAnimacion(fondoModal.current, () => setResultadoModal(null))}
        >
          <div
            className="modal-contenido"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icono-exito">
              ✓
            </div>

            <h3 className="modal-titulo">¡Importación Exitosa!</h3>
            <p className="modal-descripcion">
              El archivo CSV ha sido procesado correctamente con las reglas de negocio.
            </p>

            <div className="modal-metricas">
              <div className="metrica-item">
                <span className="metrica-valor" style={{ color: '#2e7d32' }}>
                  {resultadoModal.creados}
                </span>
                <span className="metrica-etiqueta">Nuevos Creados</span>
              </div>

              <div className="metrica-item">
                <span className="metrica-valor" style={{ color: '#1976d2' }}>
                  {resultadoModal.actualizados}
                </span>
                <span className="metrica-etiqueta">Stock Sumado</span>
              </div>

              <div className="metrica-item">
                <span className="metrica-valor" style={{ color: '#f57c00' }}>
                  {resultadoModal.omitidos}
                </span>
                <span className="metrica-etiqueta">Omitidos/Nulos</span>
              </div>
            </div>

            <button
              type="button"
              className="modal-boton-cerrar"
              onClick={() => cerrarConAnimacion(fondoModal.current, () => cambiarPagina('Inventario'))}
            >
              Ver productos en el inventario
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImportarCSV
