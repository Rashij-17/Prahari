/**
 * CameraScanner Component — v3.0 "Warm Rx"
 * ===========================================
 * Same pipeline as before (getUserMedia → canvas → Base64 → OCR),
 * restyled: SVG icons instead of emoji, forest/amber palette,
 * warm paper surfaces.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { processFrame, processMultimodalFrame, searchMedications } from '../../services/api.js'

const MAX_WIDTH  = 1920
const MAX_HEIGHT = 1080
const JPEG_QUALITY = 0.92

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icons = {
  Camera: (p) => (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
      <circle cx="12" cy="12" r="3.2"/>
    </svg>
  ),
  Shutter: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="8"/>
    </svg>
  ),
  Upload: (p) => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 5 17 10"/>
      <line x1="12" y1="5" x2="12" y2="16"/>
    </svg>
  ),
  Check: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Alert: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 9v4M12 17h.01"/>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    </svg>
  ),
  Shield: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScanReticle() {
  return (
    <svg
      viewBox="0 0 300 180"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <mask id="reticle-mask">
          <rect width="300" height="180" fill="white" />
          <rect x="30" y="25" width="240" height="130" rx="12" ry="12" fill="black" />
        </mask>
      </defs>
      <rect width="300" height="180" fill="rgba(26, 23, 20, 0.50)" mask="url(#reticle-mask)" />

      <rect
        x="30" y="25" width="240" height="130" rx="12" ry="12"
        fill="none" stroke="var(--color-amber)" strokeWidth="2"
        strokeDasharray="10 6" opacity="0.95"
      />

      <path d="M30,45 L30,25 L50,25" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M250,25 L270,25 L270,45" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M30,135 L30,155 L50,155" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M250,155 L270,155 L270,135" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />

      <text x="150" y="173" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="9"
        fontFamily="'Plus Jakarta Sans', sans-serif" letterSpacing="0.08em">
        ALIGN MEDICATION LABEL WITHIN FRAME
      </text>
    </svg>
  )
}

function ProcessingOverlay({ statusText }) {
  return (
    <div role="status" aria-live="polite" aria-label={statusText} style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1.125rem',
      backgroundColor: 'rgba(26, 23, 20, 0.86)', backdropFilter: 'blur(6px)',
      borderRadius: '14px', zIndex: 10,
    }}>
      <div className="pulse-ring" style={{
        width: '56px', height: '56px', borderRadius: '14px',
        background: 'var(--color-forest)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icons.Shield />
      </div>
      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.875rem',
        color: 'rgba(255,255,255,0.85)', letterSpacing: '0.02em', margin: 0,
      }}>
        {statusText}
      </p>
    </div>
  )
}

function FileUploadFallback({ onFileSelected }) {
  const inputRef = useRef(null)

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => onFileSelected(evt.target.result)
    reader.readAsDataURL(file)
  }

  return (
    <div style={{
      padding: '3rem 2rem', textAlign: 'center',
      border: '1.5px dashed var(--color-border-strong)', borderRadius: '14px',
      backgroundColor: 'var(--color-cream)',
    }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '14px',
        background: 'var(--color-white)', color: 'var(--color-forest)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1.25rem',
      }}>
        <Icons.Upload />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)', margin: '0 0 0.5rem' }}>
        Camera unavailable
      </h3>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
        Upload an image of the medication label instead.
      </p>
      <input
        id="label-file-upload" ref={inputRef} type="file" accept="image/*"
        onChange={handleChange} style={{ display: 'none' }}
        aria-label="Upload medication label image"
      />
      <button className="btn-primary" onClick={() => inputRef.current?.click()}>
        Choose image
      </button>
    </div>
  )
}

function OCRResultsPanel({ result, onReset, onCandidateClick }) {
  const { raw_text, candidates, word_count, psm_used, processing_note } = result

  return (
    <div className="modal-enter">
      <div className="ribbon-moderate" style={{
        backgroundColor: 'var(--color-warning-bg)', borderRadius: '10px',
        padding: '0.875rem 1rem 0.875rem 1.25rem', marginBottom: '1.25rem',
        fontSize: '0.8125rem', color: 'var(--color-warning)', lineHeight: 1.55,
        display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
      }}>
        <Icons.Alert style={{ flexShrink: 0, marginTop: '1px' }} />
        <span><strong>OCR accuracy notice:</strong> Text was extracted automatically and may contain errors. Always verify against the original label and confirm with your pharmacist.</span>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span className="chip chip-info">PSM {psm_used}</span>
        <span className="chip chip-info">{word_count} words</span>
        <span className="chip chip-safe">Scan complete</span>
      </div>

      {candidates.length > 0 && (
        <div style={{ marginBottom: '1.75rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', color: 'var(--color-ink)', margin: '0 0 0.875rem' }}>
            Detected drug name candidates
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {candidates.map((name, idx) => (
              <div
                key={idx} className="card ribbon-safe"
                onClick={() => onCandidateClick && onCandidateClick(name)}
                style={{ padding: '0.875rem 1.125rem 0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--color-ink)', fontWeight: 500 }}>
                  {name}
                </span>
                <span className="chip chip-info" style={{ fontSize: '0.65rem' }}>#{idx + 1} match</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-faint)', margin: '0.625rem 0 0', fontStyle: 'italic' }}>
            Tap a candidate to search its drug intelligence profile.
          </p>
        </div>
      )}

      {candidates.length === 0 && (
        <div className="card ribbon-moderate" style={{ marginBottom: '1.5rem', padding: '1.125rem 1.25rem' }}>
          <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '0.9rem' }}>
            No drug name candidates identified. Try retaking with better lighting or a steadier hold.
          </p>
        </div>
      )}

      <details style={{ marginBottom: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-forest)', marginBottom: '0.5rem', userSelect: 'none' }}>
          View raw extracted text ({word_count} words)
        </summary>
        <pre style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.8rem', backgroundColor: 'var(--color-cream)',
          color: 'var(--color-ink)', padding: '1rem', borderRadius: '10px', overflowX: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, margin: 0,
        }}>
          {raw_text || '(no text extracted)'}
        </pre>
      </details>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-faint)', fontStyle: 'italic', margin: '0 0 1.5rem' }}>
        {processing_note}
      </p>

      <button className="btn-primary" id="scanner-reset-btn" onClick={onReset}>
        Scan another label
      </button>
    </div>
  )
}

function AIMultimodalResultsPanel({ result, onReset, onCandidateClick, onAddToMatrix, addingMap }) {
  const { drugs, patient_notes } = result

  return (
    <div className="modal-enter" style={{ textAlign: 'left' }}>
      <div className="ribbon-moderate" style={{
        backgroundColor: 'var(--color-warning-bg)', borderRadius: '10px',
        padding: '0.875rem 1rem 0.875rem 1.25rem', marginBottom: '1.25rem',
        fontSize: '0.8125rem', color: 'var(--color-warning)', lineHeight: 1.55,
        display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
      }}>
        <Icons.Alert style={{ flexShrink: 0, marginTop: '1px' }} />
        <span><strong>Clinical verification required:</strong> Prescription OCR transcriptions can contain errors. Please verify these drugs and instructions against the original physical paper before proceeding.</span>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span className="chip chip-safe">AI Decryption Complete</span>
        <span className="chip chip-info">{drugs?.length || 0} medications identified</span>
      </div>

      <div style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-ink)', margin: '0 0 1rem' }}>
          Deciphered Prescription Items
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {drugs && drugs.map((drug, idx) => {
            const addingState = addingMap[idx] || 'idle'
            const isBrandAndGenericSame = drug.brand_name && drug.generic_name && (drug.brand_name.toLowerCase().trim() === drug.generic_name.toLowerCase().trim())
            
            return (
              <div
                key={idx} 
                className="card ribbon-safe"
                style={{ 
                  padding: '1.25rem 1.5rem', 
                  backgroundColor: 'var(--color-white)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.15rem', fontFamily: 'var(--font-sans)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                      {drug.brand_name || "Unknown Brand"}
                    </h4>
                    {drug.generic_name && !isBrandAndGenericSame && (
                      <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                        Generic: {drug.generic_name}
                      </p>
                    )}
                  </div>
                  <span className="chip chip-info" style={{ fontSize: '0.75rem' }}>Item #{idx + 1}</span>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '0.75rem', 
                  fontSize: '0.825rem', 
                  backgroundColor: 'var(--color-cream)', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)'
                }}>
                  <div>
                    <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>DOSAGE</span>
                    <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{drug.dosage_strength || "N/A"}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>FREQUENCY</span>
                    <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{drug.frequency || "N/A"}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--color-muted)', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>INSTRUCTIONS</span>
                    <span style={{ color: 'var(--color-ink)' }}>{drug.instructions || "No custom instructions"}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button 
                    className="btn-ghost" 
                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    onClick={() => onCandidateClick(drug.brand_name || drug.generic_name)}
                  >
                    Lookup Profile
                  </button>
                  <button 
                    className={addingState === 'added' ? "btn-primary" : "btn-outline"}
                    style={{ 
                      flex: 1, 
                      fontSize: '0.8rem', 
                      padding: '0.4rem 0.75rem',
                      borderColor: addingState === 'added' ? 'transparent' : 'var(--color-border-strong)',
                      backgroundColor: addingState === 'added' ? 'var(--color-safe-bg)' : undefined,
                      color: addingState === 'added' ? 'var(--color-safe)' : undefined,
                    }}
                    disabled={addingState === 'loading' || addingState === 'added'}
                    onClick={() => onAddToMatrix(drug, idx)}
                  >
                    {addingState === 'loading' && "Adding..."}
                    {addingState === 'added' && "✓ Added to Matrix"}
                    {addingState === 'error' && "Retry Add"}
                    {addingState === 'idle' && "Add to Matrix"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {patient_notes && (
        <div className="card" style={{ marginBottom: '1.75rem', padding: '1.25rem', backgroundColor: 'var(--color-parchment)' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '0.03em' }}>
            PATIENT NOTES & RECOMMENDATIONS
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {patient_notes}
          </p>
        </div>
      )}

      <button className="btn-primary" id="scanner-reset-btn" onClick={onReset} style={{ width: '100%' }}>
        Scan another prescription
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CameraScanner() {
  const navigate = useNavigate()

  const [phase, setPhase] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_scanner_state')
      if (saved) {
        const parsed = JSON.parse(saved)
        // If the saved phase was camera/capturing/processing, revert to 'idle'
        return (parsed.phase === 'camera' || parsed.phase === 'capturing' || parsed.phase === 'processing') ? 'idle' : (parsed.phase ?? 'idle')
      }
    } catch (e) {}
    return 'idle'
  })
  const [statusText, setStatusText] = useState('Reading label…')
  const [ocrResult, setOcrResult] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_scanner_state')
      return saved ? (JSON.parse(saved).ocrResult ?? null) : null
    } catch (e) { return null }
  })
  const [errorMessage, setErrorMessage] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_scanner_state')
      return saved ? (JSON.parse(saved).errorMessage ?? '') : ''
    } catch (e) { return '' }
  })
  const [capturedDataUrl, setCapturedDataUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_scanner_state')
      return saved ? (JSON.parse(saved).capturedDataUrl ?? null) : null
    } catch (e) { return null }
  })
  const [enableAIScan, setEnableAIScan] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_scanner_state')
      return saved ? (JSON.parse(saved).enableAIScan ?? false) : false
    } catch (e) { return false }
  })
  const [addingMap, setAddingMap] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_scanner_state')
      return saved ? (JSON.parse(saved).addingMap ?? {}) : {}
    } catch (e) { return {} }
  })

  // Sync state to localStorage
  useEffect(() => {
    try {
      const stateToSave = {
        phase,
        ocrResult,
        capturedDataUrl,
        enableAIScan,
        errorMessage,
        addingMap,
      }
      localStorage.setItem('prahari_scanner_state', JSON.stringify(stateToSave))
    } catch (e) {
      console.error('Failed to save scanner state to localStorage:', e)
    }
  }, [phase, ocrResult, capturedDataUrl, enableAIScan, errorMessage, addingMap])

  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const startCamera = useCallback(async () => {
    setPhase('camera')
    setErrorMessage('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err)
      stopStream()
      setPhase('upload')
    }
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => { return () => stopStream() }, [stopStream])

  const animateStatus = useCallback(() => {
    const messages = ['Reading label…', 'Identifying medication…', 'Fetching clinical data…']
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % messages.length
      setStatusText(messages[i])
    }, 1200)
    return () => clearInterval(interval)
  }, [])

  const handleAddToMatrix = useCallback(async (drug, idx) => {
    setAddingMap(prev => ({ ...prev, [idx]: 'loading' }))
    try {
      const searchName = drug.brand_name || drug.generic_name
      if (!searchName) {
        throw new Error("No name available to search.")
      }
      const response = await searchMedications(searchName, 1)
      const results = response.results || []
      const match = results.find(r => r.rxcui)
      
      if (!match) {
        throw new Error("No RxCUI found for this medication.")
      }
      
      const rxcuiVal = Array.isArray(match.rxcui) ? match.rxcui[0] : match.rxcui
      const medToAdd = {
        name: match.generic_name || match.name || match.brand_name || searchName,
        rxcui: rxcuiVal,
        brand: match.brand_name
      }
      
      // Add to localStorage
      const cabinet = JSON.parse(localStorage.getItem('medicine_cabinet') || '[]')
      if (!cabinet.some(item => item.rxcui === medToAdd.rxcui)) {
        cabinet.push(medToAdd)
        localStorage.setItem('medicine_cabinet', JSON.stringify(cabinet))
      }
      
      setAddingMap(prev => ({ ...prev, [idx]: 'added' }))
    } catch (err) {
      console.error("Failed to add medication to matrix:", err)
      setAddingMap(prev => ({ ...prev, [idx]: 'error' }))
      alert(`Could not resolve RxCUI for ${drug.brand_name || drug.generic_name}. You can search for it manually in the Interactions Matrix.`)
    }
  }, [])

  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    setPhase('capturing')

    const video  = videoRef.current
    const canvas = canvasRef.current
    const w = Math.min(video.videoWidth, MAX_WIDTH)
    const h = Math.min(video.videoHeight, MAX_HEIGHT)
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    setCapturedDataUrl(dataUrl)
    stopStream()

    setPhase('processing')
    const stopAnimation = animateStatus()

    try {
      const result = enableAIScan ? await processMultimodalFrame(dataUrl) : await processFrame(dataUrl)
      stopAnimation()
      setOcrResult(result)
      setPhase('results')
    } catch (err) {
      stopAnimation()
      setErrorMessage(err.message || 'Could not reach the OCR service. Check your connection and try again.')
      setPhase('error')
    }
  }, [stopStream, animateStatus, enableAIScan])

  const handleFileUpload = useCallback(async (dataUrl) => {
    setCapturedDataUrl(dataUrl)
    setPhase('processing')
    const stopAnimation = animateStatus()
    try {
      const result = enableAIScan ? await processMultimodalFrame(dataUrl) : await processFrame(dataUrl)
      stopAnimation()
      setOcrResult(result)
      setPhase('results')
    } catch (err) {
      stopAnimation()
      setErrorMessage(err.message || 'OCR processing failed. Please try again.')
      setPhase('error')
    }
  }, [animateStatus, enableAIScan])

  const reset = useCallback(() => {
    stopStream()
    setOcrResult(null)
    setErrorMessage('')
    setCapturedDataUrl(null)
    setAddingMap({})
    setPhase('idle')
    try {
      localStorage.removeItem('prahari_scanner_state')
    } catch (e) {
      console.error('Failed to clear scanner state from localStorage:', e)
    }
  }, [stopStream])

  const handleCandidateClick = useCallback((candidateName) => {
    navigate(`/medications?search=${encodeURIComponent(candidateName)}`)
  }, [navigate])

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>

      <div className="page-header" style={{ border: 'none', paddingBottom: 0, marginBottom: '1.75rem' }}>
        <h1>Visual label scanner</h1>
        <p>Point your camera at a medication label to identify the drug and retrieve its clinical profile.</p>
      </div>

      {phase === 'idle' && (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px',
            background: 'var(--color-forest-subtle)', color: 'var(--color-forest)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <Icons.Camera />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', margin: '0 0 0.75rem' }}>
            Ready to scan
          </h2>
          <p style={{ color: 'var(--color-muted)', margin: '0 0 1.75rem', fontSize: '0.9375rem' }}>
            Prahari will request camera access. Point at the label and press capture.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.875rem', flexWrap: 'wrap', maxWidth: '380px', margin: '0 auto' }}>
            <button id="scanner-start-btn" className="btn-primary" onClick={startCamera} style={{ flex: '1 1 auto', margin: 0 }}>
              Start camera
            </button>
            
            <input
              type="file"
              id="label-image-upload-idle"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (evt) => handleFileUpload(evt.target.result)
                reader.readAsDataURL(file)
              }}
              style={{ display: 'none' }}
            />
            <label
              htmlFor="label-image-upload-idle"
              className="btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                margin: 0,
                padding: '0.625rem 1.25rem',
                flex: '1 1 auto',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '12px',
                border: '1.5px solid var(--color-border-strong)',
                backgroundColor: 'var(--color-white)',
                color: 'var(--color-ink)',
                transition: 'var(--transition-standard)'
              }}
            >
              <Icons.Upload style={{ width: '18px', height: '18px' }} />
              Upload image
            </label>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginTop: '1.5rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--color-parchment)',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            maxWidth: '320px',
            margin: '1.5rem auto 0',
          }}>
            <label style={{
              position: 'relative',
              display: 'inline-block',
              width: '42px',
              height: '24px',
              flexShrink: 0,
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={enableAIScan}
                onChange={(e) => setEnableAIScan(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
                id="ai-scan-toggle"
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: enableAIScan ? 'var(--color-forest)' : 'var(--color-border)',
                transition: '0.3s',
                borderRadius: '24px',
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: enableAIScan ? '20px' : '4px',
                  bottom: '3px',
                  backgroundColor: 'var(--color-white)',
                  transition: '0.3s',
                  borderRadius: '50%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </span>
            </label>
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--color-ink)',
              textAlign: 'left',
              userSelect: 'none',
            }}>
              Enable AI Scan (Prescriptions / Handwriting)
            </span>
          </div>
        </div>
      )}

      {phase === 'camera' && (
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '4/3',
            backgroundColor: '#000', borderRadius: '14px', overflow: 'hidden',
          }}>
            <video ref={videoRef} id="scanner-video-preview" autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              aria-label="Camera viewfinder" />
            <ScanReticle />
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', gap: '0.875rem', justifyContent: 'center', alignItems: 'center' }}>
            <button
              id="scanner-capture-btn" onClick={captureAndProcess}
              aria-label="Capture frame" title="Capture medication label"
              style={{
                width: '68px', height: '68px', borderRadius: '50%',
                border: '3px solid var(--color-amber)', backgroundColor: 'var(--color-white)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-amber)', boxShadow: 'var(--shadow-amber)',
                transition: 'var(--transition-standard)',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <Icons.Shutter />
            </button>
            <button id="scanner-cancel-btn" className="btn-ghost" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />

      {phase === 'processing' && (
        <div style={{ position: 'relative' }}>
          {capturedDataUrl && (
            <img src={capturedDataUrl} alt="Captured medication label" style={{
              width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: '14px',
              filter: 'blur(3px) brightness(0.5)', display: 'block',
            }} />
          )}
          <ProcessingOverlay statusText={statusText} />
        </div>
      )}

      {phase === 'results' && ocrResult && (
        ocrResult.drugs ? (
          <AIMultimodalResultsPanel 
            result={ocrResult} 
            onReset={reset} 
            onCandidateClick={handleCandidateClick} 
            onAddToMatrix={handleAddToMatrix}
            addingMap={addingMap}
          />
        ) : (
          <OCRResultsPanel result={ocrResult} onReset={reset} onCandidateClick={handleCandidateClick} />
        )
      )}

      {phase === 'upload' && (
        <div>
          <FileUploadFallback onFileSelected={handleFileUpload} />
          <p style={{ fontSize: '0.8rem', color: 'var(--color-faint)', textAlign: 'center', marginTop: '1rem' }}>
            Camera access was denied or is unavailable on this device.
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div className="card ribbon-moderate" style={{ backgroundColor: 'var(--color-warning-bg)', padding: '1.5rem 1.5rem 1.5rem 1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: '1.125rem' }}>
            <Icons.Alert style={{ flexShrink: 0, color: 'var(--color-warning)', marginTop: '2px' }} />
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--color-warning)', margin: '0 0 0.25rem', fontSize: '1rem', fontFamily: 'var(--font-sans)' }}>
                Could not process the image
              </h3>
              <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '0.9rem' }}>
                {errorMessage}
              </p>
            </div>
          </div>
          <button className="btn-primary" id="scanner-retry-btn" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
