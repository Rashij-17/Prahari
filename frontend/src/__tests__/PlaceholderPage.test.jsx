import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlaceholderPage from '../pages/PlaceholderPage.jsx'

describe('PlaceholderPage Component Unit Tests', () => {
  it('renders placeholder titles and content properly', () => {
    render(
      <PlaceholderPage
        title="Custom Title"
        icon="💊"
        phase="Phase 9"
        description="Custom description goes here."
      />
    )

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(screen.getByText('💊')).toBeInTheDocument()
    expect(screen.getByText('Custom description goes here.')).toBeInTheDocument()
    expect(screen.getByText('Coming in Phase 9')).toBeInTheDocument()
  })
})
