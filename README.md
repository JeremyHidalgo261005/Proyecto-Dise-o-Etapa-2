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
