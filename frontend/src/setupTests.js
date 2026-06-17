import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock HTMLMediaElement.prototype.play since jsdom does not implement it
window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue()
window.HTMLMediaElement.prototype.pause = vi.fn()
window.HTMLMediaElement.prototype.load = vi.fn()

// Mock the API client globally to avoid relative path resolution issues
vi.mock('./services/api.js', () => ({
  processFrame: vi.fn().mockResolvedValue({
    raw_text: "Acetaminophen 500mg",
    candidates: ["Acetaminophen"],
    word_count: 2,
    psm_used: 6,
    processing_note: "Success"
  })
}))

// Mock window.matchMedia since jsdom does not implement it
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
}

// Clear mock storage before every test to ensure state isolation
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
