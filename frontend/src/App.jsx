/**
 * Prahari — Root Application Component (App.jsx)
 * ================================================
 * Defines client-side routing for all application pages.
 * Each route renders inside the DashboardLayout shell.
 *
 * Route Map:
 *   /              → HomePage (feature overview)
 *   /scanner       → CameraScanner  [Phase 3]
 *   /medications   → DrugIntelligence [Phase 4]
 *   /triage        → SymptomChecker [Phase 5]
 *   /directory     → ProviderDirectory [Phase 5]
 *   *              → 404 Not Found
 */

import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import DashboardLayout from './components/layout/DashboardLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import CameraScanner from './components/scanner/CameraScanner.jsx'
import MedicationsPage from './pages/MedicationsPage.jsx'
import TriagePage from './pages/TriagePage.jsx'
import DirectoryPage from './pages/DirectoryPage.jsx'

/**
 * Premium, network-aware offline banner component.
 * Monitors browser network status and alerts the user when offline.
 */
function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="alert"
      id="offline-warning-banner"
      style={{
        backgroundColor: 'var(--color-alert-moderate-bg)',
        border: '1.5px solid var(--color-alert-moderate-border)',
        borderRadius: '12px',
        color: 'var(--color-alert-moderate)',
        padding: '1rem 1.25rem',
        fontSize: '0.9rem',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.5"></path>
        <path d="M5 12.5a10.94 10.94 0 0 1 5.83-2.84"></path>
        <path d="M12 18.5a4.25 4.25 0 0 1-2.48-1"></path>
        <path d="M12 18.5a4.25 4.25 0 0 0 2.48-1"></path>
        <path d="M10.66 5.66A16.19 16.19 0 0 1 12 5.5a16.2 16.2 0 0 1 7 1.56"></path>
        <path d="M5 7.06a16.14 16.14 0 0 1 2.34-1.4"></path>
      </svg>
      <span>
        Viewing cached offline data. Scanner and Triage features require an active connection.
      </span>
    </div>
  )
}

export default function App() {
  return (
    <DashboardLayout>
      <OfflineBanner />
      <Routes>
        {/* Home / Dashboard */}
        <Route path="/" element={<HomePage />} />

        {/* Scanner — Phase 3 ✅ */}
        <Route path="/scanner" element={<CameraScanner />} />

        {/* Medication Intelligence — Phase 4 ✅ */}
        <Route path="/medications" element={<MedicationsPage />} />

        {/* Symptom Triage — Phase 5 ✅ */}
        <Route path="/triage" element={<TriagePage />} />

        {/* Doctor Directory — Phase 5 ✅ */}
        <Route path="/directory" element={<DirectoryPage />} />

        {/* Catch-all — redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  )
}

