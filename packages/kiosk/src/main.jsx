import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// STRICT RULE: No browser-native popups (alert/confirm/prompt). All popups must be in-app.
if (typeof window !== 'undefined') {
  window.alert = (msg) => {
    console.warn('[NATIVE ALERT BLOCKED]:', msg);
  };
  window.confirm = (msg) => {
    console.warn('[NATIVE CONFIRM BLOCKED]:', msg);
    return false;
  };
  window.prompt = (msg) => {
    console.warn('[NATIVE PROMPT BLOCKED]:', msg);
    return null;
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
