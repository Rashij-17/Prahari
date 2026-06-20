/**
 * SubstitutePage.jsx — Module 5
 * ================================
 * Fuzzy Generic Salt / Substitute Finder.
 * Queries openFDA drug label API, deduplicates by generic name,
 * ranks by Levenshtein-based fuzzy relevance, and shows "Add to Cabinet" CTA.
 *
 * No API key required. Uses AbortController for stale query cancellation.
 * Results cached in sessionStorage.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FDA_BASE = 'https://api.fda.gov/drug/label.json'
const DEBOUNCE_MS = 400
const CACHE_PREFIX = 'prahari_fda_'

// Common Indian brand → generic mapping for fuzzy hints
const INDIAN_BRAND_MAP = {
  'crocin':     'paracetamol',
  'dolo':       'paracetamol',
  'calpol':     'paracetamol',
  'combiflam':  'ibuprofen paracetamol',
  'allegra':    'fexofenadine',
  'augmentin':  'amoxicillin clavulanate',
  'azithral':   'azithromycin',
  'zithromax':  'azithromycin',
  'pantocid':   'pantoprazole',
  'pan':        'pantoprazole',
  'rantac':     'ranitidine',
  'glycomet':   'metformin',
  'glucophage': 'metformin',
  'telma':      'telmisartan',
  'ecosprin':   'aspirin',
  'disprin':    'aspirin',
  'brufen':     'ibuprofen',
  'nurofen':    'ibuprofen',
  'norflox':    'norfloxacin',
  'cifran':     'ciprofloxacin',
  'clavam':     'amoxicillin clavulanate',
}

// ---------------------------------------------------------------------------
// Levenshtein Distance (fast iterative)
// ---------------------------------------------------------------------------
function levenshtein(a, b) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = 1 + Math.min(
          matrix[i - 1][j],
          matrix[i][j - 1],
          matrix[i - 1][j - 1],
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

/**
 * Compute relevance score for a drug result vs the query.
 * Returns { score: number, level: 'High'|'Medium'|'Low' }
 */
function computeRelevance(result, query) {
  const q = query.toLowerCase().trim()
  const names = [
    ...(result.openfda?.generic_name || []),
    ...(result.openfda?.brand_name || []),
    ...(result.openfda?.substance_name || []),
  ].map(n => n.toLowerCase())

  let minDist = Infinity
  for (const name of names) {
    const d = levenshtein(q, name.slice(0, q.length + 5))
    if (d < minDist) minDist = d
    // Bonus: starts-with
    if (name.startsWith(q)) minDist = 0
    // Bonus: contains
    if (name.includes(q)) minDist = Math.min(minDist, 1)
  }

  const ratio = minDist / Math.max(q.length, 1)
  const level = ratio <= 0.15 ? 'High' : ratio <= 0.45 ? 'Medium' : 'Low'
  return { score: minDist, level }
}

// ---------------------------------------------------------------------------
// FDA API Fetch (dual queries + merge)
// ---------------------------------------------------------------------------
async function fetchFDAResults(query, signal) {
  const enc = encodeURIComponent(query)

  // Check brand map
  const brandHint = INDIAN_BRAND_MAP[query.toLowerCase().trim()]
  const searchQuery = brandHint || query

  const urls = [
    `${FDA_BASE}?search=active_ingredient:"${encodeURIComponent(searchQuery)}"&limit=5`,
    `${FDA_BASE}?search=openfda.brand_name:"${enc}"&limit=5`,
    `${FDA_BASE}?search=openfda.generic_name:"${enc}"&limit=5`,
  ]

  const fetches = urls.map(url =>
    fetch(url, { signal })
      .then(r => r.ok ? r.json() : Promise.resolve({ results: [] }))
      .catch(() => ({ results: [] }))
  )

  const responses = await Promise.all(fetches)
  const allResults = responses.flatMap(r => r.results || [])

  // Deduplicate by generic_name
  const seen = new Set()
  const deduped = []
  for (const r of allResults) {
    const key = (r.openfda?.generic_name?.[0] || r.openfda?.brand_name?.[0] || Math.random()).toString().toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(r)
    }
  }

  return deduped
}

