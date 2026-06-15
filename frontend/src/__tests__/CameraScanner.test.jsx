import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../services/api.js', () => ({
  processFrame: vi.fn().mockResolvedValue({
    raw_text: "Acetaminophen 500mg",
    candidates: ["Acetaminophen"],
    word_count: 2,
    psm_used: 6,
    processing_note: "Success"
  })
}))

import CameraScanner from '../components/scanner/CameraScanner.jsx'


describe('CameraScanner Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the idle state and transitions to camera mode', async () => {
    // Mock successful navigator.mediaDevices.getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [
          {
            stop: vi.fn(),
            getSettings: () => ({ aspectRatio: 1.3333 })
          }
        ]
      })
    }

    render(
      <MemoryRouter>
        <CameraScanner />
      </MemoryRouter>
    )

    // 1. Verify header title is rendered
    expect(screen.getByText(/Visual label scanner/i)).toBeInTheDocument()
    
    // Find the start camera button
    const startBtn = screen.getByRole('button', { name: /start camera/i })
    expect(startBtn).toBeInTheDocument()

    // 2. Trigger camera start
    fireEvent.click(startBtn)

    // 3. Verify mediaDevices.getUserMedia was called
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()
  })

  it('allows file upload fallback when camera is denied or unavailable', async () => {
    // Mock navigator.mediaDevices.getUserMedia to THROW an error (camera denied/missing)
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied'))
    }

    render(
      <MemoryRouter>
        <CameraScanner />
      </MemoryRouter>
    )

    // Find the start camera button and click it to trigger fallback
    const startBtn = screen.getByRole('button', { name: /start camera/i })
    fireEvent.click(startBtn)

    // Verify it transitions to the FileUploadFallback view
    await waitFor(() => {
      expect(screen.getByText(/camera unavailable/i)).toBeInTheDocument()
    })

    // Find the file input using aria-label
    const fileInput = screen.getByLabelText(/upload medication label image/i)
    expect(fileInput).toBeInTheDocument()

    // Mock file upload
    const file = new File(['dummy content'], 'label.png', { type: 'image/png' })
    
    // Stub FileReader to immediately call onload when readAsDataURL is called
    // We return a valid 1x1 base64 transparent PNG to satisfy validation checks
    const validBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const readAsDataURLMock = vi.fn().mockImplementation(function() {
      if (this.onload) {
        this.onload({ target: { result: validBase64 } })
      }
    })
    
    vi.stubGlobal('FileReader', vi.fn().mockImplementation(() => ({
      readAsDataURL: readAsDataURLMock,
      onload: null
    })))

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Verify it eventually transitions to the results state and renders the drug candidate
    await waitFor(() => {
      const elements = screen.getAllByText(/Acetaminophen/i)
      expect(elements.length).toBeGreaterThan(0)
    })

    vi.unstubAllGlobals()
  })
})
