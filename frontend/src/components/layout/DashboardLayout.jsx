/**
 * DashboardLayout — v2.0 (Enhanced Responsive)
 * =============================================
 * Fully responsive shell with:
 *   - Desktop: sticky top nav with glassmorphism
 *   - Tablet/Mobile: hamburger menu + slide drawer
 *   - Mobile: fixed bottom tab bar with badge-ready icons
 *   - Improved footer
 */

import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from '../ui/ThemeToggle.jsx'

// ----------------------------------------------------------------
// Navigation Items
// ----------------------------------------------------------------

const NAV_ITEMS = [
  {
    id:    'nav-home',
    label: 'Home',
    path:  '/',
    exact: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id:    'nav-scanner',
    label: 'Scanner',
    path:  '/scanner',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    ),
  },
  {
    id:    'nav-medications',
    label: 'Medications',
    path:  '/medications',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/>
        <circle cx="18" cy="18" r="3"/>
        <path d="m15.5 15.5 5 5"/>
      </svg>
    ),
  },
  {
    id:    'nav-triage',
    label: 'Triage',
    path:  '/triage',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id:    'nav-directory',
    label: 'Directory',
    path:  '/directory',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
]

// ----------------------------------------------------------------
// Prahari Logo
// ----------------------------------------------------------------

function PrahariLogo({ onClick }) {
  return (
    <NavLink
      to="/"
      id="nav-logo"
      aria-label="Prahari — home"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', flexShrink: 0 }}
    >
      <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0D9488"/>
            <stop offset="100%" stopColor="#6366F1"/>
          </linearGradient>
        </defs>
        <path d="M16 2L4 7v9c0 6.627 5.373 12 12 12s12-5.373 12-12V7L16 2z"
          fill="url(#shield-grad)" fillOpacity="0.2"
          stroke="url(#shield-grad)" strokeWidth="1.5"/>
        <rect x="14" y="9" width="4" height="14" rx="1.5" fill="#0D9488"/>
        <rect x="9" y="14" width="14" height="4" rx="1.5" fill="#0D9488"/>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize:   '1.3rem',
          color:      'var(--color-text-primary)',
          letterSpacing: '-0.02em',
        }}>
          Prahari
        </span>
        <span style={{
          fontSize:      '0.55rem',
          fontWeight:    700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:         'var(--color-teal)',
        }}>
          Health Sentinel
        </span>
      </div>
    </NavLink>
  )
}

// ----------------------------------------------------------------
// Hamburger Button
// ----------------------------------------------------------------
function HamburgerButton({ isOpen, onClick }) {
  return (
    <button
      id="nav-hamburger"
      onClick={onClick}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
      style={{
        display:         'flex',
        flexDirection:   'column',
        justifyContent:  'center',
        alignItems:      'center',
        gap:             '5px',
        width:           '40px',
        height:          '40px',
        borderRadius:    '10px',
        border:          '1.5px solid var(--color-border)',
        background:      'transparent',
        cursor:          'pointer',
        padding:         '8px',
        transition:      'var(--transition-standard)',
      }}
    >
      <span style={{
        display:     'block',
        width:       '18px',
        height:      '2px',
        background:  'var(--color-text-primary)',
        borderRadius:'2px',
        transition:  'var(--transition-standard)',
        transform:   isOpen ? 'translateY(7px) rotate(45deg)' : 'none',
      }}/>
      <span style={{
        display:     'block',
        width:       '18px',
        height:      '2px',
        background:  'var(--color-text-primary)',
        borderRadius:'2px',
        transition:  'var(--transition-standard)',
        opacity:     isOpen ? 0 : 1,
        transform:   isOpen ? 'scaleX(0)' : 'scaleX(1)',
      }}/>
      <span style={{
        display:     'block',
        width:       '18px',
        height:      '2px',
        background:  'var(--color-text-primary)',
        borderRadius:'2px',
        transition:  'var(--transition-standard)',
        transform:   isOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
      }}/>
    </button>
  )
}

