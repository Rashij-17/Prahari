/**
 * ThemeToggle Component
 * =====================
 * Toggles between light and dark mode by adding/removing the
 * 'dark' class on the <html> element, which is the trigger for
 * Tailwind's darkMode: 'class' strategy.
 *
 * The selected theme is persisted to localStorage so it survives
 * page refreshes. On first visit, the user's OS preference is
 * respected via `prefers-color-scheme`.
 *
 * Visual: An animated toggle button showing a Sun or Moon icon.
 */

import { useState, useEffect } from 'react'

// --- SVG Icon Components ---
// Inlined as minimal SVGs to avoid an icon-library dependency at this phase.

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// --- Theme Initialisation (runs outside React to prevent flash) ---
// We apply the class synchronously during the module load phase so the
// browser never renders the wrong theme even for a single frame.

function getInitialTheme() {
  // 1. Check localStorage for saved preference
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('prahari-theme')
    if (saved) return saved

    // 2. Fall back to OS preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  }
  return 'light'
}

function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// ----------------------------------------------------------------

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    const initial = getInitialTheme()
    applyTheme(initial)
    return initial
  })

  // Sync <html> class and localStorage whenever theme state changes
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('prahari-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  const isDark = theme === 'dark'

  return (
    <button
      id="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        /*
         * We use inline styles here for the toggle "pill" shape since it requires
         * specific pixel values that don't map cleanly to Tailwind utility classes
         * for this animated design.
         */
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '2.25rem',
        height: '2.25rem',
        borderRadius: '8px',
        border: '1.5px solid var(--color-border)',
        backgroundColor: isDark ? 'var(--color-beige)' : 'transparent',
        color: isDark ? 'var(--color-teal-light)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'all 150ms ease-in-out',
        flexShrink: 0,
      }}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
