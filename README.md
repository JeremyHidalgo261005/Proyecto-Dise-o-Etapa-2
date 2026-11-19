# MiniGestor - Sistema de Gestión para Minisúper

Proyecto desarrollado con **Django** (Backend) y **React + Vite** (Frontend).

---

## 🚀 Puesta en Marcha

### 1. Backend (Django)

```bash
cd backend

# Crear entorno virtual (si es primera vez)
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Aplicar migraciones (descarga y limpia automáticamente los datasets desde Hugging Face e inserta los datos)
python manage.py migrate

# Iniciar servidor
python manage.py runserver
```

---

### 2. Frontend (React + Vite)

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará disponible en `http://localhost:5173/` y conectará automáticamente con el backend en `http://127.0.0.1:8000/`.


## Autorización de ventas

Configurá un PIN de administrador en el backend mediante su hash. Desde el
entorno virtual del backend ejecutá:

```powershell
python -c "from django.contrib.auth.hashers import make_password; from getpass import getpass; print(make_password(getpass('PIN administrativo: ')))"
```

Antes de ejecutar el comando, establecé `DJANGO_SETTINGS_MODULE=config.settings`
en el entorno. Copiá el hash completo a `VENTAS_PIN_ADMIN_HASH` en el archivo
`backend/.env` o en la configuración del servidor. Reiniciá Django después de guardar el archivo. Se solicita el PIN al aplicar
o modificar un descuento. La autorización del descuento
caduca a los 15 minutos y queda vinculada al cajero, al porcentaje y al borrador.

La migración nueva es `ventas.0002_registrar_pago_y_solicitud`. Aplicala cuando
corresponda desplegar esta versión. Para ejecutar las pruebas, dirigí las
variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` a una
instancia de PostgreSQL de pruebas y ejecutá
`python manage.py test modulos.ventas` desde `backend`.


## Movimientos de inventario

Desde **Movimientos → Registrar movimiento**, seleccioná un producto y el tipo
de cambio. La pantalla abre el formulario correspondiente para ajustar una
cantidad absoluta o cambiar el precio de venta, costo, proveedor o categoría.
Seleccioná un motivo y, si elegís **Otro**, escribí el detalle antes de guardar.

Los mismos cambios se registran al editar un producto o importar un CSV. Las
ventas y el stock inicial de un alta siguen generando sus movimientos
automáticos. El historial conserva los nombres de proveedores y categorías tal
como estaban al momento del cambio. Las cargas antiguas que solo establecieron
un saldo no se reconstruyen.

Para desplegar el módulo se requiere la migración nueva
`movimientos_inventario.0002_tipos_y_valores_historicos`. Para las pruebas,
apuntá las variables de conexión a un PostgreSQL temporal y ejecutá
`python manage.py test modulos.movimientos_inventario modulos.ventas`
desde `backend`.

Si la aplicación informa que falta la migración de movimientos, completá la
actualización del esquema en el entorno de despliegue antes de editar productos
o registrar movimientos. El guardado se revierte si el historial no puede
registrarse.


## Dashboard e historial de ventas

El Dashboard consulta PostgreSQL para mostrar los productos registrados, los
que alcanzaron su stock mínimo o están por debajo, las ventas del día y las
tres ventas más recientes. Las fechas se muestran y filtran en la zona horaria
de Costa Rica.

Abrí el historial con **Ver todas las ventas** desde el Dashboard o con
**Historial de ventas** desde el punto de venta. Podés buscar por número de
factura (por ejemplo, FAC-123), combinar fecha y método de pago, navegar por
páginas de 15 ventas y consultar los artículos de cada factura. El historial
es de consulta y conserva los permisos de Ventas. Volver al punto de venta
desde el historial conserva el carrito abierto.

Para verificar las consultas y las regresiones en una base temporal, ejecutá
`python manage.py test modulos.ventas modulos.movimientos_inventario` desde
`backend` apuntando las variables de conexión a ese entorno de pruebas.
