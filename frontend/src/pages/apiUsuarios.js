const RUTA = '/api/auth/'

async function leer(respuesta) {
  const datos = await respuesta.json().catch((error) => {
    if (error.name === 'AbortError') throw error
    return null
  })
  if (!respuesta.ok || !datos) {
    const mensaje = datos && (datos.detail || Object.values(datos).flat().join(' '))
    throw new Error(mensaje || 'No se pudo completar la operación.')
  }
  return datos
}

export async function consultarUsuarios(ruta, signal) {
  return leer(await fetch(RUTA + ruta, { credentials: 'same-origin', signal }))
}

export async function guardarUsuarios(ruta, method, datos) {
  const { csrfToken } = await consultarUsuarios('csrf/')
  const esArchivo = datos instanceof FormData
  const headers = { 'X-CSRFToken': csrfToken }
  if (!esArchivo) headers['Content-Type'] = 'application/json'
  return leer(await fetch(RUTA + ruta, {
    method, credentials: 'same-origin', headers,
    body: esArchivo ? datos : JSON.stringify(datos)
  }))
}