// ---------------------------------------------------------------------------
// SessionStorage cache helpers
// ---------------------------------------------------------------------------
function getCached(query) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + query)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function setCached(query, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + query, JSON.stringify(data))
  } catch {}
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icon = {
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Plus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Pill: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
    </svg>
  ),
  Factory: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
    </svg>
  ),
  External: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Result Card
// ---------------------------------------------------------------------------
function DrugResultCard({ result, query, onAddToCabinet }) {
  const genericNames = result.openfda?.generic_name || []
  const brandNames = result.openfda?.brand_name || []
  const manufacturers = result.openfda?.manufacturer_name || []
  const activeIngredient = result.active_ingredient?.[0]
  const route = result.openfda?.route?.[0] || ''

  const primaryName = genericNames[0] || activeIngredient || brandNames[0] || 'Unknown'
  const { level } = computeRelevance(result, query)

  const levelConfig = {
    High:   { color: '#16a34a', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.25)' },
    Medium: { color: '#d97706', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
    Low:    { color: 'var(--color-faint)', bg: 'var(--color-cream)', border: 'var(--color-border)' },
  }
  const cfg = levelConfig[level]

  return (
    <div style={{
      background: 'var(--color-white)',
      border: '1.5px solid var(--color-border)',
      borderRadius: '14px',
      padding: '1.125rem 1.25rem',
      boxShadow: 'var(--shadow-xs)',
      transition: 'box-shadow 200ms ease, border-color 200ms ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: 'rgba(99,102,241,0.08)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon.Pill />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' }}>
              {primaryName.split(';')[0].trim()}
            </span>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem',
              borderRadius: '5px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {level} Match
            </span>
          </div>
          {route && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-faint)' }}>{route}</div>
          )}
        </div>
      </div>

      {/* Generic names */}
      {genericNames.length > 0 && (
        <div style={{ marginBottom: '0.625rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-faint)', marginBottom: '0.3rem' }}>
            Generic Name(s)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {genericNames.slice(0, 3).map((n, i) => (
              <span key={i} className="chip chip-info" style={{ fontSize: '0.75rem' }}>{n.split(';')[0].trim()}</span>
            ))}
          </div>
        </div>
      )}

      {/* Brand names */}
      {brandNames.length > 0 && (
        <div style={{ marginBottom: '0.625rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-faint)', marginBottom: '0.3rem' }}>
            Brand Names
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {brandNames.slice(0, 5).map((b, i) => (
              <span key={i} className="chip chip-neutral" style={{ fontSize: '0.75rem' }}>{b}</span>
            ))}
            {brandNames.length > 5 && (
              <span className="chip chip-neutral" style={{ fontSize: '0.75rem' }}>+{brandNames.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {/* Manufacturer */}
      {manufacturers.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.875rem' }}>
          <Icon.Factory />
          {manufacturers[0]}
          {manufacturers.length > 1 && <span style={{ color: 'var(--color-faint)' }}>+{manufacturers.length - 1} more</span>}
        </div>
      )}

      {/* Active ingredient hint */}
      {activeIngredient && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-faint)', marginBottom: '0.875rem', fontStyle: 'italic', lineHeight: 1.4 }}>
          Active: {activeIngredient.slice(0, 100)}{activeIngredient.length > 100 ? '…' : ''}
        </div>
      )}

      {/* Add to Cabinet */}
      <button
        onClick={() => onAddToCabinet(primaryName)}
        aria-label={`Add ${primaryName} to Medicine Cabinet`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 1rem', borderRadius: '8px',
          border: '1.5px solid rgba(99,102,241,0.35)',
          background: 'rgba(99,102,241,0.06)', color: '#6366f1',
          fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
          cursor: 'pointer', transition: 'var(--transition-fast)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; e.currentTarget.style.borderColor = '#6366f1' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)' }}
      >
        <Icon.Plus /> Add to Cabinet
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
const POPULAR = ['Metformin', 'Paracetamol', 'Amoxicillin', 'Ibuprofen', 'Aspirin', 'Atorvastatin', 'Amlodipine', 'Pantoprazole']

export default function SubstitutePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | success | error | empty
  const [errorMsg, setErrorMsg] = useState('')
  const abortRef = useRef(null)
  const debounceRef = useRef(null)

  const search = useCallback(async (q) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) { setStatus('idle'); setResults([]); return }

    // Check cache first
    const cached = getCached(trimmed)
    if (cached) {
      setResults(cached)
      setStatus(cached.length ? 'success' : 'empty')
      return
    }

    // Cancel previous in-flight
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setStatus('loading')
    setErrorMsg('')

    try {
      const data = await fetchFDAResults(trimmed, abortRef.current.signal)
      const sorted = [...data].sort((a, b) => {
        const ra = computeRelevance(a, trimmed)
        const rb = computeRelevance(b, trimmed)
        return ra.score - rb.score
      })
      setCached(trimmed, sorted)
      setResults(sorted)
      setStatus(sorted.length > 0 ? 'success' : 'empty')
    } catch (err) {
      if (err.name === 'AbortError') return // Stale, ignore
      setErrorMsg('Unable to reach openFDA. Try again or search by active ingredient.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query, search])

  const handleAddToCabinet = (name) => {
    window.location.href = `/cabinet?prefill=${encodeURIComponent(name)}`
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🔍</span> Generic Substitute Finder
        </h1>
        <p>Search any medicine or active ingredient to find cheaper generic alternatives — powered by the US FDA drug label database.</p>
      </div>

      {/* Indian brand name hint */}
      <div style={{
        background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
        fontSize: '0.825rem', color: 'var(--color-muted)', lineHeight: 1.5,
      }}>
        💡 <strong style={{ color: '#6366f1' }}>Indian brand tip:</strong> Try "Crocin" → Paracetamol, "Combiflam" → Ibuprofen+Paracetamol, "Glycomet" → Metformin, "Pantocid" → Pantoprazole
      </div>

      {/* Search Bar */}
      <div className="search-wrapper" style={{ marginBottom: '1.25rem' }}>
        <div style={{ position: 'absolute', left: '1rem', color: 'var(--color-faint)', display: 'flex', zIndex: 1 }}>
          <Icon.Search />
        </div>
        <input
          id="substitute-search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search medicine or active ingredient…"
          aria-label="Search medicine or active ingredient"
          style={{ paddingLeft: '2.75rem' }}
          autoComplete="off"
        />
        {status === 'loading' && (
          <div style={{ position: 'absolute', right: '1rem', display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '16px', height: '16px', border: '2px solid var(--color-border)',
              borderTopColor: '#6366f1', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Popular searches */}
      {status === 'idle' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-label">Popular searches</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {POPULAR.map(name => (
              <button key={name} onClick={() => setQuery(name)} className="pill-btn">{name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {status === 'success' && (
        <div className="fade-in-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <div className="section-label" style={{ margin: 0 }}>
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </div>
            <a
              href={`https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(query)}"&limit=5`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.75rem', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              View raw FDA data <Icon.External />
            </a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {results.map((r, i) => (
              <DrugResultCard
                key={i}
                result={r}
                query={query}
                onAddToCabinet={handleAddToCabinet}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {status === 'empty' && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1.5px dashed var(--color-border)', borderRadius: '14px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔬</div>
          <h3 style={{ color: 'var(--color-ink)', fontSize: '1rem', marginBottom: '0.5rem' }}>No results found for "{query}"</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Try searching by the active ingredient instead (e.g., "Paracetamol" instead of "Crocin").
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
            {['paracetamol', 'metformin', 'ibuprofen'].map(s => (
              <button key={s} onClick={() => setQuery(s)} className="pill-btn" style={{ fontSize: '0.8rem' }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <h3 style={{ color: 'var(--color-warning)', margin: '0 0 0.375rem', fontSize: '0.9rem' }}>Could not reach openFDA</h3>
          <p style={{ color: 'var(--color-muted)', margin: '0 0 0.875rem', fontSize: '0.85rem' }}>{errorMsg}</p>
          <button onClick={() => search(query)} style={{ fontSize: '0.8125rem', padding: '0.45rem 1rem', borderRadius: '8px', border: '1.5px solid var(--color-warning)', background: 'transparent', color: 'var(--color-warning)', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Data disclaimer */}
      <div style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--color-faint)', lineHeight: 1.5, padding: '0.75rem', background: 'var(--color-cream)', borderRadius: '8px' }}>
        <strong>Data source:</strong> openFDA Drug Label API (public domain). Results reflect US FDA labeling and may not directly correspond to Indian drug formulations. Always consult your pharmacist or doctor before switching medications.
      </div>
    </div>
  )
}
