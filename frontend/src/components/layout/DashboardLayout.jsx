/**
 * DashboardLayout Component
 * ==========================
 * The core shell of the Prahari application. Renders:
 *
 *   ┌──────────────────────────────────────┐
 *   │  Sticky Top Navigation Bar           │
 *   │  (Logo · Nav Links · ThemeToggle)    │
 *   ├──────────────────────────────────────┤
 *   │                                      │
 *   │  Main Content Area (children)        │
 *   │  max-width: 1100px, centred          │
 *   │                                      │
 *   ├──────────────────────────────────────┤
 *   │  Footer (Medical Disclaimer)         │
 *   └──────────────────────────────────────┘
 *
 * Navigation behaviour:
 *   — Desktop: Horizontal sticky top bar with backdrop blur on scroll.
 *   — Mobile:  Fixed bottom tab bar with four main navigation icons.
 *              (Mobile bottom bar will be built out in Phase 2 polish.)
 *
 * Source: FEATURES_AND_STRUCTURE.md § 4.5 "Navigation"
 *
 * Props:
 *   children  — The page content to render in the main area.
 */

import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from '../ui/ThemeToggle.jsx'

// ----------------------------------------------------------------
// Navigation Items
// ----------------------------------------------------------------

const NAV_ITEMS = [
  {
    id: 'nav-scanner',
    label: 'Scanner',
    path: '/scanner',
    icon: (
      // Camera / scan icon
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    ),
  },
  {
    id: 'nav-medications',
    label: 'Medications',
    path: '/medications',
    icon: (
      // Pill icon
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true">
        <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/>
        <circle cx="18" cy="18" r="3"/>
        <path d="m15.5 15.5 5 5"/>
      </svg>
    ),
  },
  {
    id: 'nav-triage',
    label: 'Triage',
    path: '/triage',
    icon: (
      // Activity / heartbeat icon
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'nav-directory',
    label: 'Directory',
    path: '/directory',
    icon: (
      // Map pin icon
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
]

// ----------------------------------------------------------------
// PrahariLogo — inline SVG wordmark
// ----------------------------------------------------------------

function PrahariLogo() {
  return (
    <NavLink
      to="/"
      id="nav-logo"
      aria-label="Prahari — home"
      style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}
    >
      {/* Shield / sentinel icon mark */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Shield body */}
        <path
          d="M16 2L4 7v9c0 6.627 5.373 12 12 12s12-5.373 12-12V7L16 2z"
          fill="var(--color-teal)"
          fillOpacity="0.15"
          stroke="var(--color-teal)"
          strokeWidth="1.5"
        />
        {/* Cross / health symbol */}
        <rect x="14" y="9" width="4" height="14" rx="1" fill="var(--color-sage)" />
        <rect x="9" y="14" width="14" height="4" rx="1" fill="var(--color-sage)" />
      </svg>

      {/* Wordmark */}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.375rem',
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        Prahari
      </span>
      <span
        style={{
          fontSize: '0.625rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-teal)',
          marginLeft: '-0.25rem',
          alignSelf: 'flex-end',
          paddingBottom: '0.1rem',
        }}
      >
        BETA
      </span>
    </NavLink>
  )
}

// ----------------------------------------------------------------
// Top Navigation Bar
// ----------------------------------------------------------------

function TopNav({ scrolled }) {
  return (
    <header
      id="main-nav"
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        /* Glassmorphism on scroll — Source: FEATURES_AND_STRUCTURE.md § 4.5 */
        backgroundColor: scrolled
          ? 'rgba(247, 245, 240, 0.85)'
          : 'var(--color-surface)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'var(--color-border)' : 'transparent'}`,
        transition: 'all 200ms ease-in-out',
      }}
      className="dark:bg-dark-surface/85"
    >
      <div
        className="container-prahari"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          gap: '1.5rem',
        }}
      >
        {/* Left: Logo */}
        <PrahariLogo />

        {/* Centre: Desktop Navigation Links */}
        <nav
          role="navigation"
          aria-label="Main navigation"
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          className="hidden md:flex"
        >
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.id}
              id={item.id}
              to={item.path}
              style={({ isActive }) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.875rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'all 150ms ease-in-out',
                color: isActive ? 'var(--color-teal)' : 'var(--color-text-secondary)',
                backgroundColor: isActive ? 'rgba(42, 127, 140, 0.1)' : 'transparent',
              })}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: Theme Toggle + optional CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

