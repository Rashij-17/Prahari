import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DrugProfileCard from '../components/medication/DrugProfileCard.jsx'

describe('DrugProfileCard Component', () => {
  it('renders default profile data correctly', () => {
    const profile = {
      brand_name: "Test Drug",
      generic_name: "Test Generic",
      manufacturer: "Test Pharma",
      route: ["ORAL"],
      rxcui: ["99999"],
      ndc: ["11111-222"],
      indications: "For testing purposes.",
      dosage: "Take 1 test.",
      urgency_level: "moderate",
      has_boxed_warning: false
    }

    const onClose = vi.fn()

    render(<DrugProfileCard profile={profile} onClose={onClose} />)

    // Check titles and data
    expect(screen.getByText("Test Drug")).toBeInTheDocument()
    expect(screen.getByText("Test Generic")).toBeInTheDocument()
    expect(screen.getByText("Use Caution")).toBeInTheDocument() // Moderate badge
    expect(screen.getByText("99999")).toBeInTheDocument()

    // Test back button focus/blur/mouseenter/mouseleave and click
    const backBtn = screen.getByRole('button', { name: /Back to search/i })
    fireEvent.focus(backBtn)
    fireEvent.blur(backBtn)
    fireEvent.mouseEnter(backBtn)
    fireEvent.mouseLeave(backBtn)
    fireEvent.click(backBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('handles critical level and boxed warnings with long descriptions', () => {
    const longWarning = "A".repeat(600)
    const profile = {
      brand_name: "Warning Drug",
      generic_name: "Warn",
      urgency_level: "critical",
      has_boxed_warning: true,
      boxed_warning: longWarning,
      indications: "Brief indication.",
      description: "A".repeat(400) // triggers long description (>320)
    }

    render(<DrugProfileCard profile={profile} />)

    expect(screen.getByText("Black Box Warning")).toBeInTheDocument()
    
    // Exact match to prevent getMultipleElementsFoundError
    expect(screen.getByText("A".repeat(500) + "…")).toBeInTheDocument()
    expect(screen.getByText("A".repeat(320) + "…")).toBeInTheDocument()
  })

  it('renders nothing if no profile is provided', () => {
    const { container } = render(<DrugProfileCard profile={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('allows details element toggling', () => {
    const profile = {
      brand_name: "Toggle Drug",
      indications: "Indications text"
    }

    render(<DrugProfileCard profile={profile} />)

    const details = screen.getByText("Indications & Usage").closest('details')
    expect(details).toHaveAttribute('open')

    // Manually trigger toggle event
    fireEvent.click(screen.getByText("Indications & Usage"))
    fireEvent(details, new Event('toggle'))
  })

  it('renders generic alternative cost savings card', () => {
    const profile = {
      brand_name: "Brand Drug",
      generic_name: "Generic Drug",
      price: 100.0,
      pack_size_label: "strip of 10 tablets",
      generic_alternative: {
        generic_name: "Generic Substitute 100mg",
        price: 20.0,
        pack_size_label: "strip of 10 tablets",
        brand_unit_price: 10.0,
        generic_unit_price: 2.0,
        savings_percentage: 80.0
      }
    }

    render(<DrugProfileCard profile={profile} />)

    expect(screen.getByText("Government Jan Aushadhi generic alternative available!")).toBeInTheDocument()
    expect(screen.getByText("Generic Substitute 100mg")).toBeInTheDocument()
    expect(screen.getByText(/80% Cost-Saver/i)).toBeInTheDocument()
    expect(screen.getByText(/₹20.00/i)).toBeInTheDocument()
  })
})

