import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.unmock('../services/api.js')

import * as api from '../services/api.js'

describe('API Service Client Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('performs health check request successfully', async () => {
    const mockResponse = { status: "healthy" }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.checkHealth()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/health'), expect.any(Object))
    expect(result).toEqual(mockResponse)
  })

  it('submits captured frame to scan process endpoint', async () => {
    const mockResponse = { raw_text: "Aspirin" }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.processFrame("base64_data")
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/scan/process'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ image: "base64_data" })
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('queries medication profile endpoint by name', async () => {
    const mockResponse = { generic_name: "Aspirin" }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.getMedicationProfile("Aspirin")
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/medication/profile?name=Aspirin'), expect.any(Object))
    expect(result).toEqual(mockResponse)
  })

  it('queries medication search endpoint', async () => {
    const mockResponse = { results: [] }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.searchMedications("aspirin", 5)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/medication/search?q=aspirin&limit=5'), expect.any(Object))
    expect(result).toEqual(mockResponse)
  })

  it('submits symptom triage request', async () => {
    const payload = { symptoms: "cough", sex: "male", age: 30 }
    const mockResponse = { urgency_level: "safe" }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.assessSymptoms(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/triage/assess'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload)
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('submits provider search request', async () => {
    const payload = { lat: 12.9, lng: 77.5 }
    const mockResponse = { providers: [] }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.searchProviders(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/directory/search'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload)
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('handles error response status code failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: "Bad request error details" })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.checkHealth()).rejects.toThrow("Bad request error details")
  })
})