// ----------------------------------------------------------------
// Mobile Bottom Tab Bar
// Source: FEATURES_AND_STRUCTURE.md § 4.5 "Mobile navigation"
// ----------------------------------------------------------------

function MobileBottomNav() {
  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      id="mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: 'var(--color-surface-card)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'stretch',
        height: '64px',
        paddingBottom: 'env(safe-area-inset-bottom)', /* iPhone notch support */
      }}
      className="md:hidden"
    >
      {NAV_ITEMS.map(item => (
        <NavLink
          key={item.id}
          to={item.path}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.2rem',
            flex: 1,
            textDecoration: 'none',
            fontSize: '0.65rem',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: isActive ? 'var(--color-teal)' : 'var(--color-text-secondary)',
            transition: 'color 150ms ease-in-out',
          })}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

// ----------------------------------------------------------------
// Footer — Medical Disclaimer
// Source: FEATURES_AND_STRUCTURE.md § 5.6.1
// ----------------------------------------------------------------

function Footer() {
  return (
    <footer
      role="contentinfo"
      style={{
        borderTop: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        padding: '2rem 0',
        marginTop: '4rem',
      }}
    >
      <div className="container-prahari">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Disclaimer text — legally required on every page */}
          <p
            style={{
              fontSize: '0.8rem',
              lineHeight: '1.6',
              color: 'var(--color-text-secondary)',
              margin: 0,
              maxWidth: '800px',
            }}
          >
            <strong style={{ color: 'var(--color-text-primary)' }}>
              Medical Disclaimer:{' '}
            </strong>
            Prahari is an informational tool only and does not constitute medical advice, diagnosis,
            or treatment. All medication information, drug interaction data, and triage assessments
            are sourced from publicly available databases (openFDA, RxNorm, Infermedica) for general
            informational purposes only.{' '}
            <strong>
              Always consult a qualified healthcare professional before making any decision about
              your medications or health.
            </strong>{' '}
            In a medical emergency, call 112 (India) · 911 (USA) · 999 (UK) immediately.
          </p>

          {/* Bottom row: copyright + data sources */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              © {new Date().getFullYear()} Prahari · MedLens v0.1.0
            </span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {['openFDA', 'RxNorm', 'Infermedica'].map(source => (
                <span
                  key={source}
                  className="chip chip-info"
                  style={{ fontSize: '0.65rem' }}
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ----------------------------------------------------------------
// DashboardLayout — Main Export
// ----------------------------------------------------------------

export default function DashboardLayout({ children }) {
  // Track scroll position to trigger nav glassmorphism effect
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text-primary)',
        transition: 'background-color 200ms ease-in-out',
      }}
    >
      {/* Sticky top navigation */}
      <TopNav scrolled={scrolled} />

      {/* Main content area */}
      <main
        id="main-content"
        role="main"
        aria-label="Main content"
        style={{
          flex: 1,
          /*
           * Add bottom padding on mobile to prevent content from being
           * hidden behind the fixed bottom tab bar (64px height).
           */
          paddingBottom: '80px',
        }}
        className="md:pb-0"
      >
        <div className="container-prahari" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
          {children}
        </div>
      </main>

      {/* Footer disclaimer */}
      <Footer />

      {/* Mobile bottom tab bar — hidden on md+ screens */}
      <MobileBottomNav />
    </div>
  )
}
