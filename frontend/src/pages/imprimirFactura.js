export default function imprimirFactura(contenido, numero) {
  const marco = document.createElement('iframe')
  marco.className = 'historial-marco-impresion'
  marco.setAttribute('aria-hidden', 'true')
  marco.title = 'Imprimir ' + numero
  document.body.append(marco)

  try {
    const documento = marco.contentDocument
    const ventana = marco.contentWindow
    const estilos = documento.createElement('style')
    estilos.textContent = [
      'body { font: 12pt system-ui, sans-serif; margin: 18mm; color: #21162f }',
      'table { width: 100%; border-collapse: collapse }',
      'th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; overflow-wrap: anywhere }',
      'tr { break-inside: avoid }',
      '.historial-totales { display: grid; grid-template-columns: auto auto; justify-content: end; gap: 4px 16px }',
      'dd { margin: 0; text-align: right; font-weight: 700 }'
    ].join('\n')
    documento.title = numero
    documento.head.append(estilos)
    documento.body.append(documento.importNode(contenido, true))
    ventana.addEventListener('afterprint', () => marco.remove(), { once: true })
    ventana.print()
  } catch {
    marco.remove()
    throw new Error('No se pudo preparar la factura para imprimir.')
  }
}
