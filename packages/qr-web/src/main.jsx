import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { applyQrBrandTheme } from './config/brands.js';

// Read brand + table from URL: /order?brand=smashme&table=5&loc=1
const params = new URLSearchParams(window.location.search);
const brandId = params.get('brand') || 'smashme';
applyQrBrandTheme(brandId);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App brandId={brandId} />
  </React.StrictMode>
);
