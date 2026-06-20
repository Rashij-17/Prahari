/**
 * DecoderPage.jsx — Module 3
 * ============================
 * Latin Prescription Abbreviation Decoder.
 * Tokenizes input and highlights known abbreviations inline.
 * All logic is pure JS — no external NLP libraries.
 */

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Abbreviation Map — 70+ entries
// ---------------------------------------------------------------------------
/**
 * ABBREVIATION_MAP
 * Key: lowercase abbreviation (spaces replaced by single space for multi-word)
 * Value: { meaning, category }
 * Categories: frequency | timing | route | formulation | quantity | quantity-unit
 */
const ABBREVIATION_MAP = {
  // ── Frequency ─────────────────────────────────────────────
  'od':      { meaning: 'once daily', category: 'frequency' },
  'qd':      { meaning: 'once daily', category: 'frequency' },
  'bd':      { meaning: 'twice daily', category: 'frequency' },
  'bid':     { meaning: 'twice daily', category: 'frequency' },
  'b.d.':    { meaning: 'twice daily', category: 'frequency' },
  'tds':     { meaning: 'three times daily', category: 'frequency' },
  'tid':     { meaning: 'three times daily', category: 'frequency' },
  't.d.s.':  { meaning: 'three times daily', category: 'frequency' },
  'qid':     { meaning: 'four times daily', category: 'frequency' },
  'q.i.d.':  { meaning: 'four times daily', category: 'frequency' },
  'hs':      { meaning: 'at bedtime', category: 'frequency' },
  'qhs':     { meaning: 'every night at bedtime', category: 'frequency' },
  'mane':    { meaning: 'in the morning', category: 'frequency' },
  'nocte':   { meaning: 'at night', category: 'frequency' },
  'noct':    { meaning: 'at night', category: 'frequency' },
  'om':      { meaning: 'every morning', category: 'frequency' },
  'on':      { meaning: 'every night', category: 'frequency' },
  'qqh':     { meaning: 'every four hours', category: 'frequency' },
  'q4h':     { meaning: 'every 4 hours', category: 'frequency' },
  'q6h':     { meaning: 'every 6 hours', category: 'frequency' },
  'q8h':     { meaning: 'every 8 hours', category: 'frequency' },
  'q12h':    { meaning: 'every 12 hours', category: 'frequency' },
  'q':       { meaning: 'every', category: 'frequency' },
  'alt die': { meaning: 'alternate days', category: 'frequency' },
  'ad lib':  { meaning: 'as desired / freely', category: 'frequency' },
  // ── Timing ────────────────────────────────────────────────
  'ac':      { meaning: 'before meals', category: 'timing' },
  'pc':      { meaning: 'after meals', category: 'timing' },
  'cc':      { meaning: 'with meals', category: 'timing' },
  'stat':    { meaning: 'immediately / at once', category: 'timing' },
  'prn':     { meaning: 'as needed / when required', category: 'timing' },
  'sos':     { meaning: 'if needed (single dose)', category: 'timing' },
  'npo':     { meaning: 'nothing by mouth (fasting)', category: 'timing' },
  'rf':      { meaning: 'repeat if needed', category: 'timing' },
  'rep':     { meaning: 'repeat', category: 'timing' },
  'ut dict': { meaning: 'as directed', category: 'timing' },
  'mdu':     { meaning: 'as directed by doctor', category: 'timing' },
  // ── Route of Administration ───────────────────────────────
  'po':      { meaning: 'by mouth (oral)', category: 'route' },
  'sl':      { meaning: 'under the tongue (sublingual)', category: 'route' },
  'im':      { meaning: 'into the muscle (intramuscular)', category: 'route' },
  'iv':      { meaning: 'into the vein (intravenous)', category: 'route' },
  'sc':      { meaning: 'under the skin (subcutaneous)', category: 'route' },
  'sq':      { meaning: 'under the skin (subcutaneous)', category: 'route' },
  'top':     { meaning: 'applied to the skin (topical)', category: 'route' },
  'inh':     { meaning: 'by inhalation', category: 'route' },
  'pr':      { meaning: 'by rectum', category: 'route' },
  'pv':      { meaning: 'by vagina', category: 'route' },
  'nas':     { meaning: 'nasally', category: 'route' },
  'otic':    { meaning: 'in the ear', category: 'route' },
  'op':      { meaning: 'in the eye (ophthalmic)', category: 'route' },
  'ou':      { meaning: 'both eyes', category: 'route' },
  'od eye':  { meaning: 'right eye', category: 'route' },
  'os':      { meaning: 'left eye', category: 'route' },
  // ── Formulation ───────────────────────────────────────────
  'tab':     { meaning: 'tablet', category: 'formulation' },
  'tabs':    { meaning: 'tablets', category: 'formulation' },
  'cap':     { meaning: 'capsule', category: 'formulation' },
  'caps':    { meaning: 'capsules', category: 'formulation' },
  'supp':    { meaning: 'suppository', category: 'formulation' },
  'ung':     { meaning: 'ointment', category: 'formulation' },
  'sol':     { meaning: 'solution', category: 'formulation' },
  'mist':    { meaning: 'mixture / suspension', category: 'formulation' },
  'pulv':    { meaning: 'powder', category: 'formulation' },
  'liq':     { meaning: 'liquid', category: 'formulation' },
  'susp':    { meaning: 'suspension', category: 'formulation' },
  'syr':     { meaning: 'syrup', category: 'formulation' },
  'crm':     { meaning: 'cream', category: 'formulation' },
  'lot':     { meaning: 'lotion', category: 'formulation' },
  'pess':    { meaning: 'pessary', category: 'formulation' },
  'amp':     { meaning: 'ampoule', category: 'formulation' },
  'vial':    { meaning: 'vial', category: 'formulation' },
  // ── Quantity / Dose ────────────────────────────────────────
  'ss':      { meaning: 'one half (½)', category: 'quantity' },
  'iss':     { meaning: 'one and one half (1½)', category: 'quantity' },
  'disp':    { meaning: 'dispense', category: 'quantity' },
  'dtd':     { meaning: 'give of such doses', category: 'quantity' },
  'qty':     { meaning: 'quantity', category: 'quantity' },
  'sig':     { meaning: 'write / instructions for patient', category: 'quantity' },
  'aq':      { meaning: 'water', category: 'quantity' },
  'dil':     { meaning: 'dilute', category: 'quantity' },
  'gtt':     { meaning: 'drop(s)', category: 'quantity' },
  'gtts':    { meaning: 'drops', category: 'quantity' },
  'fl oz':   { meaning: 'fluid ounce', category: 'quantity' },
  'tbsp':    { meaning: 'tablespoon (15 mL)', category: 'quantity' },
  'tsp':     { meaning: 'teaspoon (5 mL)', category: 'quantity' },
  'mg':      { meaning: 'milligrams', category: 'quantity-unit' },
  'ml':      { meaning: 'millilitres', category: 'quantity-unit' },
  'mcg':     { meaning: 'micrograms', category: 'quantity-unit' },
  'iu':      { meaning: 'international units', category: 'quantity-unit' },
}