// ----------------------------------------------------------------
// Mobile Drawer
// ----------------------------------------------------------------
function MobileDrawer({ isOpen, onClose }) {
  const location = useLocation()

  // Close on route change
  useEffect(() => { onClose() }, [location.pathname])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     150,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          opacity:    isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 250ms ease, visibility 250ms ease',
        }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        style={{
          position:   'fixed',
          top:        0,
          right:      0,
          bottom:     0,
          zIndex:     200,
          width:      'min(320px, 85vw)',
          background: 'var(--color-surface-card)',
          boxShadow:  'var(--shadow-xl)',
          transform:  isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          display:    'flex',
          flexDirection: 'column',
          overflowY:  'auto',
        }}
      >
        {/* Drawer header */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          justifyContent:'space-between',
          padding:      '1.25rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <PrahariLogo onClick={onClose} />
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width:        '36px',
              height:       '36px',
              borderRadius: '8px',
              border:       '1px solid var(--color-border)',
              background:   'transparent',
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              justifyContent:'center',
              fontSize:     '1.25rem',
              color:        'var(--color-text-secondary)',
            }}
          >×</button>
        </div>

        {/* Drawer nav items */}
        <nav style={{ padding: '1rem', flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.id}
              id={item.id + '-mobile'}
              to={item.path}
              end={item.exact}
              style={({ isActive }) => ({
                display:       'flex',
                alignItems:    'center',
                gap:           '0.875rem',
                padding:       '0.875rem 1rem',
                borderRadius:  '12px',
                marginBottom:  '0.25rem',
                textDecoration:'none',
                fontSize:      '0.9375rem',
                fontWeight:    isActive ? 700 : 500,
                color:         isActive ? 'var(--color-teal)' : 'var(--color-text-primary)',
                background:    isActive ? 'var(--color-teal-subtle)' : 'transparent',
                transition:    'var(--transition-fast)',
              })}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Drawer footer */}
        <div style={{
          padding:    '1rem 1.5rem',
          borderTop:  '1px solid var(--color-border)',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            MedLens v0.1.0
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

function TopNav({ scrolled, onHamburgerClick, drawerOpen }) {
  return (
    <header
      id="main-nav"
      role="banner"
      style={{
        position:        'sticky',
        top:             0,
        zIndex:          100,
        backgroundColor: scrolled
          ? 'rgba(240, 244, 248, 0.88)'
          : 'var(--color-surface)',
        backdropFilter:        scrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter:  scrolled ? 'blur(16px)' : 'none',
        borderBottom:    `1px solid ${scrolled ? 'var(--color-border)' : 'transparent'}`,
        transition:      'all 250ms ease',
        boxShadow:       scrolled ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <div className="container-prahari" style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        height:         '64px',
        gap:            '1rem',
      }}>
        {/* Logo */}
        <PrahariLogo />

        {/* Desktop Nav Links */}
        <nav
          role="navigation"
          aria-label="Main navigation"
          className="hidden md:flex"
          style={{ display: 'none', alignItems: 'center', gap: '0.125rem', flex: 1, justifyContent: 'center' }}
          ref={el => {
            if (!el) return
            const mq = window.matchMedia('(min-width: 768px)')
            const update = (e) => { el.style.display = e.matches ? 'flex' : 'none' }
            update(mq)
            mq.addEventListener('change', update)
          }}
        >
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.id}
              id={item.id}
              to={item.path}
              end={item.exact}
              style={({ isActive }) => ({
                display:        'inline-flex',
                alignItems:     'center',
                gap:            '0.375rem',
                padding:        '0.45rem 0.75rem',
                borderRadius:   '8px',
                fontSize:       '0.875rem',
                fontWeight:     isActive ? 700 : 500,
                textDecoration: 'none',
                transition:     'var(--transition-fast)',
                color:          isActive ? 'var(--color-teal)' : 'var(--color-text-secondary)',
                backgroundColor:isActive ? 'var(--color-teal-subtle)' : 'transparent',
                whiteSpace:     'nowrap',
              })}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: Theme toggle + Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ThemeToggle />
          {/* Hamburger — visible below md */}
          <div
            ref={el => {
              if (!el) return
              const mq = window.matchMedia('(min-width: 768px)')
              const update = (e) => { el.style.display = e.matches ? 'none' : 'block' }
              update(mq)
              mq.addEventListener('change', update)
            }}
          >
            <HamburgerButton isOpen={drawerOpen} onClick={onHamburgerClick} />
          </div>
        </div>
      </div>
    </header>
  )
}

// ----------------------------------------------------------------
// Mobile Bottom Tab Bar
// ----------------------------------------------------------------

function MobileBottomNav() {
  const location = useLocation()

  // Only show 4 core items on bottom bar (no Home — accessible via logo)
  const tabItems = NAV_ITEMS.filter(i => i.id !== 'nav-home')

  return (
    <nav
      role="navigation"
      aria-label="Mobile bottom navigation"
      id="mobile-bottom-nav"
      style={{
        position:        'fixed',
        bottom:          0,
        left:            0,
        right:           0,
        zIndex:          100,
        backgroundColor: 'var(--color-surface-card)',
        borderTop:       '1px solid var(--color-border)',
        display:         'flex',
        justifyContent:  'space-around',
        alignItems:      'stretch',
        height:          '60px',
        paddingBottom:   'env(safe-area-inset-bottom, 0px)',
        boxShadow:       '0 -4px 16px rgba(15,23,42,0.08)',
      }}
      // Only show on mobile; use JS because Tailwind classes may conflict with inline styles
      ref={el => {
        if (!el) return
        const mq = window.matchMedia('(min-width: 768px)')
        const update = (e) => { el.style.display = e.matches ? 'none' : 'flex' }
        update(mq)
        mq.addEventListener('change', update)
      }}
    >
      {tabItems.map(item => {
        const isActive = location.pathname === item.path ||
          (!item.exact && location.pathname.startsWith(item.path))
        return (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.exact}
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '0.2rem',
              flex:           1,
              textDecoration: 'none',
              fontSize:       '0.6rem',
              fontWeight:     600,
              letterSpacing:  '0.04em',
              textTransform:  'uppercase',
              color:          isActive ? 'var(--color-teal)' : 'var(--color-text-muted)',
              transition:     'var(--transition-fast)',
              padding:        '0.25rem',
              position:       'relative',
            }}
          >
            {/* Active indicator dot */}
            {isActive && (
              <span style={{
                position:     'absolute',
                top:          '6px',
                width:        '4px',
                height:       '4px',
                borderRadius: '50%',
                background:   'var(--color-teal)',
              }}/>
            )}
            <span style={{ transform: isActive ? 'scale(1.15)' : 'scale(1)', transition: 'transform 200ms ease' }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
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
  const dataSources = ['openFDA', 'RxNorm', 'Infermedica', 'Google Places']
  const year = new Date().getFullYear()

  return (
    <footer
      role="contentinfo"
      style={{
        borderTop:       '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        padding:         'clamp(1.5rem, 4vw, 2.5rem) 0',
        marginTop:       'clamp(2rem, 6vw, 4rem)',
      }}
    >
      <div className="container-prahari">
        {/* Top row */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap:                 '1.5rem',
          marginBottom:        '1.5rem',
          paddingBottom:       '1.5rem',
          borderBottom:        '1px solid var(--color-border)',
        }}>
          {/* Brand */}
          <div>
            <PrahariLogo />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', marginTop: '0.75rem', maxWidth: '260px', lineHeight: 1.6 }}>
              Your personal health guardian — decoding medications, triaging symptoms, finding care.
            </p>
          </div>

          {/* Disclaimer */}
          <div>
            <p style={{
              fontSize:   '0.775rem',
              lineHeight: '1.65',
              color:      'var(--color-text-secondary)',
              margin:     0,
            }}>
              <strong style={{ color: 'var(--color-text-primary)' }}>⚕️ Medical Disclaimer: </strong>
              Prahari is an informational tool only and does not constitute medical advice, diagnosis,
              or treatment. Always consult a qualified healthcare professional before making any decision.{' '}
              <strong>In an emergency: call 112 (India) · 911 (USA) · 999 (UK).</strong>
            </p>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexWrap:       'wrap',
          gap:            '0.75rem',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            © {year} Prahari · MedLens v0.1.0 · MIT License
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {dataSources.map(src => (
              <span key={src} className="chip chip-info" style={{ fontSize: '0.62rem' }}>
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
// DashboardLayout — Main Export
// ----------------------------------------------------------------

export default function DashboardLayout({ children }) {
  const [scrolled,    setScrolled]    = useState(false)
  const [drawerOpen,  setDrawerOpen]  = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div style={{
      minHeight:       '100dvh',
      display:         'flex',
      flexDirection:   'column',
      backgroundColor: 'var(--color-surface)',
      color:           'var(--color-text-primary)',
      transition:      'background-color 250ms ease',
    }}>
      {/* Sticky top nav */}
      <TopNav
        scrolled={scrolled}
        onHamburgerClick={() => setDrawerOpen(o => !o)}
        drawerOpen={drawerOpen}
      />

      {/* Mobile slide drawer */}
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Main content */}
      <main
        id="main-content"
        role="main"
        aria-label="Main content"
        className="mobile-safe-bottom"
        style={{ flex: 1 }}
      >
        <div className="container-prahari" style={{ paddingTop: 'clamp(1.25rem, 4vw, 2rem)', paddingBottom: '2rem' }}>
          {children}
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile bottom tab bar */}
      <MobileBottomNav />
    </div>
  )
}
