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

import { Routes, Route, Navigate } from 'react-router-dom'

import DashboardLayout from './components/layout/DashboardLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import PlaceholderPage from './pages/PlaceholderPage.jsx'
import CameraScanner from './components/scanner/CameraScanner.jsx'
import MedicationsPage from './pages/MedicationsPage.jsx'
import TriagePage from './pages/TriagePage.jsx'
import DirectoryPage from './pages/DirectoryPage.jsx'

export default function App() {
  return (
    <DashboardLayout>
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
