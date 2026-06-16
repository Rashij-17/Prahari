/**
 * DashboardLayout — v3.0 "Warm Rx"
 * ===================================
 * Editorial navigation system:
 * - White sticky nav with animated underline active indicator
 * - Clean hamburger drawer (mobile)
 * - Forest green bottom tab bar (mobile)
 * - Minimal footer
 */

import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from '../ui/ThemeToggle.jsx'

// ----------------------------------------------------------------
// SVG Icon Set — consistent 24px, 1.75px stroke, rounded caps
// ----------------------------------------------------------------

const Icons = {
  Home: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  ),
  Scanner: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Pill: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2.5"/>
      <path d="m14.5 17.5 5-5"/>
      <circle cx="18" cy="18" r="4"/>
    </svg>
  ),
  Heartbeat: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  MapPin: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Shield: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12h6M12 9v6"/>
    </svg>
  ),
  Interactions: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m7 21-4-4 4-4"/>
      <path d="M21 17H3"/>
      <path d="m17 3 4 4-4 4"/>
      <path d="M3 7h18"/>
    </svg>
  ),
}

// ----------------------------------------------------------------
// Navigation Items
// ----------------------------------------------------------------
const NAV_ITEMS = [
  { id: 'home',        label: 'Home',        path: '/', exact: true, Icon: Icons.Home },
  { id: 'scanner',     label: 'Scanner',     path: '/scanner',     Icon: Icons.Scanner },
  { id: 'medications', label: 'Medications', path: '/medications', Icon: Icons.Pill },
  { id: 'interactions', label: 'Interactions', path: '/interactions', Icon: Icons.Interactions },
  { id: 'triage',      label: 'Triage',      path: '/triage',      Icon: Icons.Heartbeat },
  { id: 'directory',   label: 'Directory',   path: '/directory',   Icon: Icons.MapPin },
]

// ----------------------------------------------------------------
// Prahari Logo
// ----------------------------------------------------------------
function PrahariLogo({ onClick, size = 'default' }) {
  const isCompact = size === 'compact'
  return (
    <NavLink
      to="/"
      onClick={onClick}
      aria-label="Prahari — home"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      {/* Shield icon in forest green */}
      <div style={{
        width: isCompact ? '32px' : '36px',
        height: isCompact ? '32px' : '36px',
        borderRadius: '9px',
        background: 'var(--color-forest)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icons.Shield />
      </div>

      {!isCompact && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.375rem',
            fontWeight: 400,
            color: 'var(--color-ink)',
            letterSpacing: '-0.02em',
          }}>
            Prahari
          </span>
          <span style={{
            fontSize: '0.56rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-forest)',
            marginTop: '1px',
          }}>
            Health Sentinel
          </span>
        </div>
      )}
    </NavLink>
  )
}

// ----------------------------------------------------------------
// Mobile Drawer
// ----------------------------------------------------------------
function MobileDrawer({ isOpen, onClose }) {
  const location = useLocation()
  useEffect(() => { onClose() }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 150,
          background: 'rgba(26, 23, 20, 0.55)',
          backdropFilter: 'blur(3px)',
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 260ms ease, visibility 260ms ease',
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 200,
          width: 'min(300px, 82vw)',
          background: 'var(--color-paper)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drawer header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <PrahariLogo onClick={onClose} />
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            <Icons.Close />
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ id, label, path, exact, Icon }) => (
            <NavLink
              key={id}
              to={path}
              end={exact}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                marginBottom: '0.25rem',
                textDecoration: 'none',
                fontSize: '0.9375rem',
                fontWeight: isActive ? 600 : 500,
                fontFamily: 'var(--font-sans)',
                color: isActive ? 'var(--color-forest)' : 'var(--color-muted)',
                background: isActive ? 'var(--color-forest-subtle)' : 'transparent',
                transition: 'var(--transition-fast)',
              })}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Drawer footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-faint)', fontFamily: 'var(--font-mono)' }}>
            v0.1.0
          </span>
          <ThemeToggle />
        </div>
      </div>
    </>
  )
}

