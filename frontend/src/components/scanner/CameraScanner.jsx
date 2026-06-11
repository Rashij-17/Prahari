/**
 * CameraScanner Component
 * ========================
 * The primary entry point for medication label scanning.
 *
 * Implements the full client-side pipeline from
 * FEATURES_AND_STRUCTURE.md §2.1.1:
 *
 *   1. Request rear-facing camera via getUserMedia (env facing mode)
 *   2. Render live preview in <video> with 4:3 aspect ratio
 *   3. Overlay SVG scan-frame reticle to guide label alignment
 *   4. On capture: draw frame to off-screen <canvas>, export as Base64 JPEG
 *   5. POST the Base64 payload to FastAPI /scan/process
 *   6. Stop the media stream after capture
 *   7. Display OCR results (raw text + top drug candidates)
 *   8. Graceful fallback to file upload if camera is denied/unavailable
 *
 * Props: none (self-contained, manages its own state)
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { processFrame } from '../../services/api.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum canvas resolution before downscaling (keeps payload manageable) */
const MAX_WIDTH  = 1920
const MAX_HEIGHT = 1080

/** JPEG quality for Base64 export — 0.92 balances size and OCR accuracy */
const JPEG_QUALITY = 0.92

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * SVG reticle overlay drawn on top of the video preview.
 * The rounded-corner rectangle guides the user to align the label.
 */
function ScanReticle() {
  return (
    <svg
      viewBox="0 0 300 180"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {/* Semi-transparent dark overlay with cut-out reticle */}
      <defs>
        <mask id="reticle-mask">
          <rect width="300" height="180" fill="white" />
          <rect x="30" y="25" width="240" height="130" rx="12" ry="12" fill="black" />
        </mask>
      </defs>
      <rect
        width="300"
        height="180"
        fill="rgba(18, 20, 26, 0.45)"
        mask="url(#reticle-mask)"
      />

      {/* Reticle border */}
      <rect
        x="30" y="25"
        width="240" height="130"
        rx="12" ry="12"
        fill="none"
        stroke="var(--color-sage)"
        strokeWidth="2"
        strokeDasharray="12 6"
        opacity="0.9"
      />

      {/* Corner accent marks */}
      {/* Top-left */}
      <path d="M30,45 L30,25 L50,25" stroke="var(--color-teal)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Top-right */}
      <path d="M250,25 L270,25 L270,45" stroke="var(--color-teal)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Bottom-left */}
      <path d="M30,135 L30,155 L50,155" stroke="var(--color-teal)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Bottom-right */}
      <path d="M250,155 L270,155 L270,135" stroke="var(--color-teal)" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Instruction label */}
      <text
        x="150" y="173"
        textAnchor="middle"
        fill="var(--color-sage-light)"
        fontSize="9"
        fontFamily="Inter, sans-serif"
        letterSpacing="0.08em"
      >
        ALIGN MEDICATION LABEL WITHIN FRAME
      </text>
    </svg>
  )
}

/**
 * Processing overlay — shown while the backend processes the frame.
 * Displays a pulsing Prahari logo with rotating status messages.
 */
function ProcessingOverlay({ statusText }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={statusText}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        backgroundColor: 'rgba(18, 20, 26, 0.85)',
        backdropFilter: 'blur(8px)',
        borderRadius: '12px',
        zIndex: 10,
      }}
    >
      {/* Pulsing shield logo */}
      <div className="pulse-ring" style={{ width: '56px', height: '56px' }}>
        <svg width="56" height="56" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M16 2L4 7v9c0 6.627 5.373 12 12 12s12-5.373 12-12V7L16 2z"
            fill="var(--color-teal)" fillOpacity="0.2"
            stroke="var(--color-teal)" strokeWidth="1.5"
          />
          <rect x="14" y="9" width="4" height="14" rx="1" fill="var(--color-sage)" />
          <rect x="9" y="14" width="14" height="4" rx="1" fill="var(--color-sage)" />
        </svg>
      </div>

      {/* Cycling status message */}
      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '0.875rem',
        color: 'var(--color-sage-light)',
        letterSpacing: '0.04em',
        margin: 0,
      }}>
        {statusText}
      </p>
    </div>
  )
}

/**
 * File upload fallback — shown when camera access is denied or unavailable.
 */
function FileUploadFallback({ onFileSelected }) {
  const inputRef = useRef(null)

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      onFileSelected(evt.target.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        border: '2px dashed var(--color-border)',
        borderRadius: '12px',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📂</div>
      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', margin: '0 0 0.5rem' }}>
        Camera unavailable
      </h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
        Upload an image of the medication label instead.
      </p>
      <input
        id="label-file-upload"
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'none' }}
        aria-label="Upload medication label image"
      />
      <button
        className="btn-primary"
        onClick={() => inputRef.current?.click()}
      >
        📎 Choose Image
      </button>
    </div>
  )
}