// Multi-word keys that must be matched before single-token pass
const MULTI_WORD_KEYS = Object.keys(ABBREVIATION_MAP).filter(k => k.includes(' '))

// ---------------------------------------------------------------------------
// Category Config (colour + label)
// ---------------------------------------------------------------------------
const CATEGORY_CONFIG = {
  frequency:     { label: 'Frequency',    bg: 'rgba(99,102,241,0.12)', color: '#6366f1', border: 'rgba(99,102,241,0.30)' },
  timing:        { label: 'Timing',       bg: 'rgba(245,158,11,0.12)', color: '#d97706', border: 'rgba(245,158,11,0.30)' },
  route:         { label: 'Route',        bg: 'rgba(34,197,94,0.10)',  color: '#16a34a', border: 'rgba(34,197,94,0.25)' },
  formulation:   { label: 'Formulation',  bg: 'rgba(236,72,153,0.10)', color: '#db2777', border: 'rgba(236,72,153,0.25)' },
  quantity:      { label: 'Quantity',     bg: 'rgba(59,130,246,0.10)', color: '#2563eb', border: 'rgba(59,130,246,0.25)' },
  'quantity-unit':{ label: 'Unit',        bg: 'rgba(20,184,166,0.10)', color: '#0d9488', border: 'rgba(20,184,166,0.25)' },
  unknown:       { label: 'Unknown',      bg: 'transparent',           color: 'var(--color-faint)', border: 'transparent' },
}

// ---------------------------------------------------------------------------
// Core decode function
// ---------------------------------------------------------------------------
/**
 * Tokenizes the input string and matches abbreviations.
 * Returns: DecodedToken[] = { text, meaning?, category?, decoded: boolean }
 */
