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
import { useAuth } from '../../hooks/useAuth.jsx'

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
  Mic: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  User: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
}

// ----------------------------------------------------------------
// Navigation Items
// ----------------------------------------------------------------
const NAV_ITEMS = [
  { id: 'home',        label: 'Home',        path: '/', exact: true, Icon: Icons.Home },
  { id: 'scanner',     label: 'Scanner',     path: '/scanner',     Icon: Icons.Scanner },
  { id: 'transcribe',  label: 'Transcriber', path: '/transcribe',  Icon: Icons.Mic },
  { id: 'medications', label: 'Medications', path: '/medications', Icon: Icons.Pill },
  { id: 'clinician',   label: 'AI Doctor',   path: '/clinician',   Icon: Icons.Heartbeat },
  { id: 'triage',      label: 'Triage',      path: '/triage',      Icon: Icons.Heartbeat },
  { id: 'directory',   label: 'Directory',   path: '/directory',   Icon: Icons.MapPin },
  { id: 'profile',     label: 'Sentinel',    path: '/profile',     Icon: Icons.User },
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
function MobileDrawer({ isOpen, onClose, user, logout }) {
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

        {/* User Profile Card for Mobile */}
        {user && (
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-cream)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-forest-subtle)',
              border: '1.5px solid var(--color-forest)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata.full_name || 'User Avatar'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Icons.User />
              )}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              lineHeight: 1.2,
            }}>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--color-ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.user_metadata?.full_name || 'User'}
              </span>
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--color-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.email}
              </span>
            </div>
            <button
              onClick={() => {
                logout()
                onClose()
              }}
              aria-label="Sign Out"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--color-muted)',
                cursor: 'pointer',
              }}
            >
              <Icons.LogOut />
            </button>
          </div>
        )}

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
function TopNav({ scrolled, onMenuClick, menuOpen, user, logout }) {
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ThemeToggle />

          {/* User Profile Info & Sign Out */}
          {user && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.25rem 0.5rem 0.25rem 0.75rem',
              borderRadius: '12px',
              backgroundColor: 'var(--color-cream)',
              border: '1px solid var(--color-border)',
              transition: 'all 0.2s ease',
            }}>
              {/* User info on desktop */}
              <div style={{
                display: 'none',
                flexDirection: 'column',
                alignItems: 'flex-start',
                lineHeight: '1.2',
              }} ref={el => {
                if (!el) return
                const mq = window.matchMedia('(min-width: 768px)')
                const update = e => { el.style.display = e.matches ? 'flex' : 'none' }
                update(mq)
                mq.addEventListener('change', update)
              }}>
                <span style={{
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  color: 'var(--color-ink)',
                }}>
                  {user.user_metadata?.full_name || 'User'}
                </span>
                <span style={{
                  fontSize: '0.6875rem',
                  color: 'var(--color-muted)',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user.email}
                </span>
              </div>

              {/* User Avatar */}
              <div style={{
                position: 'relative',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-forest-subtle)',
                border: '1.5px solid var(--color-forest)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}>
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata.full_name || 'User Avatar'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <Icons.User />
                )}
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                title="Sign Out"
                aria-label="Sign Out"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--color-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-muted)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icons.LogOut />
              </button>
            </div>
          )}

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
  const tabItems = NAV_ITEMS.filter(i => ['scanner', 'medications', 'clinician', 'triage', 'profile'].includes(i.id))

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
// ----------------------------------------------------------------
// Web Audio Alarm Synthesizer Setup
// ----------------------------------------------------------------
let audioCtx = null
let alarmInterval = null

const startAlarmSound = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioCtx = new AudioContextClass()
    
    let isBeep = true
    alarmInterval = setInterval(() => {
      if (!audioCtx) return
      if (isBeep) {
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(880, audioCtx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15)
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18)
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.2)
      }
      isBeep = !isBeep
    }, 250)
  } catch (err) {
    console.error('AudioContext alarm generation failed:', err)
  }
}

const stopAlarmSound = () => {
  if (alarmInterval) {
    clearInterval(alarmInterval)
    alarmInterval = null
  }
  if (audioCtx) {
    audioCtx.close()
    audioCtx = null
  }
}