/**
 * OCR Results panel — displays extracted text and drug candidates.
 */
function OCRResultsPanel({ result, onReset }) {
  const { raw_text, candidates, word_count, psm_used, processing_note } = result

  return (
    <div className="modal-enter">
      {/* OCR Accuracy disclaimer */}
      <div
        className="ribbon-moderate"
        style={{
          backgroundColor: 'var(--color-alert-moderate-bg)',
          borderRadius: '8px',
          padding: '0.75rem 1rem 0.75rem 1.25rem',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: 'var(--color-alert-moderate)',
          lineHeight: 1.5,
        }}
      >
        <strong>⚠ OCR Accuracy Notice:</strong> Text was extracted automatically and may contain
        errors. Always verify against the original label and confirm with your pharmacist.
      </div>

      {/* Processing metadata */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span className="chip chip-info">PSM {psm_used}</span>
        <span className="chip chip-info">{word_count} words</span>
        <span className="chip chip-safe">Scan complete</span>
      </div>

      {/* Top drug candidates */}
      {candidates.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.1rem',
            color: 'var(--color-text-primary)',
            margin: '0 0 0.75rem',
          }}>
            Detected Drug Name Candidates
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {candidates.map((name, idx) => (
              <div
                key={idx}
                className="card ribbon-safe"
                style={{
                  padding: '0.75rem 1rem 0.75rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.95rem',
                  color: 'var(--color-text-primary)',
                  fontWeight: 500,
                }}>
                  {name}
                </span>
                <span className="chip chip-info" style={{ fontSize: '0.65rem' }}>
                  #{idx + 1} match
                </span>
              </div>
            ))}
          </div>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            margin: '0.5rem 0 0',
            fontStyle: 'italic',
          }}>
            Drug Intelligence lookup will be available in Phase 4.
          </p>
        </div>
      )}

      {candidates.length === 0 && (
        <div className="card ribbon-moderate" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            No drug name candidates identified. Try retaking with better lighting or a steadier hold.
          </p>
        </div>
      )}

      {/* Raw OCR text (collapsible) */}
      <details style={{ marginBottom: '1.5rem' }}>
        <summary style={{
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--color-teal)',
          marginBottom: '0.5rem',
          userSelect: 'none',
        }}>
          View raw extracted text ({word_count} words)
        </summary>
        <pre style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          backgroundColor: 'var(--color-beige)',
          color: 'var(--color-text-primary)',
          padding: '1rem',
          borderRadius: '8px',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.6,
          margin: 0,
        }}>
          {raw_text || '(no text extracted)'}
        </pre>
      </details>

      {/* Processing note */}
      <p style={{
        fontSize: '0.8rem',
        color: 'var(--color-text-secondary)',
        fontStyle: 'italic',
        margin: '0 0 1.5rem',
      }}>
        {processing_note}
      </p>

      {/* Reset */}
      <button className="btn-primary" id="scanner-reset-btn" onClick={onReset}>
        📷 Scan Another Label
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CameraScanner() {
  // --- State ---
  const [phase, setPhase] = useState('idle')
  // Phases: 'idle' | 'camera' | 'capturing' | 'processing' | 'results' | 'error' | 'upload'

  const [statusText, setStatusText] = useState('Reading label…')
  const [ocrResult, setOcrResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [capturedDataUrl, setCapturedDataUrl] = useState(null)

  // --- Refs ---
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)

  // ---------------------------------------------------------------------------
  // Camera Lifecycle
  // ---------------------------------------------------------------------------

  /** Start the camera stream and bind it to the <video> element. */
  const startCamera = useCallback(async () => {
    setPhase('camera')
    setErrorMessage('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // rear camera on mobile
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
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

  /** Stop all tracks on the active media stream. */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Clean up stream when component unmounts
  useEffect(() => {
    return () => stopStream()
  }, [stopStream])

  // ---------------------------------------------------------------------------
  // Frame Capture & OCR Dispatch
  // ---------------------------------------------------------------------------

  /** Cycle through user-facing status messages during processing. */
  const animateStatus = useCallback(() => {
    const messages = ['Reading label…', 'Identifying medication…', 'Fetching clinical data…']
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % messages.length
      setStatusText(messages[i])
    }, 1200)
    return () => clearInterval(interval)
  }, [])

  /** Capture the current video frame, encode as Base64 JPEG, send to backend. */
  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    setPhase('capturing')

    // Draw current video frame onto the off-screen canvas
    const video  = videoRef.current
    const canvas = canvasRef.current

    // Constrain to max resolution
    const w = Math.min(video.videoWidth,  MAX_WIDTH)
    const h = Math.min(video.videoHeight, MAX_HEIGHT)
    canvas.width  = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)

    // Export as Base64 JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    setCapturedDataUrl(dataUrl)

    // Stop the camera stream immediately after capture
    stopStream()

    // Begin processing phase with animated status
    setPhase('processing')
    const stopAnimation = animateStatus()

    try {
      const result = await processFrame(dataUrl)
      stopAnimation()
      setOcrResult(result)
      setPhase('results')
    } catch (err) {
      stopAnimation()
      setErrorMessage(
        err.message || 'Could not reach the OCR service. Check your connection and try again.'
      )
      setPhase('error')
    }
  }, [stopStream, animateStatus])

  /** Handle file upload fallback (same pipeline, different image source). */
  const handleFileUpload = useCallback(async (dataUrl) => {
    setCapturedDataUrl(dataUrl)
    setPhase('processing')
    const stopAnimation = animateStatus()

    try {
      const result = await processFrame(dataUrl)
      stopAnimation()
      setOcrResult(result)
      setPhase('results')
    } catch (err) {
      stopAnimation()
      setErrorMessage(err.message || 'OCR processing failed. Please try again.')
      setPhase('error')
    }
  }, [animateStatus])

  /** Reset everything back to idle state. */
  const reset = useCallback(() => {
    stopStream()
    setOcrResult(null)
    setErrorMessage('')
    setCapturedDataUrl(null)
    setPhase('idle')
  }, [stopStream])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>

      {/* Page heading */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.75rem',
          color: 'var(--color-text-primary)',
          margin: '0 0 0.375rem',
        }}>
          Visual Label Scanner
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.95rem' }}>
          Point your camera at a medication label to identify the drug and retrieve its clinical profile.
        </p>
      </div>

      {/* === IDLE — prompt to start === */}
      {phase === 'idle' && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', margin: '0 0 0.75rem' }}>
            Ready to scan
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
            Prahari will request camera access. Point at the label and press Capture.
          </p>
          <button
            id="scanner-start-btn"
            className="btn-primary"
            onClick={startCamera}
          >
            📷 Start Camera
          </button>
        </div>
      )}

      {/* === CAMERA — live viewfinder === */}
      {phase === 'camera' && (
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4/3',
            backgroundColor: '#000',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            {/* Video element */}
            <video
              ref={videoRef}
              id="scanner-video-preview"
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              aria-label="Camera viewfinder"
            />

            {/* Scan reticle SVG overlay */}
            <ScanReticle />
          </div>

          {/* Capture button */}
          <div style={{ textAlign: 'center', marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              id="scanner-capture-btn"
              onClick={captureAndProcess}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                border: '4px solid var(--color-sage)',
                backgroundColor: 'var(--color-surface-card)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                boxShadow: '0 4px 16px rgba(42, 127, 140, 0.25)',
                transition: 'all 150ms ease-in-out',
              }}
              aria-label="Capture frame"
              title="Capture medication label"
            >
              📸
            </button>
            <button
              id="scanner-cancel-btn"
              className="btn-secondary"
              onClick={reset}
              style={{ alignSelf: 'center' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hidden off-screen canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />

      {/* === PROCESSING — animated loading overlay === */}
      {phase === 'processing' && (
        <div style={{ position: 'relative' }}>
          {capturedDataUrl && (
            <img
              src={capturedDataUrl}
              alt="Captured medication label"
              style={{
                width: '100%',
                aspectRatio: '4/3',
                objectFit: 'cover',
                borderRadius: '12px',
                filter: 'blur(3px) brightness(0.5)',
                display: 'block',
              }}
            />
          )}
          <ProcessingOverlay statusText={statusText} />
        </div>
      )}

      {/* === RESULTS === */}
      {phase === 'results' && ocrResult && (
        <OCRResultsPanel result={ocrResult} onReset={reset} />
      )}

      {/* === FILE UPLOAD FALLBACK === */}
      {phase === 'upload' && (
        <div>
          <FileUploadFallback onFileSelected={handleFileUpload} />
          <p style={{
            fontSize: '0.8rem',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            marginTop: '1rem',
          }}>
            Camera access was denied or is unavailable on this device.
          </p>
        </div>
      )}

      {/* === ERROR STATE === */}
      {phase === 'error' && (
        <div
          className="card ribbon-moderate"
          style={{
            backgroundColor: 'var(--color-alert-moderate-bg)',
            padding: '1.25rem 1.25rem 1.25rem 1.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠</span>
            <div>
              <h3 style={{
                fontWeight: 700,
                color: 'var(--color-alert-moderate)',
                margin: '0 0 0.25rem',
                fontSize: '1rem',
              }}>
                Could not process the image
              </h3>
              <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                {errorMessage}
              </p>
            </div>
          </div>
          <button className="btn-primary" id="scanner-retry-btn" onClick={reset}>
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
