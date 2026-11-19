const moneda = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
const fecha = new Intl.DateTimeFormat('es-CR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Costa_Rica'
})

export const factura = (id) => 'FAC-' + id
export const monto = (valor) => moneda.format(valor)
export const fechaVenta = (valor) => fecha.format(new Date(valor))
export const metodoPago = (valor) => ({ efectivo: 'Efectivo', tarjeta: 'Tarjeta' }[valor] || 'Sin registrar')

export async function consultarVentas(ruta, signal) {
  const respuesta = await fetch('/api/ventas/' + ruta, { credentials: 'same-origin', signal })
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok || !datos) {
    const errores = datos ? Object.values(datos).flat() : []
    throw new Error(datos?.detail || errores.find((valor) => typeof valor === 'string')
      || 'No se pudo consultar la información de ventas.')
  }
  return datos
}
