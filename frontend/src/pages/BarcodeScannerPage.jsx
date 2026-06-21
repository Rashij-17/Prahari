/**
 * BarcodeScannerPage.jsx — Module 7
 * =====================================
 * Client-Side Barcode Scanner using html5-qrcode (CDN UMD build).
 * Scans EAN-13, UPC-A, Code-128, QR, Code-39; looks up drug info from
 * openFDA NDC database with AbortController cancellation; plays AudioContext
 * beep on success; stores last 10 scans in sessionStorage.
 *
 * Cross-module integration:
 *  - "Add to Cabinet" → Module 1 addMedicine() via IndexedDB
 *  - "Search Substitute" → /substitute?q= (Module 5)
 *  - "Find Jan Aushadhi" → /subsidy?q= (Module 6)
 *
 * Offline: beep works offline (Web Audio API); scan works offline;
 *          FDA lookup degrades gracefully with clear error.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { addMedicine } from '../services/medicineCabinetDB.js'

// ─── Load html5-qrcode from CDN (UMD build) ───────────────────────────────────
function ensureHtml5Qrcode() {
  return new Promise((resolve, reject) => {
    if (window.Html5Qrcode) { resolve(window.Html5Qrcode); return }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
    script.onload = () => {
      if (window.Html5Qrcode) resolve(window.Html5Qrcode)
      else reject(new Error('html5-qrcode failed to load'))
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// ─── Beep via Web Audio API ───────────────────────────────────────────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  } catch {}
}

// ─── Session Storage Helpers ──────────────────────────────────────────────────
const HISTORY_KEY = 'prahari_scan_history'
const MAX_HISTORY = 10

function getHistory() {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

function saveToHistory(entry) {
  try {
    const hist = getHistory()
    hist.unshift(entry)
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, MAX_HISTORY)))
  } catch {}
}

function updateHistoryEntry(scannedCode, patch) {
  try {
    const hist = getHistory().map(e => e.scannedCode === scannedCode ? { ...e, ...patch } : e)
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(hist))
  } catch {}
}

// ─── openFDA Lookup ───────────────────────────────────────────────────────────
async function lookupByNDC(code, signal) {
  const enc = encodeURIComponent(code)

  // Primary: NDC endpoint
  try {
    const r = await fetch(
      `https://api.fda.gov/drug/ndc.json?search=package_ndc:"${enc}"&limit=1`,
      { signal }
    )
    if (r.ok) {
      const d = await r.json()
      if (d.results?.length) {
        const res = d.results[0]
        return {
          source: 'ndc',
          genericName: res.generic_name || '',
          brandName: res.brand_name || '',
          activeSalt: res.active_ingredients?.[0]?.name || '',
          strength: res.active_ingredients?.[0]?.strength || '',
          dosageForm: res.dosage_form || '',
          manufacturer: res.labeler_name || '',
          ndc: code,
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err
  }

  // Fallback: drug/label endpoint
  try {
    const r = await fetch(
      `https://api.fda.gov/drug/label.json?search=package_ndc:"${enc}"&limit=1`,
      { signal }
    )
    if (r.ok) {
      const d = await r.json()
      if (d.results?.length) {
        const res = d.results[0]
        return {
          source: 'label',
          genericName: res.openfda?.generic_name?.[0] || '',
          brandName: res.openfda?.brand_name?.[0] || '',
          activeSalt: res.active_ingredient?.[0] || '',
          strength: '',
          dosageForm: res.openfda?.dosage_form?.[0] || '',
          manufacturer: res.openfda?.manufacturer_name?.[0] || '',
          ndc: code,
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err
  }

  return null
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Pill: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
    </svg>
  ),
  Barcode: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14M1 5v14"/>
    </svg>
  ),
  Camera: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  FlipCamera: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M1 15v4h4"/><path d="M1 19c1.72-4.88 5.43-8.69 10-10.24"/><path d="M23 9V5h-4"/><path d="M23 5c-1.72 4.88-5.43 8.69-10 10.24"/>
    </svg>
  ),
  Plus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Leaf: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>
  ),
  History: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  ChevronDown: ({ open }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 250ms ease' }} aria-hidden="true">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Copy: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function ResultSkeleton() {
  return (
    <div style={{ background: 'var(--color-white)', border: '1.5px solid var(--color-border)', borderRadius: '16px', padding: '1.5rem', animation: 'fade-in-up 250ms ease' }}>
      {[['60%', 20], ['40%', 14], ['80%', 14], ['55%', 14]].map(([w, h], i) => (
        <div key={i} className="skeleton-pulse" style={{ height: `${h}px`, width: w, borderRadius: '6px', marginBottom: '0.75rem' }} />
      ))}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        {[120, 140, 150].map(w => (
          <div key={w} className="skeleton-pulse" style={{ height: '36px', width: `${w}px`, borderRadius: '8px' }} />
        ))}
      </div>
    </div>
  )
}

// ─── Scan Result Card ─────────────────────────────────────────────────────────
function ScanResultCard({ drugInfo, scannedCode, onAddToCabinet, onSearchSubstitute, onFindJanAushadhi, isFromHistory }) {
  const name = drugInfo.genericName || drugInfo.brandName || 'Unknown Drug'
  const brand = drugInfo.brandName && drugInfo.brandName !== drugInfo.genericName ? drugInfo.brandName : null

  return (
    <div style={{
      background: 'var(--color-white)',
      border: '1.5px solid rgba(83,74,183,0.3)',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(83,74,183,0.10)',
      animation: 'fade-in-up 300ms ease',
    }}>
      {/* Green flash header strip */}
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #16a34a, #4ade80)' }} />

      <div style={{ padding: '1.25rem' }}>
        {/* Drug header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(83,74,183,0.08)', color: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon.Pill />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-ink)', lineHeight: 1.2, marginBottom: '0.2rem' }}>{name}</div>
            {brand && <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>({brand})</div>}
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.625rem', borderRadius: '5px', background: 'rgba(22,163,74,0.1)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)', flexShrink: 0 }}>✓ Found</div>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.625rem', marginBottom: '1rem' }}>
          {[
            { label: 'Salt / Active', value: drugInfo.activeSalt || '—' },
            { label: 'Strength', value: drugInfo.strength || '—' },
            { label: 'Form', value: drugInfo.dosageForm || '—' },
            { label: 'Manufacturer', value: drugInfo.manufacturer || '—' },
            { label: 'NDC Code', value: scannedCode || drugInfo.ndc || '—' },
          ].filter(f => f.value && f.value !== '—').map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--color-cream)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
              <div style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-faint)', marginBottom: '0.15rem' }}>{label}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-ink)', wordBreak: 'break-word' }}>{value.slice(0, 60)}{value.length > 60 ? '…' : ''}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onAddToCabinet(drugInfo)}
            aria-label={`Add ${name} to Medicine Cabinet`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', background: '#534AB7', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'background 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.background = '#3f38a0'}
            onMouseLeave={e => e.currentTarget.style.background = '#534AB7'}
          >
            <Icon.Plus /> Add to Cabinet
          </button>
          <button
            onClick={() => onSearchSubstitute(drugInfo.genericName || drugInfo.brandName)}
            aria-label={`Search generic substitutes for ${name}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '8px', border: '1.5px solid rgba(83,74,183,0.3)', background: 'rgba(83,74,183,0.06)', color: '#534AB7', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'var(--transition-fast)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(83,74,183,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(83,74,183,0.06)'}
          >
            <Icon.Search /> Search Substitute
          </button>
          <button
            onClick={() => onFindJanAushadhi(drugInfo.genericName || drugInfo.brandName)}
            aria-label={`Find Jan Aushadhi equivalent for ${name}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '8px', border: '1.5px solid rgba(22,163,74,0.3)', background: 'rgba(22,163,74,0.06)', color: '#16a34a', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'var(--transition-fast)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(22,163,74,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(22,163,74,0.06)'}
          >
            <Icon.Leaf /> Jan Aushadhi
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── History Card ─────────────────────────────────────────────────────────────
function HistoryCard({ entry, onReOpen }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.875rem', background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(83,74,183,0.08)', color: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon.Barcode />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.drugName || entry.scannedCode}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-faint)' }}>
          {entry.genericSalt} · {new Date(entry.scannedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          {entry.addedToCabinet && <span style={{ marginLeft: '0.4rem', color: '#16a34a' }}>✓ Added</span>}
        </div>
      </div>
      <button
        onClick={() => onReOpen(entry)}
        aria-label={`Re-open scan for ${entry.drugName}`}
        style={{ padding: '0.35rem 0.75rem', borderRadius: '7px', border: '1.5px solid rgba(83,74,183,0.25)', background: 'rgba(83,74,183,0.05)', color: '#534AB7', fontWeight: 600, fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', flexShrink: 0 }}
      >
        Re-open
      </button>
    </div>
  )
}

// ─── Scanner Viewfinder ───────────────────────────────────────────────────────
function ScannerViewfinder({ scanStatus, flashGreen }) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto', aspectRatio: '4/3', background: '#111', borderRadius: '16px', overflow: 'hidden' }}>
      <style>{`
        @keyframes scanLine {
          0%   { top: 10%; }
          50%  { top: 85%; }
          100% { top: 10%; }
        }
        @keyframes flashGreen {
          0%   { opacity: 0; }
          30%  { opacity: 0.55; }
          100% { opacity: 0; }
        }
        #html5qr-code-full-region video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover;
          border-radius: 0 !important;
        }
        #html5qr-code-full-region img { display: none !important; }
        #html5qr-code-full-region { border: none !important; }
      `}</style>

      {/* Camera preview container — html5-qrcode injects video here */}
      <div id="html5qr-code-full-region" style={{ width: '100%', height: '100%' }} />

      {/* Dark overlay with transparent scanning zone */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Top overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '20%', background: 'rgba(0,0,0,0.55)' }} />
        {/* Bottom overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '20%', background: 'rgba(0,0,0,0.55)' }} />
        {/* Left overlay */}
        <div style={{ position: 'absolute', top: '20%', left: 0, width: '10%', height: '60%', background: 'rgba(0,0,0,0.55)' }} />
        {/* Right overlay */}
        <div style={{ position: 'absolute', top: '20%', right: 0, width: '10%', height: '60%', background: 'rgba(0,0,0,0.55)' }} />

        {/* Corner brackets */}
        {[
          { top: 'calc(20% - 2px)', left: 'calc(10% - 2px)', borderTop: '3px solid white', borderLeft: '3px solid white', borderRadius: '4px 0 0 0' },
          { top: 'calc(20% - 2px)', right: 'calc(10% - 2px)', borderTop: '3px solid white', borderRight: '3px solid white', borderRadius: '0 4px 0 0' },
          { bottom: 'calc(20% - 2px)', left: 'calc(10% - 2px)', borderBottom: '3px solid white', borderLeft: '3px solid white', borderRadius: '0 0 0 4px' },
          { bottom: 'calc(20% - 2px)', right: 'calc(10% - 2px)', borderBottom: '3px solid white', borderRight: '3px solid white', borderRadius: '0 0 4px 0' },
        ].map((style, i) => (
          <div key={i} style={{ position: 'absolute', width: '24px', height: '24px', ...style }} />
        ))}

        {/* Red scanning line */}
        {scanStatus === 'scanning' && (
          <div style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #ef4444, #ef4444, transparent)',
            boxShadow: '0 0 8px #ef4444',
            animation: 'scanLine 2s ease-in-out infinite',
          }} />
        )}

        {/* Green flash on success */}
        {flashGreen && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(34, 197, 94, 0.6)',
            animation: 'flashGreen 300ms ease forwards',
          }} />
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BarcodeScannerPage() {
  const [scannerActive, setScannerActive] = useState(false)
  const [facingMode, setFacingMode] = useState('environment')
  const [scanStatus, setScanStatus] = useState('idle') // idle | scanning | found | error
  const [flashGreen, setFlashGreen] = useState(false)
  const [scannedCode, setScannedCode] = useState('')
  const [lookupStatus, setLookupStatus] = useState('idle') // idle | loading | success | notfound | network_error | malformed
  const [drugInfo, setDrugInfo] = useState(null)
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [reOpenEntry, setReOpenEntry] = useState(null)
  const scannerRef = useRef(null)
  const abortRef = useRef(null)
  const SCANNER_DIV_ID = 'html5qr-code-full-region'

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory())
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── FDA Lookup ──────────────────────────────────────────────────────────────
  const performLookup = useCallback(async (code) => {
    if (!code || code.trim().length < 4) {
      setLookupStatus('malformed')
      return
    }

    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setLookupStatus('loading')
    setDrugInfo(null)

    try {
      const info = await lookupByNDC(code.trim(), abortRef.current.signal)
      if (info) {
        setDrugInfo(info)
        setLookupStatus('success')

        const histEntry = {
          scannedCode: code.trim(),
          scannedAt: new Date().toISOString(),
          drugName: info.genericName || info.brandName || 'Unknown',
          genericSalt: info.activeSalt || info.genericName || '',
          addedToCabinet: false,
        }
        saveToHistory(histEntry)
        setHistory(getHistory())
      } else {
        setLookupStatus('notfound')
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setLookupStatus('network_error')
    }
  }, [])

  // ── Scanner lifecycle ───────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    try {
      const Html5QrcodeLib = await ensureHtml5Qrcode()
      const Html5QrcodeObj = window.Html5Qrcode

      if (scannerRef.current) {
        try { await scannerRef.current.stop() } catch {}
        try { await scannerRef.current.clear() } catch {}
      }

      const scanner = new Html5QrcodeObj(SCANNER_DIV_ID, { verbose: false })
      scannerRef.current = scanner

      const formats = []
      const SF = window.Html5QrcodeSupportedFormats
      if (SF) {
        ;[SF.EAN_13, SF.UPC_A, SF.CODE_128, SF.QR_CODE, SF.CODE_39]
          .forEach(f => f !== undefined && formats.push(f))
      }

      await scanner.start(
        { facingMode },
        {
          fps: 10,
          qrbox: { width: 260, height: 160 },
          formatsToSupport: formats.length ? formats : undefined,
        },
        (decodedText) => {
          // Success callback
          playBeep()
          setFlashGreen(true)
          setTimeout(() => setFlashGreen(false), 400)
          setScanStatus('found')
          setScannedCode(decodedText)
          setScannerActive(false)
          // Stop scanner
          scanner.stop().then(() => scanner.clear()).catch(() => {})
          scannerRef.current = null
          performLookup(decodedText)
        },
        () => {} // Error callback — suppress per-frame errors
      )
      setScanStatus('scanning')
      setScannerActive(true)
    } catch (err) {
      setScanStatus('error')
      setScannerActive(false)
      if (err?.message?.includes('Permission')) setShowManual(true)
    }
  }, [facingMode, performLookup])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      try { await scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
    setScannerActive(false)
    setScanStatus('idle')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current.clear().catch(() => {})
      }
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  // Restart scanner when facingMode changes while active
  useEffect(() => {
    if (scannerActive) {
      stopScanner().then(startScanner)
    }
  }, [facingMode])

  // ── Handler: Add to Cabinet ─────────────────────────────────────────────────
  const handleAddToCabinet = useCallback(async (info) => {
    try {
      const med = {
        id: crypto.randomUUID(),
        name: info.genericName || info.brandName || scannedCode,
        genericSalt: info.activeSalt || info.genericName || '',
        dosage: info.strength ? `${info.strength}` : '',
        frequency: 'OD',
        stockCount: '',
        expiryDate: '',
        notes: `Scanned via barcode ${scannedCode}. Manufacturer: ${info.manufacturer || 'Unknown'}`,
      }
      await addMedicine(med)
      updateHistoryEntry(scannedCode, { addedToCabinet: true })
      setHistory(getHistory())
      showToast(`✅ ${med.name} added to Cabinet!`)
    } catch {
      showToast('❌ Failed to add to Cabinet.')
    }
  }, [scannedCode])

  // ── Handler: Search Substitute (Module 5) ───────────────────────────────────
  const handleSearchSubstitute = useCallback((name) => {
    window.location.href = `/substitute?prefill=${encodeURIComponent(name)}`
  }, [])

  // ── Handler: Find Jan Aushadhi (Module 6) ───────────────────────────────────
  const handleFindJanAushadhi = useCallback((name) => {
    window.location.href = `/subsidy?q=${encodeURIComponent(name)}`
  }, [])

  // ── Handler: Re-open from history ──────────────────────────────────────────
  const handleReOpen = useCallback((entry) => {
    setScannedCode(entry.scannedCode)
    setHistoryOpen(false)
    if (entry.drugName && entry.drugName !== 'Unknown' && entry.genericSalt) {
      setDrugInfo({
        genericName: entry.drugName,
        brandName: '',
        activeSalt: entry.genericSalt,
        strength: '',
        dosageForm: '',
        manufacturer: '',
        ndc: entry.scannedCode,
        source: 'history',
      })
      setLookupStatus('success')
    } else {
      performLookup(entry.scannedCode)
    }
  }, [performLookup])

  // ── Handler: Manual lookup ──────────────────────────────────────────────────
  const handleManualLookup = useCallback(() => {
    if (!manualCode.trim()) return
    setScannedCode(manualCode.trim())
    performLookup(manualCode.trim())
  }, [manualCode, performLookup])

  const statusText = {
    idle: 'Point camera at barcode…',
    scanning: 'Scanning…',
    found: 'Found!',
    error: 'Camera error. Use manual entry below.',
  }[scanStatus]

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', paddingBottom: '5rem' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes flashGreen { 0%{opacity:0} 30%{opacity:0.55} 100%{opacity:0} }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'var(--color-white)', border: '1.5px solid var(--color-border)', borderRadius: '10px', padding: '0.75rem 1.5rem', boxShadow: 'var(--shadow-lg)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap', animation: 'fade-in-up 250ms ease' }}>
          {toast}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>📷</span> Barcode Scanner
        </h1>
        <p>Scan any medicine barcode to instantly look up drug details, add to your cabinet, or find cheaper alternatives.</p>
      </div>

      {/* Scanner Card */}
      <div style={{ background: 'var(--color-white)', border: '1.5px solid var(--color-border)', borderRadius: '18px', overflow: 'hidden', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        {/* Viewfinder */}
        <div style={{ padding: '1rem 1rem 0' }}>
          <ScannerViewfinder scanStatus={scanStatus} flashGreen={flashGreen} />
        </div>

        {/* Status text */}
        <div style={{ textAlign: 'center', padding: '0.75rem 1rem 0', fontSize: '0.875rem', fontWeight: 500, color: scanStatus === 'found' ? '#16a34a' : 'var(--color-muted)' }}>
          {statusText}
        </div>

        {/* Scanned code display */}
        {scannedCode && (
          <div style={{ textAlign: 'center', padding: '0.35rem 1rem 0' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', background: 'var(--color-cream)', padding: '0.25rem 0.75rem', borderRadius: '99px', color: 'var(--color-muted)' }}>
              <Icon.Barcode />{scannedCode}
            </span>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: '0.625rem', padding: '1rem', flexWrap: 'wrap' }}>
          {!scannerActive ? (
            <button
              id="scanner-start-btn"
              onClick={startScanner}
              aria-label="Start barcode scanner"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem', borderRadius: '10px', border: 'none', background: '#534AB7', color: '#fff', fontWeight: 600, fontSize: '0.9375rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'background 150ms ease' }}
              onMouseEnter={e => e.currentTarget.style.background = '#3f38a0'}
              onMouseLeave={e => e.currentTarget.style.background = '#534AB7'}
            >
              <Icon.Camera /> Start Scanner
            </button>
          ) : (
            <button
              id="scanner-stop-btn"
              onClick={stopScanner}
              aria-label="Stop barcode scanner"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem', borderRadius: '10px', border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', fontWeight: 600, fontSize: '0.9375rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
            >
              ■ Stop Scanner
            </button>
          )}

          <button
            id="scanner-flip-btn"
            onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}
            aria-label="Switch camera"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.7rem 1rem', borderRadius: '10px', border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'var(--transition-fast)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#534AB7'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
          >
            <Icon.FlipCamera /> {facingMode === 'environment' ? 'Front' : 'Rear'}
          </button>

          <button
            id="scanner-manual-btn"
            onClick={() => setShowManual(v => !v)}
            aria-label="Toggle manual barcode entry"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.7rem 1rem', borderRadius: '10px', border: '1.5px solid var(--color-border)', background: showManual ? 'var(--color-cream)' : 'transparent', color: 'var(--color-muted)', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
          >
            ⌨️ Manual
          </button>
        </div>

        {/* Manual entry */}
        {showManual && (
          <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="manual-barcode-input"
                type="text"
                placeholder="Enter barcode or NDC (e.g. 00003-0221-10)…"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualLookup()}
                aria-label="Enter barcode manually"
                style={{ flex: 1, padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--color-ink)', outline: 'none', background: 'var(--color-white)' }}
              />
              <button
                onClick={handleManualLookup}
                aria-label="Look up barcode"
                style={{ padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none', background: '#534AB7', color: '#fff', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
              >
                Look Up
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lookup States */}
      {lookupStatus === 'loading' && <ResultSkeleton />}

      {lookupStatus === 'success' && drugInfo && (
        <ScanResultCard
          drugInfo={drugInfo}
          scannedCode={scannedCode}
          onAddToCabinet={handleAddToCabinet}
          onSearchSubstitute={handleSearchSubstitute}
          onFindJanAushadhi={handleFindJanAushadhi}
        />
      )}

      {lookupStatus === 'notfound' && (
        <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-warning)', marginBottom: '0.375rem' }}>🔬 Drug not found in FDA database</div>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
            Code "{scannedCode}" returned no matches. This may be an Indian-only medication not in the US NDC database.
          </p>
          <button
            onClick={() => { setLookupStatus('idle'); setShowManual(true) }}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid var(--color-warning)', background: 'transparent', color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
          >
            Add Manually
          </button>
        </div>
      )}

      {lookupStatus === 'network_error' && (
        <div style={{ background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-critical)', marginBottom: '0.375rem' }}>📵 Offline — could not look up barcode</div>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', margin: '0 0 0.875rem' }}>
            Check your internet connection. The scanned code was: <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{scannedCode}</strong>
          </p>
          <button
            onClick={() => performLookup(scannedCode)}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid var(--color-critical)', background: 'transparent', color: 'var(--color-critical)', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {lookupStatus === 'malformed' && (
        <div style={{ background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-border)', borderRadius: '14px', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-critical)', fontSize: '0.9rem' }}>⚠️ Unrecognized barcode format</div>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Try a different barcode or use manual entry above.</p>
        </div>
      )}

      {/* Supported formats info */}
      <div style={{ background: 'rgba(83,74,183,0.04)', border: '1px solid rgba(83,74,183,0.12)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
        <strong style={{ color: '#534AB7' }}>📋 Supported formats:</strong> EAN-13, UPC-A, Code-128, Code-39, QR Code · Looks up US FDA NDC database · Indian-only drugs may not appear
      </div>

      {/* Recent Scans History */}
      {history.length > 0 && (
        <div style={{ background: 'var(--color-white)', border: '1.5px solid var(--color-border)', borderRadius: '14px', overflow: 'hidden' }}>
          <button
            onClick={() => setHistoryOpen(v => !v)}
            aria-label={historyOpen ? 'Collapse scan history' : 'Expand scan history'}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
              <Icon.History />
              Recent Scans
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '99px', background: 'rgba(83,74,183,0.1)', color: '#534AB7' }}>{history.length}</span>
            </div>
            <Icon.ChevronDown open={historyOpen} />
          </button>

          <div style={{ maxHeight: historyOpen ? '600px' : '0', overflow: 'hidden', transition: 'max-height 350ms cubic-bezier(0.4,0,0.2,1)' }}>
            <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {history.map((entry, i) => (
                <HistoryCard key={`${entry.scannedCode}-${i}`} entry={entry} onReOpen={handleReOpen} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
