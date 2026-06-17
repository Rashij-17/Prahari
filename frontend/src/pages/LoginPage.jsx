import React from 'react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { loginWithGoogle, isDemo } = useAuth()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-cream)',
      fontFamily: 'var(--font-sans)',
      padding: '2rem',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'var(--color-paper)',
        borderRadius: '24px',
        padding: '3rem 2.5rem',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        {/* Shield Icon / Logo */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: 'var(--color-forest)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          boxShadow: '0 8px 16px rgba(44, 76, 56, 0.2)',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12h6M12 9v6"/>
          </svg>
        </div>

        {/* Title & Subtitle */}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2.25rem',
          color: 'var(--color-ink)',
          margin: '0 0 0.5rem 0',
          fontWeight: 400,
          letterSpacing: '-0.02em',
        }}>
          Prahari
        </h1>
        <p style={{
          fontSize: '1rem',
          color: 'var(--color-forest)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: '0 0 1.5rem 0',
        }}>
          Health Sentinel
        </p>

        <p style={{
          fontSize: '0.95rem',
          color: 'var(--color-muted)',
          lineHeight: '1.6',
          marginBottom: '2rem',
        }}>
          Your intelligent clinical companion. Sign in to access the transcription, medication analysis, and patient management portal.
        </p>

        {isDemo && (
          <div style={{
            backgroundColor: 'var(--color-forest-subtle)',
            color: 'var(--color-forest)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            fontWeight: '500',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            textAlign: 'left',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>Demo Mode Active:</strong> Clicking below will log you in instantly with a mock account.
            </span>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          onClick={loginWithGoogle}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            backgroundColor: 'var(--color-ink)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '0.875rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1a1a1a';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-ink)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          {/* Google Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Footer info */}
        <div style={{
          marginTop: '3rem',
          fontSize: '0.75rem',
          color: 'var(--color-faint)',
          lineHeight: '1.5',
        }}>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            HIPAA-compliant data encryption and secure OAuth 2.0 authentication.
          </p>
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
            Prahari v0.1.0 · Protected Connection
          </p>
        </div>
      </div>
    </div>
  )
}
