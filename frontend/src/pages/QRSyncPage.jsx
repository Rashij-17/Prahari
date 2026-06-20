/**
 * QRSyncPage.jsx — Module 4
 * ===========================
 * Caregiver Offline QR Sync.
 * Exports full Prahari data as a compressed QR code.
 * Imports scanned QR data back into IndexedDB.
 *
 * External libs (loaded via CDN in index.html):
 *   - LZString (window.LZString)
 *   - qrcode (window.qrcode / QRCode)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { getMedicines, addMedicine, updateMedicine } from '../services/medicineCabinetDB.js'

const LS_KEY = 'prahari_schedule'
const PAYLOAD_VERSION = '1.0'
const QR_MAX_BYTES = 2800 // safe limit for QR alphanumeric mode
const LAST_7_DAYS_ONLY = true

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadScheduleLog() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function trimLogToLastNDays(log, n = 7) {
  const result = {}
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-CA')
    if (log[key]) result[key] = log[key]
  }
  return result
}

function formatTs(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icon = {
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Upload: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  QR: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
      <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
      <rect x="18" y="19" width="3" height="2"/><rect x="18" y="17" width="2" height="2"/>
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Warning: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Info: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// QR Generation (uses window.qrcode from CDN)
// ---------------------------------------------------------------------------
function generateQRCanvas(data, canvasRef) {
  return new Promise((resolve, reject) => {
    if (!window.qrcode) {
      reject(new Error('QR library not loaded. Check your internet connection.'))
      return
    }
    try {
      const qr = window.qrcode(0, 'M') // type 0 = auto, error correction M
      qr.addData(data)
      qr.make()
      const canvas = canvasRef.current
      if (!canvas) { reject(new Error('Canvas not found')); return }
      const ctx = canvas.getContext('2d')
      const modules = qr.getModuleCount()
      const cellSize = Math.floor(280 / modules)
      const qrSize = cellSize * modules
      canvas.width = qrSize + 20
      canvas.height = qrSize + 20

      // White background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw modules
      for (let row = 0; row < modules; row++) {
        for (let col = 0; col < modules; col++) {
          ctx.fillStyle = qr.isDark(row, col) ? '#1a1714' : '#ffffff'
          ctx.fillRect(col * cellSize + 10, row * cellSize + 10, cellSize, cellSize)
        }
      }
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

// ---------------------------------------------------------------------------
// Export Tab
// ---------------------------------------------------------------------------
function ExportTab() {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | generating | ready | error | too-large
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)
  const [compressed, setCompressed] = useState('')
  const [byteSize, setByteSize] = useState(0)

  const handleExport = useCallback(async () => {
    setStatus('generating')
    setError('')
    try {
      if (!window.LZString) throw new Error('LZString library not loaded.')

      const medicines = await getMedicines()
      let scheduleLog = loadScheduleLog()

      const fullPayload = {
        version: PAYLOAD_VERSION,
        exportedAt: new Date().toISOString(),
        medicines,
        scheduleLog,
      }

      let jsonStr = JSON.stringify(fullPayload)
      let comp = window.LZString.compressToEncodedURIComponent(jsonStr)

      // Check size — if too large, trim to last 7 days
      if (comp.length > QR_MAX_BYTES) {
        scheduleLog = trimLogToLastNDays(scheduleLog, 7)
        const trimmedPayload = { ...fullPayload, scheduleLog, trimmed: true }
        jsonStr = JSON.stringify(trimmedPayload)
        comp = window.LZString.compressToEncodedURIComponent(jsonStr)
      }

      if (comp.length > QR_MAX_BYTES) {
        setStatus('too-large')
        setError('Your data is too large for a single QR code even after trimming. Export individual medicines instead.')
        return
      }

      setPayload(fullPayload)
      setCompressed(comp)
      setByteSize(comp.length)

      await generateQRCanvas(comp, canvasRef)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message)
    }
  }, [])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `prahari-qr-${new Date().toISOString().split('T')[0]}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div>
      <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', marginBottom: '1.5rem' }}>
        Export all your medicines and schedule data as a QR code. A caregiver can scan this to import everything on another device — no internet required.
      </p>

      <button
        id="qr-export-btn"
        onClick={handleExport}
        disabled={status === 'generating'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none',
          background: status === 'ready' ? 'var(--color-safe)' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
          color: '#fff', fontWeight: 600, fontSize: '0.9375rem', fontFamily: 'var(--font-sans)',
          cursor: status === 'generating' ? 'not-allowed' : 'pointer',
          opacity: status === 'generating' ? 0.7 : 1,
          boxShadow: '0 4px 14px rgba(99,102,241,0.30)',
          transition: 'all 250ms ease',
          marginBottom: '1.5rem',
        }}
      >
        <Icon.QR />
        {status === 'generating' ? 'Generating QR…'
          : status === 'ready' ? 'Regenerate QR'
          : 'Generate QR Code'}
      </button>

      {/* Error / Warning */}
      {(status === 'error' || status === 'too-large') && (
        <div style={{ background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-border)', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.625rem', color: 'var(--color-critical)', fontSize: '0.875rem' }}>
          <Icon.Warning /><span>{error}</span>
        </div>
      )}

      {/* Trimmed notice */}
      {payload?.trimmed && status === 'ready' && (
        <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', color: 'var(--color-warning)', fontSize: '0.825rem' }}>
          <Icon.Warning /><span>Schedule log trimmed to last 7 days to fit QR capacity ({byteSize} bytes).</span>
        </div>
      )}

      {/* QR Code Display */}
      {status === 'ready' && (
        <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            padding: '1rem', background: '#fff',
            borderRadius: '16px', boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--color-border)',
          }}>
            <canvas
              ref={canvasRef}
              aria-label="QR code containing your Prahari data"
              style={{ display: 'block', maxWidth: '300px', maxHeight: '300px' }}
            />
          </div>

          {/* Meta info */}
          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            <p style={{ margin: '0 0 0.25rem' }}>
              <strong style={{ color: 'var(--color-ink)' }}>{payload?.medicines?.length || 0} medicines</strong> exported
              · {byteSize} bytes
            </p>
            <p style={{ margin: 0 }}>Generated: {formatTs(payload?.exportedAt)}</p>
          </div>

          {/* Compressed string (for manual paste import) */}
          <details style={{ width: '100%', maxWidth: '400px' }}>
            <summary style={{ fontSize: '0.8rem', color: 'var(--color-faint)', cursor: 'pointer', padding: '0.25rem 0' }}>
              Show compressed string (for manual import)
            </summary>
            <textarea
              readOnly
              value={compressed}
              rows={4}
              style={{
                width: '100%', marginTop: '0.5rem', padding: '0.5rem', borderRadius: '8px',
                border: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem', color: 'var(--color-muted)', resize: 'none',
                background: 'var(--color-cream)', boxSizing: 'border-box',
              }}
            />
          </details>

          <button
            id="qr-download-btn"
            onClick={handleDownload}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.65rem 1.5rem', borderRadius: '9px',
              border: '1.5px solid #6366f1', background: 'transparent',
              color: '#6366f1', fontWeight: 600, fontSize: '0.9rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Icon.Download /> Download QR as PNG
          </button>
        </div>
      )}

      {/* Canvas hidden until ready */}
      {status !== 'ready' && <canvas ref={canvasRef} style={{ display: 'none' }} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import Tab
// ---------------------------------------------------------------------------
function ImportTab() {
  const [importStr, setImportStr] = useState('')
  const [preview, setPreview] = useState(null)
  const [parseError, setParseError] = useState('')
  const [importStatus, setImportStatus] = useState('idle') // idle | previewing | importing | done | error
  const [importedCount, setImportedCount] = useState(0)

  const handleParse = useCallback(() => {
    setParseError('')
    setPreview(null)
    setImportStatus('idle')

    if (!importStr.trim()) { setParseError('Paste the compressed string first.'); return }
    if (!window.LZString) { setParseError('LZString library not loaded.'); return }

    try {
      const decompressed = window.LZString.decompressFromEncodedURIComponent(importStr.trim())
      if (!decompressed) throw new Error('Decompression failed. The data may be corrupt or incomplete.')
      const parsed = JSON.parse(decompressed)

      if (parsed.version !== PAYLOAD_VERSION) {
        setParseError(`Unsupported version: ${parsed.version}. Expected ${PAYLOAD_VERSION}.`)
        return
      }
      setPreview(parsed)
      setImportStatus('previewing')
    } catch (err) {
      setParseError(err.message)
    }
  }, [importStr])

  const handleImport = useCallback(async () => {
    if (!preview) return
    setImportStatus('importing')

    try {
      const existing = await getMedicines()
      const existingIds = new Set(existing.map(m => m.id))

      let count = 0
      for (const med of preview.medicines || []) {
        if (existingIds.has(med.id)) {
          await updateMedicine(med)
        } else {
          await addMedicine(med)
        }
        count++
      }

      // Merge schedule log
      if (preview.scheduleLog) {
        const currentLog = loadScheduleLog()
        const merged = { ...currentLog, ...preview.scheduleLog }
        localStorage.setItem(LS_KEY, JSON.stringify(merged))
      }

      setImportedCount(count)
      setImportStatus('done')
    } catch (err) {
      setImportStatus('error')
      setParseError(`Import failed: ${err.message}`)
    }
  }, [preview])

  return (
    <div>
      <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', marginBottom: '1.5rem' }}>
        Paste the compressed data string from a QR code scan to import medicines and schedule data onto this device.
      </p>

      <label htmlFor="import-string" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
        Paste compressed data string
      </label>
      <textarea
        id="import-string"
        value={importStr}
        onChange={e => { setImportStr(e.target.value); setPreview(null); setImportStatus('idle'); setParseError('') }}
        rows={5}
        placeholder="Paste the compressed Prahari QR string here…"
        style={{
          width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
          border: '1.5px solid var(--color-border)', background: 'var(--color-white)',
          fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-ink)',
          outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          transition: 'border-color 150ms ease',
        }}
        onFocus={e => e.target.style.borderColor = '#6366f1'}
        onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
      />

      <button
        id="import-parse-btn"
        onClick={handleParse}
        style={{
          marginTop: '0.875rem',
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.65rem 1.25rem', borderRadius: '9px', border: 'none',
          background: '#6366f1', color: '#fff', fontWeight: 600,
          fontSize: '0.9rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
        }}
      >
        <Icon.QR /> Decode & Preview
      </button>

      {parseError && (
        <div style={{ marginTop: '1rem', background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-border)', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', color: 'var(--color-critical)', fontSize: '0.875rem' }}>
          <Icon.Warning />{parseError}
        </div>
      )}

      {/* Preview */}
      {importStatus === 'previewing' && preview && (
        <div className="fade-in-up" style={{ marginTop: '1.25rem', border: '1.5px solid #86efac', borderRadius: '14px', padding: '1.25rem', background: 'rgba(34,197,94,0.04)' }}>
          <h3 style={{ margin: '0 0 0.875rem', fontSize: '0.95rem', color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon.Check /> Preview — Data looks valid
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.625rem', marginBottom: '1rem' }}>
            {[
              { label: 'Exported on', value: formatTs(preview.exportedAt) },
              { label: 'Medicines', value: `${preview.medicines?.length || 0} entries` },
              { label: 'Schedule Days', value: `${Object.keys(preview.scheduleLog || {}).length} days` },
              { label: 'Version', value: preview.version },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--color-white)', borderRadius: '9px', padding: '0.625rem 0.75rem', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-faint)', marginBottom: '0.15rem' }}>{label}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Medicine list preview */}
          {preview.medicines?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Medicines to import:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {preview.medicines.slice(0, 12).map(m => (
                  <span key={m.id} className="chip chip-info">{m.name}</span>
                ))}
                {preview.medicines.length > 12 && (
                  <span className="chip chip-neutral">+{preview.medicines.length - 12} more</span>
                )}
              </div>
            </div>
          )}

          <div style={{ background: 'var(--color-warning-bg)', borderRadius: '8px', padding: '0.625rem 0.75rem', border: '1px solid var(--color-warning-border)', fontSize: '0.8rem', color: 'var(--color-warning)', marginBottom: '1rem' }}>
            <strong>Note:</strong> Existing medicines with the same ID will be updated. New ones will be added. Schedule data will be merged.
          </div>

          <button
            id="import-confirm-btn"
            onClick={handleImport}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.7rem 1.5rem', borderRadius: '9px', border: 'none',
              background: 'var(--color-safe)', color: '#fff', fontWeight: 600,
              fontSize: '0.9375rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Icon.Upload /> Import to My Cabinet
          </button>
        </div>
      )}

      {importStatus === 'importing' && (
        <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '10px', background: 'var(--color-cream)', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
          Importing data…
        </div>
      )}

      {importStatus === 'done' && (
        <div className="fade-in-up" style={{ marginTop: '1rem', background: 'var(--color-safe-bg)', border: '1px solid var(--color-safe-border)', borderRadius: '10px', padding: '1rem', display: 'flex', gap: '0.5rem', color: 'var(--color-safe)', fontSize: '0.9rem' }}>
          <Icon.Check />
          <div>
            <strong>Import complete!</strong> {importedCount} medicine{importedCount !== 1 ? 's' : ''} imported/updated.
            {' '}<a href="/cabinet" style={{ color: '#6366f1', fontWeight: 600 }}>View Cabinet →</a>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function QRSyncPage() {
  const [activeTab, setActiveTab] = useState('export')
  const [libsLoaded, setLibsLoaded] = useState(false)
  const [libError, setLibError] = useState('')

  useEffect(() => {
    // Check if CDN libs are loaded
    const check = () => {
      if (window.LZString && window.qrcode) {
        setLibsLoaded(true)
        return
      }
      // Try loading dynamically if not present
      if (!window.LZString) {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js'
        s.onload = () => {
          if (!window.qrcode) loadQR()
          else setLibsLoaded(true)
        }
        s.onerror = () => setLibError('Failed to load LZString library. Check your connection.')
        document.head.appendChild(s)
      }
      if (!window.qrcode) loadQR()
    }

    const loadQR = () => {
      if (window.qrcode) { setLibsLoaded(!!window.LZString && true); return }
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
      s.onload = () => {
        // qrcodejs uses QRCode class, not window.qrcode generator
        // Try qrcode-generator instead
      }
      document.head.appendChild(s)

      // Load qrcode-generator (the one with window.qrcode function)
      const s2 = document.createElement('script')
      s2.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'
      s2.onload = () => setLibsLoaded(!!window.LZString)
      s2.onerror = () => setLibError('Failed to load QR library.')
      document.head.appendChild(s2)
    }

    check()
  }, [])

  const tabs = [
    { id: 'export', label: '📤 Export QR', desc: 'Generate QR for caregiver' },
    { id: 'import', label: '📥 Import QR', desc: 'Scan & restore data' },
  ]

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>📡</span> Caregiver QR Sync
        </h1>
        <p>Share your medication data with a caregiver via QR code — works completely offline, no account needed.</p>
      </div>

      {/* Lib error banner */}
      {libError && (
        <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--color-warning)', display: 'flex', gap: '0.5rem' }}>
          <Icon.Warning /><span>{libError} The QR feature requires internet access to load once.</span>
        </div>
      )}

      {/* Loading libs */}
      {!libsLoaded && !libError && (
        <div style={{ padding: '1rem', background: 'var(--color-cream)', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--color-muted)', textAlign: 'center' }}>
          Loading QR libraries…
        </div>
      )}

      {/* How It Works */}
      <div style={{
        background: 'rgba(99,102,241,0.05)',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: '12px',
        padding: '1rem 1.125rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '0.75rem',
        fontSize: '0.85rem',
        color: 'var(--color-muted)',
        lineHeight: 1.6,
      }}>
        <span style={{ fontSize: '1.25rem', flexShrink: 0, lineHeight: 1 }}><Icon.Info /></span>
        <div>
          <strong style={{ color: '#6366f1' }}>How it works: </strong>
          Your medicine data is compressed and encoded as a QR code. The caregiver scans the QR with any QR reader, then pastes the text into the Import tab on their device — no internet needed for the transfer.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            style={{
              padding: '0.625rem 1.125rem',
              borderRadius: '9px 9px 0 0',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2.5px solid #6366f1' : '2.5px solid transparent',
              background: activeTab === tab.id ? 'rgba(99,102,241,0.07)' : 'transparent',
              color: activeTab === tab.id ? '#6366f1' : 'var(--color-muted)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.9rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '1.5rem', minHeight: '300px' }}>
        {!libsLoaded && !libError ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-faint)' }}>
            Loading libraries…
          </div>
        ) : libError ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-faint)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🌐</div>
            <p>Please connect to the internet at least once to load the QR libraries.</p>
          </div>
        ) : (
          <>
            {activeTab === 'export' && <ExportTab />}
            {activeTab === 'import' && <ImportTab />}
          </>
        )}
      </div>

      {/* Security note */}
      <div style={{ marginTop: '1.25rem', padding: '0.875rem', background: 'var(--color-cream)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--color-faint)', lineHeight: 1.6 }}>
        🔒 <strong style={{ color: 'var(--color-muted)' }}>Privacy note:</strong> Your data is only stored on this device and shared via the QR code you choose to display. Prahari never sends your data to any server.
      </div>
    </div>
  )
}
