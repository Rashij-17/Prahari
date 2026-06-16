/**
 * Prahari Frontend Services — API Client
 * ========================================
 * Centralised HTTP client for all FastAPI backend calls.
 * Configured in Phase 3 with actual endpoint calls.
 *
 * All API calls go through this module so base URL changes
 * only need to happen in one place.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Generic fetch wrapper with JSON handling and error surfacing.
 * @param {string} endpoint - API path (e.g. '/health')
 * @param {RequestInit} options - fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `API error: ${response.status}`)
  }

  return response.json()
}

// ---------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------

/** Verifies the backend is reachable. */
export const checkHealth = () => apiFetch('/health')

// ---------------------------------------------------------------
// Phase 3 — Vision / OCR
// ---------------------------------------------------------------

/**
 * Submits a Base64 image frame for OCR processing.
 * The backend strips the data URI prefix if present.
 *
 * @param {string} base64Image - Full Data URI or raw Base64 string
 * @returns {Promise<OCRResult>} Processed OCR result with candidates
 */
export const processFrame = (base64Image) =>
  apiFetch('/scan/process', {
    method: 'POST',
    body: JSON.stringify({ image: base64Image }),
  })

// ---------------------------------------------------------------
// Phase 4 — Medication Intelligence
// ---------------------------------------------------------------

/**
 * Fetches a full drug clinical profile by name.
 * Two-stage: RxNorm resolution → openFDA label lookup.
 *
 * @param {string} drugName - Generic or brand drug name
 * @returns {Promise<DrugProfile>}
 */
export const getMedicationProfile = (drugName) =>
  apiFetch(`/medication/profile?name=${encodeURIComponent(drugName)}`)

/**
 * Searches for medications matching a query string.
 * Returns lightweight summaries from RxNorm + openFDA.
 *
 * @param {string} query  - Search term (min 2 chars)
 * @param {number} limit  - Max results (default 8)
 * @returns {Promise<MedicationSearchResponse>}
 */
export const searchMedications = (query, limit = 8) =>
  apiFetch(`/medication/search?q=${encodeURIComponent(query)}&limit=${limit}`)

// ---------------------------------------------------------------
// Phase 5 — Triage (stubs)
// ---------------------------------------------------------------

/** Submits symptom text for triage assessment. */
export const assessSymptoms = (payload) =>
  apiFetch('/triage/assess', { method: 'POST', body: JSON.stringify(payload) })

// ---------------------------------------------------------------
// Phase 5 — Directory (stubs)
// ---------------------------------------------------------------

/** Searches for nearby healthcare providers. */
export const searchProviders = (payload) =>
  apiFetch('/directory/search', { method: 'POST', body: JSON.stringify(payload) })

// ---------------------------------------------------------------
// Phase 2 — Interactions, Triage Chat & Multimodal OCR
// ---------------------------------------------------------------

/** Checks pairwise interactions for a list of RxCUIs. */
export const checkDrugInteractions = (rxcuis) =>
  apiFetch('/medication/interactions', {
    method: 'POST',
    body: JSON.stringify({ rxcuis }),
  })

/** Submits a Base64 image frame for Gemini/Groq/Tesseract multimodal OCR. */
export const processMultimodalFrame = (base64Image) =>
  apiFetch('/scan/process-multimodal', {
    method: 'POST',
    body: JSON.stringify({ image: base64Image }),
  })

/** Submits triage chat conversation evidence for next question / result. */
export const assessTriageChat = (evidence, sex, age, text) =>
  apiFetch('/triage/chat', {
    method: 'POST',
    body: JSON.stringify({ evidence, sex, age, text }),
  })

