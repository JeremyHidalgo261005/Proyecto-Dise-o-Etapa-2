import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AvisosUI from './components/AvisosUI'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AvisosUI><App /></AvisosUI>
  </StrictMode>,
)