export default function DashboardLayout({ children }) {
  const { user, token, logout } = useAuth()
  const encryptionSeed = user?.id || 'demo-fallback-seed'

  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Guardian Sentinel tracking states
  const [lastActivity, setLastActivity] = useState(Date.now())
  const [sensorAlert, setSensorAlert] = useState(false)
  const [alarmActive, setAlarmActive] = useState(false)
  const [alarmSeconds, setAlarmSeconds] = useState(60)
  const [alarmMed, setAlarmMed] = useState(null)
  const [accelPermissionDenied, setAccelPermissionDenied] = useState(false)
  const [cabinetItems, setCabinetItems] = useState([])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 1. Accelerometer motion & web user activity listeners
  useEffect(() => {
    const handleMotion = (e) => {
      const acc = e.accelerationIncludingGravity || e.acceleration
      if (acc) {
        const total = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z)
        // If movement force delta from gravity is substantial (> 0.8)
        if (Math.abs(total - 9.8) > 0.8) {
          setLastActivity(Date.now())
        }
      }
    }

    const handleInteraction = () => {
      setLastActivity(Date.now())
    }

    window.addEventListener('devicemotion', handleMotion)
    window.addEventListener('click', handleInteraction)
    window.addEventListener('scroll', handleInteraction)
    window.addEventListener('keypress', handleInteraction)

    // Request iOS motion permission if needed
    if (window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission === 'function') {
      window.DeviceMotionEvent.requestPermission()
        .then(permissionState => {
          if (permissionState !== 'granted') {
            setAccelPermissionDenied(true)
          }
        })
        .catch(() => {
          setAccelPermissionDenied(true)
        })
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion)
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('scroll', handleInteraction)
      window.removeEventListener('keypress', handleInteraction)
    }
  }, [])

  // 2. Fetch cabinet items on mount/token change and refresh every 30 seconds
  useEffect(() => {
    if (localStorage.getItem('prahari_sentinel_enabled') !== 'true') return
    if (!token) return

    const fetchCabinet = async () => {
      try {
        const res = await fetch('http://localhost:8000/medication/cabinet', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setCabinetItems(data)
        }
      } catch (err) {
        console.error("Failed to fetch cabinet items in DashboardLayout:", err)
      }
    }

    fetchCabinet()
    const interval = setInterval(fetchCabinet, 30000)
    return () => clearInterval(interval)
  }, [token])

  // 3. Background Reminder Checking Loop (Runs every 5 seconds against cached state)
  useEffect(() => {
    if (localStorage.getItem('prahari_sentinel_enabled') !== 'true') return

    const interval = setInterval(async () => {
      const now = new Date()
      const currentHrs = String(now.getHours()).padStart(2, '0')
      const currentMins = String(now.getMinutes()).padStart(2, '0')
      const currentTimeStr = `${currentHrs}:${currentMins}`
      
      const todayStr = now.toISOString().split('T')[0]
      const checkedOff = JSON.parse(localStorage.getItem('prahari_checked_off_meds') || '{}')
      const todayChecked = checkedOff[todayStr] || {}

      const isDemoMode = localStorage.getItem('prahari_sentinel_demo_mode') === 'true'
      const inactivityThreshold = isDemoMode ? 15 * 1000 : 2 * 60 * 60 * 1000 // 15s vs 2hrs

      for (const item of cabinetItems) {
        if (!item.reminder_time || !item.is_high_priority) continue
        if (todayChecked[item.id]) continue

        // Parse reminder time
        const [remH, remM] = item.reminder_time.split(':').map(Number)
        const remTime = new Date()
        remTime.setHours(remH, remM, 0, 0)

        const timeElapsed = Date.now() - remTime.getTime()
        const isPastReminder = timeElapsed >= 0
        const inactiveDuration = Date.now() - lastActivity

        // Trigger warning if medication is missed and phone has been static
        if (isPastReminder && inactiveDuration >= inactivityThreshold && !alarmActive) {
          setAlarmActive(true)
          setAlarmMed(item)
          setAlarmSeconds(60)
          startAlarmSound()

          // Try to trigger PWA native push notification
          if (Notification.permission === 'granted') {
            new Notification("🚨 Prahari Inactivity Watcher 🚨", {
              body: "No activity detected. Medication reminder missed.",
              icon: "/assets/icon-192.png"
            })
          }
          break
        }
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [cabinetItems, lastActivity, alarmActive])

  // 3. Countdown timer loop for active alarms
  useEffect(() => {
    let timer = null
    if (alarmActive && alarmSeconds > 0) {
      timer = setInterval(() => {
        setAlarmSeconds(s => s - 1)
      }, 1000)
    } else if (alarmActive && alarmSeconds === 0) {
      // Escalation trigger!
      handleEscalateAlert()
    }
    return () => clearInterval(timer)
  }, [alarmActive, alarmSeconds])

  const handleDismissAlarm = () => {
    stopAlarmSound()
    setAlarmActive(false)

    if (alarmMed) {
      const todayStr = new Date().toISOString().split('T')[0]
      const checkedOff = JSON.parse(localStorage.getItem('prahari_checked_off_meds') || '{}')
      if (!checkedOff[todayStr]) checkedOff[todayStr] = {}
      checkedOff[todayStr][alarmMed.id] = true
      localStorage.setItem('prahari_checked_off_meds', JSON.stringify(checkedOff))
    }
  }

  const handleEscalateAlert = async () => {
    stopAlarmSound()
    setAlarmActive(false)
    if (!alarmMed) return

    // Resolve brand name
    let decBrand = "Medication"
    try {
      const decText = await decryptText(alarmMed.brand_name, encryptionSeed)
      decBrand = decText || "Medication"
    } catch {}

    // Fetch decrypted caregivers to escalate to Twilio
    let decCgList = []
    try {
      const cgRes = await fetch('http://localhost:8000/clinician/caregivers', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (cgRes.ok) {
        const cgList = await cgRes.json()
        for (const cg of cgList) {
          const decName = await decryptText(cg.name, encryptionSeed)
          const decPhone = await decryptText(cg.phone, encryptionSeed)
          const decEmail = await decryptText(cg.email, encryptionSeed)
          decCgList.push({
            name: decName,
            phone: decPhone,
            email: decEmail
          })
        }
      }
    } catch (err) {
      console.error("Caregiver E2EE circle decryption failed:", err)
    }

    try {
      await fetch('http://localhost:8000/alerts/escalate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          missed_medication_name: decBrand,
          patient_name: user?.user_metadata?.full_name || "Demo Patient",
          patient_email: user?.email || "demo-patient@prahari.org",
          inactivity_duration_minutes: localStorage.getItem('prahari_sentinel_demo_mode') === 'true' ? 0.25 : 120,
          decrypted_caregiver_circle: decCgList
        })
      })
      alert("🚨 emergency Sentinel alert triggered! SMS/Push notifications sent to caregiver circle. 🚨")
    } catch (err) {
      console.error("Alert escalation dispatcher failed:", err)
    }
  }

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
        user={user}
        logout={logout}
      />

      <MobileDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} user={user} logout={logout} />

      {/* Accelerometer Sandbox Denied Warning Banner */}
      {localStorage.getItem('prahari_sentinel_enabled') === 'true' && accelPermissionDenied && (
        <div style={{
          backgroundColor: 'var(--color-alert-moderate-bg)',
          borderBottom: '1px solid var(--color-alert-moderate-border)',
          color: 'var(--color-alert-moderate)',
          padding: '0.5rem 1rem',
          fontSize: '0.8rem',
          textAlign: 'center',
          fontWeight: '600'
        }}>
          ⚠️ Accelerometer permissions disabled. Falling back to active browser click/scroll activity checking.
        </div>
      )}

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

      {/* Alarm Warning Fullscreen Overlay Modal */}
      {alarmActive && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(194, 75, 60, 0.95)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'var(--font-sans)',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <div style={{
            fontSize: '5rem',
            animation: 'pulse 1.2s infinite'
          }}>
            🚨
          </div>
          
          <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '1rem 0' }}>
            PRAHARI INACTIVITY ALARM
          </h2>
          
          <p style={{ fontSize: '1.1rem', maxWidth: '500px', lineHeight: '1.6', margin: '0 0 2rem 0' }}>
            Missed medication reminder detected with zero device motion. Caregivers will be notified in:
          </p>

          <div style={{
            fontSize: '4rem',
            fontWeight: '900',
            background: 'rgba(0,0,0,0.25)',
            padding: '1rem 2rem',
            borderRadius: '16px',
            marginBottom: '2.5rem',
            fontFamily: 'monospace'
          }}>
            {alarmSeconds}s
          </div>

          <button
            onClick={handleDismissAlarm}
            style={{
              backgroundColor: 'white',
              color: 'var(--color-alert-critical)',
              border: 'none',
              borderRadius: '12px',
              padding: '1rem 2.5rem',
              fontSize: '1.2rem',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
              transition: 'transform 0.1s'
            }}
          >
            ✅ I AM OKAY (DISMISS)
          </button>
        </div>
      )}

      <Footer />
      <BottomTabs />
    </div>
  )
}
