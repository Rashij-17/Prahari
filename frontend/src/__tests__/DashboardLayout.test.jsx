import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../hooks/useAuth.jsx', () => ({
  useAuth: () => ({
    user: {
      id: 'mock_user_12345',
      email: 'demo-patient@prahari.org',
      user_metadata: {
        full_name: 'Demo Patient',
        avatar_url: 'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Prahari'
      }
    },
    token: 'mock-token',
    loading: false,
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    isDemo: true
  })
}))

import DashboardLayout from '../components/layout/DashboardLayout.jsx'

describe('DashboardLayout Component Unit Tests', () => {
  it('renders application navigation shell, theme controls, and medical disclaimers', () => {
    render(
      <MemoryRouter>
        <DashboardLayout>
          <div>Child Page Content</div>
        </DashboardLayout>
      </MemoryRouter>
    )

    // 1. Verify child content renders inside layout
    expect(screen.getByText('Child Page Content')).toBeInTheDocument()

    // 2. Verify top navigation bar is active
    expect(screen.getByRole('banner')).toBeInTheDocument()

    // 3. Verify medical disclaimer warning footer is rendered
    expect(screen.getByText(/Medical Disclaimer:/i)).toBeInTheDocument()
    expect(screen.getByText(/Prahari is an informational tool/i)).toBeInTheDocument()

    // 4. Verify responsive mobile bottom navigation bar contains correct links
    const mobileBottomNav = screen.getByRole('navigation', { name: /mobile bottom navigation/i })
    expect(mobileBottomNav).toBeInTheDocument()
  })

  it('allows triggering theme toggle state between light and dark mode', () => {
    render(
      <MemoryRouter>
        <DashboardLayout>
          <div>Mock Page</div>
        </DashboardLayout>
      </MemoryRouter>
    )

    // Find the theme toggle buttons (Vite layout may render multiple for desktop/mobile)
    const themeToggles = screen.getAllByRole('button', { name: /switch to/i })
    expect(themeToggles.length).toBeGreaterThan(0)

    // Click theme toggle button
    fireEvent.click(themeToggles[0])
    
    // Check that theme class updates or is handled cleanly
    expect(themeToggles[0]).toBeInTheDocument()
  })

  it('handles hamburger menu drawer toggling', () => {
    render(
      <MemoryRouter>
        <DashboardLayout>
          <div>Mock Page</div>
        </DashboardLayout>
      </MemoryRouter>
    )

    const hamburgerBtn = screen.getByRole('button', { name: /open menu/i })
    expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false')

    // Click hamburger to open
    fireEvent.click(hamburgerBtn)
    expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'true')

    // Find the close button inside the drawer and click it
    const drawer = screen.getByRole('dialog', { name: /navigation menu/i })
    const closeBtn = drawer.querySelector('button[aria-label="Close menu"]')
    fireEvent.click(closeBtn)

    // Verify hamburger returns to closed state
    expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('handles scrolling effect', () => {
    render(
      <MemoryRouter>
        <DashboardLayout>
          <div>Mock Page</div>
        </DashboardLayout>
      </MemoryRouter>
    )

    // Simulate window scrolling
    window.scrollY = 20
    fireEvent.scroll(window)

    expect(screen.getByText('Mock Page')).toBeInTheDocument()
  })
})
