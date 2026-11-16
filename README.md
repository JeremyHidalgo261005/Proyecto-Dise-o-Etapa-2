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