function decode(input) {
  if (!input.trim()) return []

  const tokens = []
  let remaining = input

  while (remaining.length > 0) {
    // 1. Skip leading whitespace / punctuation (preserve it as unknown)
    const leadMatch = remaining.match(/^[\s,./;:()\-]+/)
    if (leadMatch) {
      tokens.push({ text: leadMatch[0], decoded: false, isWhitespace: true })
      remaining = remaining.slice(leadMatch[0].length)
      continue
    }

    // 2. Try multi-word match first (greedy, longest first)
    let matched = false
    const sortedMulti = [...MULTI_WORD_KEYS].sort((a, b) => b.length - a.length)
    for (const key of sortedMulti) {
      if (remaining.toLowerCase().startsWith(key)) {
        const entry = ABBREVIATION_MAP[key]
        tokens.push({ text: remaining.slice(0, key.length), decoded: true, meaning: entry.meaning, category: entry.category })
        remaining = remaining.slice(key.length)
        matched = true
        break
      }
    }
    if (matched) continue

    // 3. Extract one word token
    const wordMatch = remaining.match(/^[^\s,./;:()\-]+/)
    if (!wordMatch) break
    const word = wordMatch[0]
    const lower = word.toLowerCase()
    const entry = ABBREVIATION_MAP[lower]
    if (entry) {
      tokens.push({ text: word, decoded: true, meaning: entry.meaning, category: entry.category })
    } else {
      tokens.push({ text: word, decoded: false })
    }
    remaining = remaining.slice(word.length)
  }

  return tokens
}

/**
 * Build the plain-text decoded string for copy.
 */
