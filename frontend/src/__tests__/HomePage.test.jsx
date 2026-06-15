import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../pages/HomePage.jsx'

describe('HomePage Component Unit Tests', () => {
  it('renders landing page hero content and all featured sentinel services', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    // 1. Verify hero copy is rendered
    expect(screen.getByText(/Your Personal Health Guardian/i)).toBeInTheDocument()
    expect(screen.getByText(/clinically authoritative data/i)).toBeInTheDocument()

    // 2. Verify all features are rendered
    expect(screen.getByText('Visual Label Scanner')).toBeInTheDocument()
    expect(screen.getByText('Drug Intelligence')).toBeInTheDocument()
    expect(screen.getByText('Symptom Triage')).toBeInTheDocument()
    expect(screen.getByText('Doctor Directory')).toBeInTheDocument()

    // 3. Verify statistics section renders
    expect(screen.getByText('Preventable deaths/yr')).toBeInTheDocument()
    expect(screen.getByText('Patients affected')).toBeInTheDocument()
  })

  it('handles feature card mouse enter and leave events', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    // Select CTA for scanner
    const ctas = screen.getAllByText(/Open Scanner|Search Medications|Check Symptoms|Find Providers/i)
    expect(ctas.length).toBe(5)

    // Trigger hover events on the container div
    const firstCta = ctas[0].closest('div')
    fireEvent.mouseEnter(firstCta)
    fireEvent.mouseLeave(firstCta)

    // Hover over a trust badge
    const badge = screen.getByText('openFDA').closest('div')
    fireEvent.mouseEnter(badge)
    fireEvent.mouseLeave(badge)
  })
})
