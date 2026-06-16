/**
 * Prahari — React Application Entry Point
 * =========================================
 * Bootstraps the React tree, attaches it to the DOM root defined in
 * index.html, and wraps the application in React Router and any
 * global context providers.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'

// Import global styles (Tailwind directives + Prahari design tokens)
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* BrowserRouter wraps the entire application for client-side routing */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// Register/Unregister Service Worker for offline PWA support depending on environment
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      let unregisteredAny = false;
      const unregisterPromises = registrations.map(registration =>
        registration.unregister().then(success => {
          if (success) unregisteredAny = true;
        })
      );
      Promise.all(unregisterPromises).then(() => {
        if (unregisteredAny) {
          console.log('Cleaned up active Service Worker in development mode. Reloading page...');
          window.location.reload();
        }
      });
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope)
        })
        .catch((err) => {
          console.error('ServiceWorker registration failed: ', err)
        })
    })
  }
}

