import json
import re
import time
import csv  # <-- Nueva librería
from pathlib import Path
from playwright.sync_api import sync_playwright

def extraer_productos_de_html(html: str):
    """Extrae los productos del payload de Next.js."""
    patron = re.compile(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', re.DOTALL)
    chunks = patron.findall(html)
    payload = "".join(json.loads(c) for c in chunks)
    
    decoder = json.JSONDecoder()
    ref_pat = re.compile(r'(?m)^([0-9a-f]+):')  
    productos, pos = [], 0
    while True:
        m = ref_pat.search(payload, pos)
        if not m:
            break
        try:
            obj, fin = decoder.raw_decode(payload, m.end())
        except json.JSONDecodeError:
            pos = m.end()
            continue
        if isinstance(obj, dict) and obj.get("__typename") == "CatalogProductModel":
            productos.append(obj)
        pos = fin
    return productos

def main():
    BASE_URL = "https://www.megasuper.com/ca/abarrotes/01"
    TOTAL_PAGES = 59 # Recuerda ponerlo en 59 para el catálogo completo
    todos_los_productos = []

    print("Iniciando navegador invisible...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for i in range(1, TOTAL_PAGES + 1):
            url = f"{BASE_URL}?currentPage={i}"
            print(f"Descargando página {i}/{TOTAL_PAGES}...")
            
            try:
                page.goto(url, wait_until="networkidle", timeout=30000)
                page.wait_for_selector('[data-testid="card-name"]', timeout=10000)
                
                html = page.content()
                productos = extraer_productos_de_html(html)
                
                print(f"  -> {len(productos)} productos extraídos.")
                todos_los_productos.extend(productos)
                
            except Exception as e:
                print(f"  -> Error en la página {i}: {e}")
            
            time.sleep(1)

        browser.close()

    # Eliminar duplicados usando el SKU
    productos_unicos = list({p['sku']: p for p in todos_los_productos}.values())
    
    # --- FILTRADO DE DATOS ---
    # Nos quedamos únicamente con las columnas que necesitas
    datos_filtrados = []
    for p in productos_unicos:
        datos_filtrados.append({
            "name": p.get("name", ""),
            "price": p.get("price", ""),
            "unit": p.get("unit", ""),
            "sku": p.get("sku", ""),
            "priceBeforeTaxes": p.get("priceBeforeTaxes", ""),
            "taxTotal": p.get("taxTotal", "")
        })

    print(f"\n¡Listo! Total de productos únicos extraídos: {len(datos_filtrados)}")
    
    # --- GUARDAR EN LA MISMA CARPETA DEL SCRIPT ---
    # Obtiene la ruta exacta de la carpeta donde está este archivo .py
    carpeta_del_script = Path(__file__).resolve().parent 
    ruta_csv = carpeta_del_script / "productos_megasuper.csv"

    # Guardar en formato CSV
    with open(ruta_csv, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["name", "price", "unit", "sku", "priceBeforeTaxes", "taxTotal"])
        writer.writeheader()
        writer.writerows(datos_filtrados)
        
    print(f"Datos guardados exitosamente en: {ruta_csv}")

if __name__ == "__main__":
    main()