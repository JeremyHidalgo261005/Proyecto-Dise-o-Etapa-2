import estilosComprobante from './Comprobante.css?inline'
import estilosImpresion from './FacturaImpresion.css?inline'

export default function imprimirFactura(contenido, numero) {
  document.querySelector('.marco-impresion-factura')?.remove()
  const marco = document.createElement('iframe')
  marco.className = 'marco-impresion-factura'
  marco.setAttribute('aria-hidden', 'true')
  marco.tabIndex = -1
  marco.title = 'Imprimir ' + numero
  marco.style.cssText = 'position: fixed; width: 1px; height: 1px; opacity: 0; border: 0; pointer-events: none;'
  document.body.append(marco)

  try {
    const documento = marco.contentDocument
    const ventana = marco.contentWindow
    const estilos = documento.createElement('style')
    estilos.textContent = estilosComprobante + '\n' + estilosImpresion

    const copia = documento.importNode(contenido, true)
    copia.querySelectorAll('[data-no-imprimir]').forEach((elemento) => elemento.remove())
    documento.documentElement.lang = 'es'
    documento.title = numero
    documento.head.append(estilos)
    documento.body.append(copia)
    ventana.addEventListener('afterprint', () => marco.remove(), { once: true })
    ventana.print()
  } catch {
    marco.remove()
    throw new Error('No se pudo preparar la factura para imprimir.')
  }
}
