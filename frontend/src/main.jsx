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
