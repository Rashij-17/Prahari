/**
 * useTheme Hook
 * =============
 * A convenience hook that returns the current theme and a toggle function.
 * Components that need to be theme-aware (e.g., conditional styling)
 * can consume this hook instead of reading localStorage directly.
 *
 * Usage:
 *   const { theme, isDark, toggleTheme } = useTheme()
 */

import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('prahari-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('prahari-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return { theme, isDark: theme === 'dark', toggleTheme }
}
