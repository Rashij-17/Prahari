import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import * as api from '../services/api.js'

vi.mock('../services/api.js', () => ({
  searchMedications: vi.fn(),
  getMedicationProfile: vi.fn()
}))

import MedicationsPage from '../pages/MedicationsPage.jsx'

describe('MedicationsPage Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows searching for a drug and selecting a result to view its profile', async () => {
    vi.mocked(api.searchMedications).mockResolvedValueOnce({
      results: [
        {
          brand_name: "Tylenol",
          generic_name: "Acetaminophen",
          manufacturer: "McNeil",
          route: ["ORAL"],
          rxcui: ["161"],
          has_boxed_warning: false,
          urgency_level: "safe"
        }
      ]
    })

    vi.mocked(api.getMedicationProfile).mockResolvedValueOnce({
      brand_name: "Tylenol",
      generic_name: "Acetaminophen",
      manufacturer: "McNeil",
      product_type: "OTC",
      route: ["ORAL"],
      rxcui: ["161"],
      ndc: ["12345-678"],
      indications: "Temporary relief of minor aches and pains.",
      dosage: "Take 2 tablets every 6 hours.",
      warnings: "Liver warning: This product contains acetaminophen.",
      boxed_warning: "",
      contraindications: "Do not use with any other drug containing acetaminophen.",
      adverse_reactions: "Severe skin reactions may occur.",
      drug_interactions: "Do not take with other blood thinners.",
      precautions: "Ask a doctor before use if you have liver disease.",
      storage: "Store at room temperature.",
      description: "Acetaminophen is a pain reliever and fever reducer.",
      has_boxed_warning: false,
      urgency_level: "safe"
    })

    render(
      <MemoryRouter initialEntries={['/medications']}>
        <MedicationsPage />
      </MemoryRouter>
    )

    // Verify title is rendered
    expect(screen.getByText("Drug Intelligence")).toBeInTheDocument()

    // Find search input and type query
    const searchInput = screen.getByPlaceholderText(/Search by drug name, brand, or ingredient/i)
    fireEvent.change(searchInput, { target: { value: 'Tylenol' } })

    // Click search button
    const searchBtn = screen.getByRole('button', { name: /Search/i })
    fireEvent.click(searchBtn)

    // Verify result is rendered
    await waitFor(() => {
      expect(screen.getByText(/Acetaminophen/i)).toBeInTheDocument()
    })

    // Select the drug card to fetch details
    const selectBtn = screen.getByRole('button', { name: /Acetaminophen/i })
    fireEvent.click(selectBtn)

    // Verify details page renders correctly
    await waitFor(() => {
      expect(screen.getByText(/Temporary relief of minor aches and pains/i)).toBeInTheDocument()
      expect(screen.getByText(/McNeil/i)).toBeInTheDocument()
    })

    // Click back to search
    const backBtn = screen.getByRole('button', { name: /Back to search/i })
    fireEvent.click(backBtn)

    // Verify back to search results list
    expect(screen.getByText(/Acetaminophen/i)).toBeInTheDocument()
  })

  it('allows selecting a popular search pill button', async () => {
    vi.mocked(api.searchMedications).mockResolvedValueOnce({
      results: [
        {
          brand_name: "Glucophage",
          generic_name: "Metformin",
          manufacturer: "Merck",
          route: ["ORAL"],
          rxcui: ["6809"],
          has_boxed_warning: true,
          urgency_level: "critical"
        }
      ]
    })

    render(
      <MemoryRouter initialEntries={['/medications']}>
        <MedicationsPage />
      </MemoryRouter>
    )

    const popularPill = screen.getByRole('button', { name: "Metformin" })
    fireEvent.click(popularPill)

    await waitFor(() => {
      expect(screen.getAllByText(/Metformin/i)[0]).toBeInTheDocument()
      expect(screen.getByText(/BLACK BOX/i)).toBeInTheDocument()
    })
  })

  it('handles search query errors and allows retry', async () => {
    vi.mocked(api.searchMedications).mockRejectedValueOnce(new Error("Database offline error"))

    render(
      <MemoryRouter initialEntries={['/medications']}>
        <MedicationsPage />
      </MemoryRouter>
    )

    const searchInput = screen.getByPlaceholderText(/Search by drug name, brand, or ingredient/i)
    fireEvent.change(searchInput, { target: { value: 'Aspirin' } })

    const searchBtn = screen.getByRole('button', { name: /Search/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByText(/Database offline error/i)).toBeInTheDocument()
    })

    // Click retry
    vi.mocked(api.searchMedications).mockResolvedValueOnce({ results: [] })
    const retryBtn = screen.getByRole('button', { name: /Retry/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText(/No results found/i)).toBeInTheDocument()
    })
  })

  it('handles search query errors and allows clear search', async () => {
    vi.mocked(api.searchMedications).mockRejectedValueOnce(new Error("Database offline error"))

    render(
      <MemoryRouter initialEntries={['/medications']}>
        <MedicationsPage />
      </MemoryRouter>
    )

    const searchInput = screen.getByPlaceholderText(/Search by drug name, brand, or ingredient/i)
    fireEvent.change(searchInput, { target: { value: 'Aspirin' } })

    const searchBtn = screen.getByRole('button', { name: /Search/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByText(/Database offline error/i)).toBeInTheDocument()
    })

    // Click clear search (visible on error card)
    const clearBtn = screen.getByRole('button', { name: /Clear Search/i })
    fireEvent.click(clearBtn)

    // Verification
    expect(screen.queryByText(/Database offline error/i)).not.toBeInTheDocument()
    expect(searchInput.value).toBe('')
  })

  it('loads profile search query from URL params on mount', async () => {
    vi.mocked(api.searchMedications).mockResolvedValueOnce({
      results: [
        { brand_name: "Metformin", generic_name: "Metformin" }
      ]
    })

    render(
      <MemoryRouter initialEntries={['/medications?search=Metformin']}>
        <MedicationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/Metformin/i)[0]).toBeInTheDocument()
    })
  })

  it('handles drug profile load error (404 and generic)', async () => {
    vi.mocked(api.searchMedications).mockResolvedValueOnce({
      results: [
        { brand_name: "UnknownDrug", generic_name: "Unknown" }
      ]
    })
    vi.mocked(api.getMedicationProfile).mockRejectedValueOnce(new Error("Request failed with status code 404"))

    render(
      <MemoryRouter initialEntries={['/medications']}>
        <MedicationsPage />
      </MemoryRouter>
    )

    // Search for Unknown
    const searchInput = screen.getByPlaceholderText(/Search by drug name, brand, or ingredient/i)
    fireEvent.change(searchInput, { target: { value: 'Unknown' } })
    const searchBtn = screen.getByRole('button', { name: /Search/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unknown/i })).toBeInTheDocument()
    })

    // Click the result to load profile
    const selectBtn = screen.getByRole('button', { name: /Unknown/i })
    fireEvent.click(selectBtn)

    await waitFor(() => {
      expect(screen.getByText(/No clinical data found for "Unknown"/i)).toBeInTheDocument()
    })
  })
})