function buildPlainText(tokens) {
  return tokens.map(t => {
    if (t.isWhitespace) return t.text
    return t.decoded ? t.meaning : t.text
  }).join('')
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function TokenChip({ token }) {
  if (token.isWhitespace) return <span>{token.text}</span>

  const cfg = token.decoded ? (CATEGORY_CONFIG[token.category] || CATEGORY_CONFIG.frequency) : CATEGORY_CONFIG.unknown

  if (!token.decoded) {
    return (
      <span style={{ color: 'var(--color-faint)' }}>{token.text}</span>
    )
  }

  return (
    <span
      title={`${token.text} → ${token.meaning} (${cfg.label})`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '6px',
        padding: '0.15rem 0.45rem',
        margin: '0 2px',
        verticalAlign: 'baseline',
        cursor: 'default',
        transition: 'filter 150ms ease',
      }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.9)'}
      onMouseLeave={e => e.currentTarget.style.filter = 'none'}
    >
      <span style={{ fontWeight: 700, color: cfg.color, fontSize: '0.9em', lineHeight: 1.2 }}>{token.text}</span>
      <span style={{ fontSize: '0.65em', color: cfg.color, opacity: 0.85, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{token.meaning}</span>
    </span>
  )
}

function CategoryLegend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
      {Object.entries(CATEGORY_CONFIG).filter(([k]) => k !== 'unknown').map(([key, cfg]) => (
        <span key={key} style={{
          fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem',
          borderRadius: '5px', background: cfg.bg, color: cfg.color,
          border: `1px solid ${cfg.border}`,
        }}>
          {cfg.label}
        </span>
      ))}
      <span style={{ fontSize: '0.7rem', color: 'var(--color-faint)', padding: '0.2rem 0.5rem' }}>
        Gray = not recognized
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sample prescriptions
// ---------------------------------------------------------------------------
const SAMPLE_RX = [
  'Tab Metformin 500mg BD PC',
  'Cap Omeprazole 20mg OD AC',
  'Tab Aspirin 75mg OD mane',
  'Inj Insulin 10 IU SC OD hs',
  'Tab Atorvastatin 10mg OD nocte',
  'Susp Amoxicillin 250mg TDS PC × 5 days',
]

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DecoderPage() {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const tokens = decode(input)
  const decodedCount = tokens.filter(t => t.decoded).length
  const plainText = buildPlainText(tokens)

  const handleCopy = useCallback(async () => {
    if (!plainText.trim()) return
    try {
      await navigator.clipboard.writeText(plainText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = plainText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [plainText])

  const handleSample = (rx) => setInput(rx)

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🔤</span> Prescription Decoder
        </h1>
        <p>Type or paste any Latin prescription shorthand — get instant plain-English translation of every abbreviation.</p>
      </div>

      {/* Input Box */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="decoder-input" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
          Enter prescription text
        </label>
        <div style={{ position: 'relative' }}>
          <textarea
            id="decoder-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="e.g. Tab Metformin 500mg BD AC × 30 days"
            aria-label="Enter prescription abbreviation"
            rows={3}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              borderRadius: '12px',
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-white)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-mono)',
              fontSize: '1rem',
              outline: 'none',
              resize: 'vertical',
              transition: 'border-color 150ms ease',
              boxSizing: 'border-box',
              lineHeight: 1.6,
            }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />
          {input && (
            <button
              onClick={() => setInput('')}
              aria-label="Clear input"
              style={{
                position: 'absolute', top: '0.625rem', right: '0.625rem',
                background: 'var(--color-cream)', border: 'none', borderRadius: '6px',
                padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'var(--color-faint)',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Sample Prescriptions */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="section-label">Try a sample prescription</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {SAMPLE_RX.map(rx => (
            <button
              key={rx}
              onClick={() => handleSample(rx)}
              className="pill-btn"
              style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
            >
              {rx}
            </button>
          ))}
        </div>
      </div>

      {/* Decoded Output Card */}
      {input.trim() ? (
        <div
          className="fade-in-up"
          style={{
            background: 'var(--color-white)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '14px',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-ink)' }}>Decoded Result</span>
              {decodedCount > 0 && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                  borderRadius: '99px', background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                }}>
                  {decodedCount} abbreviation{decodedCount !== 1 ? 's' : ''} found
                </span>
              )}
            </div>
            <button
              id="decoder-copy-btn"
              onClick={handleCopy}
              aria-label="Copy decoded text"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.875rem', borderRadius: '8px',
                border: '1.5px solid var(--color-border)',
                background: copied ? 'rgba(34,197,94,0.1)' : 'var(--color-white)',
                borderColor: copied ? '#86efac' : 'var(--color-border)',
                color: copied ? 'var(--color-safe)' : 'var(--color-muted)',
                fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
                cursor: 'pointer', transition: 'var(--transition-fast)',
              }}
            >
              {copied ? '✓ Copied!' : '⎘ Copy decoded'}
            </button>
          </div>

          {/* Token Display */}
          <div style={{
            padding: '1rem',
            background: 'var(--color-cream)',
            borderRadius: '10px',
            fontSize: '1rem',
            lineHeight: 2.2,
            fontFamily: 'var(--font-sans)',
            wordBreak: 'break-word',
            minHeight: '3.5rem',
          }}>
            {tokens.length > 0 ? tokens.map((t, i) => <TokenChip key={i} token={t} />) : (
              <span style={{ color: 'var(--color-faint)' }}>Start typing to see decoded tokens...</span>
            )}
          </div>

          {/* Plain text preview */}
          {decodedCount > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(99,102,241,0.05)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.12)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6366f1', marginBottom: '0.35rem' }}>
                Plain English
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-ink)', lineHeight: 1.6, fontStyle: 'italic' }}>
                {plainText}
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '1rem', paddingTop: '0.875rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-faint)', marginBottom: '0.4rem', fontWeight: 600 }}>Color legend:</div>
            <CategoryLegend />
          </div>
        </div>
      ) : (
        /* Empty state */
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-faint)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📋</div>
          <p style={{ fontSize: '0.9rem' }}>
            Type a prescription above to start decoding.<br/>
            Supports <strong style={{ color: 'var(--color-ink)' }}>70+ Latin medical abbreviations</strong>.
          </p>
          <CategoryLegend />
        </div>
      )}

      {/* Reference Table */}
      <details style={{ marginTop: '2rem' }}>
        <summary style={{
          fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
          color: 'var(--color-muted)', padding: '0.5rem 0',
          listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span>▶</span> View full abbreviation reference ({Object.keys(ABBREVIATION_MAP).length} entries)
        </summary>
        <div style={{
          marginTop: '0.75rem',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-cream)' }}>
                {['Abbreviation', 'Meaning', 'Category'].map(h => (
                  <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 700, color: 'var(--color-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(ABBREVIATION_MAP).map(([abbr, { meaning, category }], i) => {
                const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown
                return (
                  <tr key={abbr} style={{ background: i % 2 === 0 ? 'var(--color-white)' : 'rgba(0,0,0,0.01)' }}>
                    <td style={{ padding: '0.5rem 0.875rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: cfg.color }}>
                      {abbr.toUpperCase()}
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--color-ink)' }}>{meaning}</td>
                    <td style={{ padding: '0.5rem 0.875rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.4rem', borderRadius: '4px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
