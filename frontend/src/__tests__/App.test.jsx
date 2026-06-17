import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock the components imported by App.jsx to simplify routing test assertions
vi.mock('../pages/HomePage.jsx', () => ({
  default: () => <div>Mocked HomePage</div>
}))
vi.mock('../components/scanner/CameraScanner.jsx', () => ({
  default: () => <div>Mocked CameraScanner</div>
}))
vi.mock('../pages/MedicationsPage.jsx', () => ({
  default: () => <div>Mocked MedicationsPage</div>
}))
vi.mock('../pages/TriagePage.jsx', () => ({
  default: () => <div>Mocked TriagePage</div>
}))
vi.mock('../pages/DirectoryPage.jsx', () => ({
  default: () => <div>Mocked DirectoryPage</div>
}))

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

import App from '../App.jsx'

describe('App Router Integration Tests', () => {
  it('renders HomePage by default on root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('Mocked HomePage')).toBeInTheDocument()
  })

  it('renders CameraScanner component on /scanner path', () => {
    render(
      <MemoryRouter initialEntries={['/scanner']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('Mocked CameraScanner')).toBeInTheDocument()
  })

  it('renders MedicationsPage component on /medications path', () => {
    render(
      <MemoryRouter initialEntries={['/medications']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('Mocked MedicationsPage')).toBeInTheDocument()
  })

  it('renders TriagePage component on /triage path', () => {
    render(
      <MemoryRouter initialEntries={['/triage']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('Mocked TriagePage')).toBeInTheDocument()
  })

  it('renders DirectoryPage component on /directory path', () => {
    render(
      <MemoryRouter initialEntries={['/directory']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('Mocked DirectoryPage')).toBeInTheDocument()
  })

  it('redirects unknown path routes to HomePage', () => {
    render(
      <MemoryRouter initialEntries={['/unknown-route-path']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('Mocked HomePage')).toBeInTheDocument()
  })

  it('displays the offline banner when offline event triggers', async () => {
    vi.stubGlobal('navigator', {
      onLine: false
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // Trigger offline event manually
    window.dispatchEvent(new Event('offline'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Viewing cached offline data/i)).toBeInTheDocument()
    })

    // Now trigger online event
    window.dispatchEvent(new Event('online'))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })
})
