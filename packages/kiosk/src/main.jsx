import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { detectBrand, applyBrandTheme } from './config/brands.js'

// Apply brand theme before first render
const activeBrandId = detectBrand()
applyBrandTheme(activeBrandId)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App brandId={activeBrandId} />
  </React.StrictMode>
)
