import { useState } from 'react'

export function useSeleccionTabla(filas, campo = 'id') {
  const [ids, setIds] = useState(() => new Set())
  const elegidos = filas.filter((fila) => ids.has(fila[campo]))
  const todos = filas.length > 0 && elegidos.length === filas.length

  function alternar(id) {
    setIds((anteriores) => {
      const siguientes = new Set(anteriores)
      if (siguientes.has(id)) siguientes.delete(id)
      else siguientes.add(id)
      return siguientes
    })
  }

  return {
    elegidos, todos, alternar,
    marcada: (fila) => ids.has(fila[campo]),
    alternarTodas: () => setIds(new Set(todos ? [] : filas.map((fila) => fila[campo]))),
    limpiar: () => setIds(new Set())
  }
}
