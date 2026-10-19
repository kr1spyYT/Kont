import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource/pt-sans/700.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
