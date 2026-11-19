const iconos = {
  Dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/>
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/>
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/>
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>
    </svg>
  ),
  Inventario: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="5" rx="1.6"/>
      <path d="M4.5 9v9A1.5 1.5 0 0 0 6 19.5h12a1.5 1.5 0 0 0 1.5-1.5V9"/>
      <path d="M10 13h4"/>
    </svg>
  ),
  Categorias: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.1a2 2 0 0 1 1.6.8l.9 1.2H18.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>
      <path d="M7 13h6"/>
    </svg>
  ),
  Proveedores: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 16V7.5A1.5 1.5 0 0 0 12.5 6h-9A1.5 1.5 0 0 0 2 7.5V16h12z"/>
      <path d="M14 10h3.6a2 2 0 0 1 1.66.89L21 14v2h-2"/>
      <circle cx="7" cy="17.5" r="1.8"/>
      <circle cx="17" cy="17.5" r="1.8"/>
      <path d="M10.5 17.5h3"/>
    </svg>
  ),
  Movimientos: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="11" height="18" rx="1.8"/>
      <path d="M5.8 7h5.4"/>
      <path d="M5.8 11h5.4"/>
      <path d="M5.8 15h5.4"/>
      <path d="M5.8 18.5h3"/>
      <path d="M16.2 7 18.4 4.8 20.6 7"/>
      <path d="M18.4 4.8v5.4"/>
      <path d="M16.2 17 18.4 19.2 20.6 17"/>
      <path d="M18.4 19.2v-5.4"/>
    </svg>
  ),
  Ventas: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16.5 9.5 10l4 4L21 6.5"/>
      <path d="M15.5 6.5H21v5.5"/>
    </svg>
  ),
  'Importar CSV': (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
      <path d="M14 3v5h5"/>
      <path d="M12 18.5v-6"/>
      <path d="M9.5 15 12 12.5 14.5 15"/>
    </svg>
  ),
  Recomendaciones: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 3.5 12.7 8 17.2 9.7 12.7 11.4 11 15.9 9.3 11.4 4.8 9.7 9.3 8z"/>
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2L15.5 17.5l2.2-.8z"/>
    </svg>
  )
}

function IconoNavegacion({ destino }) {
  return iconos[destino] || '•'
}

export default IconoNavegacion
