import { createContext, useCallback, useContext, useState } from 'react'

export const ContextoAvisos = createContext(() => {})

export function useNotificar() {
  return useContext(ContextoAvisos)
}

export function useErrorConAviso(inicial = '') {
  const [error, setError] = useState(inicial)
  const notificar = useNotificar()
  const actualizar = useCallback((mensaje) => {
    setError(mensaje)
    if (mensaje) notificar(mensaje, 'error', false)
  }, [notificar])
  return [error, actualizar]
}
