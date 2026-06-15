import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../services/api.js', () => ({
  searchProviders: vi.fn().mockResolvedValue({
    providers: [
      {
        name: "Test General Hospital",
        address: "100 Medical Lane",
        rating: 4.7,
        total_ratings: 120,
        types: ["hospital", "health"],
        open_now: true,
        place_id: "test_place_001",
        phone: "+91 99999 88888",
        maps_url: "https://maps.google.com/?cid=123",
        distance_km: 1.5,
        is_mock: false
      }
    ],
    total: 1,
    radius_km: 5,
    is_mock: false,
    mock_notice: ""
  })
}))

import DirectoryPage from '../pages/DirectoryPage.jsx'

describe('DirectoryPage Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows searching for local provider facilities using geolocation', async () => {
    // Stub Geolocation API
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 12.9716,
            longitude: 77.5946
          }
        })
      })
    }
    vi.stubGlobal('navigator', {
      geolocation: mockGeolocation
    })

    render(
      <MemoryRouter>
        <DirectoryPage />
      </MemoryRouter>
    )

    // 1. Verify header is rendered
    expect(screen.getByText(/Provider Directory/i)).toBeInTheDocument()

    // 2. Select specialty
    const specialtyInput = screen.getByLabelText(/Specialty/i)
    fireEvent.change(specialtyInput, { target: { value: 'hospital' } })

    // 3. Find and click Locate & Search button
    const searchBtn = screen.getByRole('button', { name: /Use My Location & Search/i })
    fireEvent.click(searchBtn)

    // 4. Verify geolocation was queried
    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled()

    // 5. Verify results render on successful API response
    await waitFor(() => {
      expect(screen.getByText(/Test General Hospital/i)).toBeInTheDocument()
      expect(screen.getByText(/100 Medical Lane/i)).toBeInTheDocument()
      expect(screen.getByText(/Open now/i)).toBeInTheDocument()
      expect(screen.getByText(/1.5/i)).toBeInTheDocument() // distance badge
    })

    // 6. Reset search
    const resetBtn = screen.getByRole('button', { name: /New Search/i })
    fireEvent.click(resetBtn)

    // 7. Verify back to initial idle view
    expect(screen.getByRole('button', { name: /Use My Location & Search/i })).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('handles geolocation permission denied error', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success, error) => {
        error({ code: 1, message: "User denied Geolocation" })
      })
    }
    vi.stubGlobal('navigator', { geolocation: mockGeolocation })

    render(
      <MemoryRouter>
        <DirectoryPage />
      </MemoryRouter>
    )

    const searchBtn = screen.getByRole('button', { name: /Use My Location & Search/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByText(/Location access was denied/i)).toBeInTheDocument()
    })

    const retryBtn = screen.getByRole('button', { name: /Try Again/i })
    expect(retryBtn).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('handles general geolocation positioning errors', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success, error) => {
        error({ code: 2, message: "Position unavailable" })
      })
    }
    vi.stubGlobal('navigator', { geolocation: mockGeolocation })

    render(
      <MemoryRouter>
        <DirectoryPage />
      </MemoryRouter>
    )

    const searchBtn = screen.getByRole('button', { name: /Use My Location & Search/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByText(/Could not determine your location/i)).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('handles browser not supporting geolocation', async () => {
    vi.stubGlobal('navigator', {}) // geolocation is undefined

    render(
      <MemoryRouter>
        <DirectoryPage />
      </MemoryRouter>
    )

    const searchBtn = screen.getByRole('button', { name: /Use My Location & Search/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByText(/Geolocation is not supported by your browser/i)).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('renders provider card variants correctly (phone missing, rating 0, closed)', async () => {
    const api = await import('../services/api.js')
    vi.mocked(api.searchProviders).mockResolvedValueOnce({
      providers: [
        {
          name: "Mock Clinic",
          address: "200 Health Way",
          rating: 0,
          total_ratings: 0,
          types: ["point_of_interest", "establishment"],
          open_now: false,
          place_id: "test_place_002",
          phone: null,
          maps_url: "https://maps.google.com/?cid=456",
          distance_km: 3.2,
          is_mock: true
        },
        {
          name: "Unknown Hours Clinic",
          address: "300 Health Way",
          rating: 3.2,
          total_ratings: 5,
          types: ["health"],
          open_now: null, // Hours unknown
          place_id: "test_place_003",
          phone: "12345",
          maps_url: "https://maps.google.com/?cid=789",
          distance_km: 4.1,
          is_mock: true
        }
      ],
      total: 2,
      radius_km: 5,
      is_mock: true,
      mock_notice: "Mock search data"
    })

    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({ coords: { latitude: 12.9716, longitude: 77.5946 } })
      })
    }
    vi.stubGlobal('navigator', { geolocation: mockGeolocation })

    render(
      <MemoryRouter>
        <DirectoryPage />
      </MemoryRouter>
    )

    const searchBtn = screen.getByRole('button', { name: /Use My Location & Search/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByText(/Mock Clinic/i)).toBeInTheDocument()
      expect(screen.getByText(/Closed/i)).toBeInTheDocument()
      expect(screen.getByText(/Hours unknown/i)).toBeInTheDocument()
      expect(screen.getByText(/Mock search data/i)).toBeInTheDocument()
    })

    // Hover provider card link to test onMouseEnter and onMouseLeave
    const link = screen.getByRole('link', { name: /Mock Clinic/i })
    fireEvent.mouseEnter(link)
    fireEvent.mouseLeave(link)
    fireEvent.focus(link)
    fireEvent.blur(link)

    vi.unstubAllGlobals()
  })

  it('displays zero results message when no providers are returned', async () => {
    const api = await import('../services/api.js')
    vi.mocked(api.searchProviders).mockResolvedValueOnce({
      providers: [],
      total: 0,
      radius_km: 5
    })

    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({ coords: { latitude: 12.9716, longitude: 77.5946 } })
      })
    }
    vi.stubGlobal('navigator', { geolocation: mockGeolocation })

    render(
      <MemoryRouter>
        <DirectoryPage />
      </MemoryRouter>
    )

    const searchBtn = screen.getByRole('button', { name: /Use My Location & Search/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByText(/No providers found within 5 km/i)).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('handles backend search provider API failure', async () => {
    const api = await import('../services/api.js')
    vi.mocked(api.searchProviders).mockRejectedValueOnce(new Error("API Connection Timeout"))

    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({ coords: { latitude: 12.9716, longitude: 77.5946 } })
      })
    }
    vi.stubGlobal('navigator', { geolocation: mockGeolocation })

    render(
      <MemoryRouter>
        <DirectoryPage />
      </MemoryRouter>
    )

    const searchBtn = screen.getByRole('button', { name: /Use My Location & Search/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByText(/API Connection Timeout/i)).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })
})