// ----------------------------------------------------------------
// Top Navigation Bar
// ----------------------------------------------------------------
function TopNav({ scrolled, onMenuClick, menuOpen }) {
  return (
    <header
      id="main-nav"
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--color-paper)',
        borderBottom: scrolled ? '1px solid var(--color-border)' : '1px solid transparent',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
        boxShadow: scrolled ? 'var(--shadow-xs)' : 'none',
      }}
    >
      <div className="container-prahari" style={{
        display: 'flex',
        alignItems: 'center',
        height: '62px',
        gap: '1.5rem',
      }}>
        {/* Logo */}
        <PrahariLogo />

        {/* Desktop nav links */}
        <nav
          aria-label="Main navigation"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '2rem',
            flex: 1,
          }}
          ref={el => {
            if (!el) return
            const mq = window.matchMedia('(min-width: 768px)')
            const update = e => { el.style.display = e.matches ? 'flex' : 'none' }
            update(mq)
            mq.addEventListener('change', update)
          }}
        >
          {NAV_ITEMS.map(({ id, label, path, exact }) => (
            <NavLink
              key={id}
              id={`nav-${id}`}
              to={path}
              end={exact}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <ThemeToggle />

          {/* Hamburger — mobile only */}
          <div ref={el => {
            if (!el) return
            const mq = window.matchMedia('(min-width: 768px)')
            const update = e => { el.style.display = e.matches ? 'none' : 'flex' }
            update(mq)
            mq.addEventListener('change', update)
          }}>
            <button
              id="nav-hamburger"
              onClick={onMenuClick}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '9px',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-muted)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              {menuOpen ? <Icons.Close /> : <Icons.Menu />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

// ----------------------------------------------------------------
// Mobile Bottom Tab Bar
// ----------------------------------------------------------------
function BottomTabs() {
  const location = useLocation()
  const tabItems = NAV_ITEMS.filter(i => i.id !== 'home')

  return (
    <nav
      role="navigation"
      aria-label="Mobile bottom navigation"
      id="mobile-bottom-nav"
      ref={el => {
        if (!el) return
        const mq = window.matchMedia('(min-width: 768px)')
        const update = e => { el.style.display = e.matches ? 'none' : 'flex' }
        update(mq)
        mq.addEventListener('change', update)
      }}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'var(--color-paper)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'stretch',
        height: '60px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -2px 12px rgba(26, 23, 20, 0.06)',
      }}
    >
      {tabItems.map(({ id, label, path, exact, Icon }) => {
        const isActive = location.pathname === path ||
          (!exact && location.pathname.startsWith(path))
        return (
          <NavLink
            key={id}
            to={path}
            end={exact}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.2rem',
              flex: 1,
              textDecoration: 'none',
              fontSize: '0.6rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: isActive ? 'var(--color-forest)' : 'var(--color-faint)',
              transition: 'var(--transition-fast)',
              padding: '0.25rem',
            }}
          >
            <span style={{
              transform: isActive ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 200ms ease',
            }}>
              <Icon />
            </span>
            <span>{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

// ----------------------------------------------------------------
// Footer
// ----------------------------------------------------------------
function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer
      role="contentinfo"
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-cream)',
        padding: 'clamp(2rem, 4vw, 3rem) 0',
        marginTop: 'clamp(3rem, 6vw, 5rem)',
      }}
    >
      <div className="container-prahari">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: '2rem',
          paddingBottom: '2rem',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--color-border)',
        }}>
          {/* Brand */}
          <div>
            <PrahariLogo />
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--color-muted)',
              marginTop: '0.875rem',
              maxWidth: '280px',
              lineHeight: 1.65,
            }}>
              Decoding medications, triaging symptoms, and connecting you to the right care — backed by clinically authoritative data.
            </p>
          </div>

          {/* Disclaimer */}
          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--color-muted)',
            lineHeight: 1.7,
          }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--color-ink)' }}>
              Medical Disclaimer:
            </p>
            <p style={{ margin: 0 }}>
              Prahari is an informational tool only and does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional.{' '}
              <strong style={{ color: 'var(--color-ink)' }}>Emergency: 112 (India) · 911 (USA) · 999 (UK)</strong>
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--color-faint)',
            fontFamily: 'var(--font-mono)',
          }}>
            © {year} Prahari · MedLens v0.1.0
          </span>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {['openFDA', 'RxNorm', 'Infermedica', 'Google Places'].map(src => (
              <span key={src} style={{
                fontSize: '0.75rem',
                color: 'var(--color-faint)',
                fontFamily: 'var(--font-sans)',
              }}>
                {src}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ----------------------------------------------------------------
// Main Export
// ----------------------------------------------------------------
export default function DashboardLayout({ children }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-paper)',
      color: 'var(--color-ink)',
    }}>
      <TopNav
        scrolled={scrolled}
        onMenuClick={() => setMenuOpen(o => !o)}
        menuOpen={menuOpen}
      />

      <MobileDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <main
        id="main-content"
        role="main"
        aria-label="Main content"
        className="mobile-safe-bottom"
        style={{ flex: 1 }}
      >
        <div
          className="container-prahari"
          style={{
            paddingTop: 'clamp(1.5rem, 4vw, 2.5rem)',
            paddingBottom: '2.5rem',
          }}
        >
          {children}
        </div>
      </main>

      <Footer />
      <BottomTabs />
    </div>
  )
}
