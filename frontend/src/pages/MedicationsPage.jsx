/**
 * MedicationsPage — v3.0 "Warm Rx"
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import DrugProfileCard from '../components/medication/DrugProfileCard.jsx'
import { getMedicationProfile, searchMedications } from '../services/api.js'
import foodSafetyData from '../components/medication/food_drug_safety.json'

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icons = {
  Search: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Arrow: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Flask: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 2v6.5L4.5 17a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L15 8.5V2"/>
      <line x1="7" y1="2" x2="17" y2="2"/>
    </svg>
  ),
  Alert: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 9v4M12 17h.01"/>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    </svg>
  ),
  Pill: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m14.5 17.5 5-5"/>
      <circle cx="18" cy="18" r="4"/>
      <circle cx="7" cy="7" r="4"/>
    </svg>
  ),
  Empty: (p) => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  Box: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="1"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="card skeleton-pulse" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <div style={{ height: '1rem', width: '55%', background: 'var(--color-border)', borderRadius: '6px' }} />
      <div style={{ height: '0.75rem', width: '35%', background: 'var(--color-border)', borderRadius: '6px' }} />
      <div style={{ height: '0.75rem', width: '75%', background: 'var(--color-border)', borderRadius: '6px' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drug Result Item
// ---------------------------------------------------------------------------
function DrugResultItem({ drug, onSelect }) {
  const name   = drug.generic_name || drug.name || drug.brand_name || 'Unknown'
  const brand  = drug.brand_name && drug.brand_name !== name ? drug.brand_name : ''
  const route  = Array.isArray(drug.route) ? drug.route.join(', ') : ''
  const urgency = drug.urgency_level || 'safe'
  const urgencyColor = {
    safe: 'var(--color-safe)', moderate: 'var(--color-warning)', critical: 'var(--color-critical)',
  }[urgency]

  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const active = hovered || focused

  const hasDietWarning = () => {
    if (!name && !brand) return false;
    const genericKey = name ? name.toLowerCase().trim() : '';
    const brandKey = brand ? brand.toLowerCase().trim() : '';
    
    if (foodSafetyData[genericKey] || foodSafetyData[brandKey]) return true;
    
    const cleanRegex = (str) => {
      let s = str.replace(/\[.*?\]/g, '').trim().toLowerCase();
      s = s.replace(/\b\d+(?:\.\d+)?\s*(?:mg|ml|%|g|mcg|units|iu|tab|cap|puff|dose)\b/gi, '');
      s = s.replace(/\b\d+(?:\.\d+)?\b/g, '');
      let match = s.match(/^[a-z]+/i);
      return match ? match[0].trim() : s.trim();
    };
    
    const cleanGen = cleanRegex(name);
    const cleanBrand = cleanRegex(brand);
    
    if (foodSafetyData[cleanGen] || foodSafetyData[cleanBrand]) return true;
    
    for (const key of Object.keys(foodSafetyData)) {
      if (cleanGen && (cleanGen.startsWith(key) || cleanGen.includes(key))) return true;
      if (cleanBrand && (cleanBrand.startsWith(key) || cleanBrand.includes(key))) return true;
    }
    return false;
  };

  return (
    <button
      onClick={() => {
        const rxcuiStr = Array.isArray(drug.rxcui) ? drug.rxcui[0] : drug.rxcui;
        const isLocal = typeof rxcuiStr === 'string' && rxcuiStr.startsWith('local_');
        onSelect(isLocal ? (drug.brand_name || drug.name) : name);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', textAlign: 'left',
        background: active ? 'var(--color-forest-subtle)' : 'var(--color-white)',
        border: `1.5px solid ${active ? 'var(--color-forest)' : 'var(--color-border)'}`,
        borderRadius: '12px', padding: '1rem 1.125rem', cursor: 'pointer',
        transition: 'var(--transition-standard)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '0.75rem',
        boxShadow: active ? 'var(--shadow-sm)' : 'none', outline: 'none',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-ink)', fontSize: '0.9375rem', fontFamily: 'var(--font-sans)' }}>
            {name}
          </p>
          {hasDietWarning() && (
            <span className="chip chip-moderate" style={{
              fontSize: '0.65rem',
              padding: '0.15rem 0.45rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              borderRadius: '4px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              lineHeight: 1
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/>
              </svg>
              Diet Warning
            </span>
          )}
        </div>
        {brand && (
          <p style={{ margin: '0 0 0.2rem', color: 'var(--color-muted)', fontSize: '0.8125rem' }}>Brand: {brand}</p>
        )}
        {route && (
          <p style={{ margin: 0, color: 'var(--color-faint)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Icons.Box /> {route}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem', flexShrink: 0 }}>
        {drug.has_boxed_warning && (
          <span style={{ fontSize: '0.65rem', color: 'var(--color-critical)', fontWeight: 700, letterSpacing: '0.02em' }}>
            BLACK BOX
          </span>
        )}
        <span style={{ fontSize: '0.68rem', color: urgencyColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {urgency}
        </span>
        <Icons.Arrow style={{ color: 'var(--color-forest)' }} />
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const QUICK_SEARCHES = ['Metformin', 'Paracetamol', 'Amoxicillin', 'Omeprazole', 'Ibuprofen', 'Aspirin', 'Atorvastatin', 'Losartan']

export default function MedicationsPage() {
  const [searchParams] = useSearchParams()
  const searchParam = searchParams.get('search')

  const [phase, setPhase] = useState('idle')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleSearch = useCallback(async (searchQuery) => {
    const q = (searchQuery || query).trim()
    if (q.length < 2) return
    setPhase('loading')
    setError('')
    setResults([])
    setProfile(null)
    try {
      const data = await searchMedications(q)
      setResults(data.results || [])
      setPhase('results')
    } catch (err) {
      setError(err.message || 'Search failed. Check your connection and try again.')
      setPhase('error')
    }
  }, [query])

  useEffect(() => {
    if (searchParam) {
      setQuery(searchParam)
      handleSearch(searchParam)
    }
  }, [searchParam, handleSearch])

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch() }

  const loadProfile = useCallback(async (drugName) => {
    setPhase('loading')
    setError('')
    try {
      const data = await getMedicationProfile(drugName)
      setProfile(data)
      setPhase('profile')
    } catch (err) {
      setError(err.message?.includes('404')
        ? `No clinical data found for "${drugName}". Try the generic name.`
        : err.message || 'Could not load drug profile.')
      setPhase('error')
    }
  }, [])

  const backToResults = () => {
    setProfile(null)
    setPhase(results.length > 0 ? 'results' : 'idle')
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>

      {phase !== 'profile' && (
        <div className="page-header">
          <h1>Drug Intelligence</h1>
          <p>Search any medication to view indications, dosage, warnings, and interactions — sourced from openFDA and RxNorm.</p>
        </div>
      )}

      {phase !== 'profile' && (
        <div className="search-wrapper" style={{ marginBottom: '1.75rem' }}>
          <input
            id="medication-search-input" ref={inputRef} type="search" value={query}
            onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Search by drug name, brand, or ingredient…" aria-label="Search medications"
          />
          <button
            id="medication-search-btn" onClick={() => handleSearch()} disabled={query.length < 2}
            aria-label="Search"
            style={{
              position: 'absolute', right: '0.75rem', background: 'none', border: 'none',
              cursor: query.length < 2 ? 'not-allowed' : 'pointer', color: 'var(--color-forest)',
              opacity: query.length < 2 ? 0.35 : 1, padding: '0.25rem',
              transition: 'var(--transition-fast)', display: 'flex',
            }}
          >
            <Icons.Search />
          </button>
        </div>
      )}

      {phase === 'idle' && (
        <div className="fade-in-up">
          <div className="section-label">Popular searches</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2.25rem' }}>
            {QUICK_SEARCHES.map(name => (
              <button key={name} className="pill-btn" onClick={() => { setQuery(name); handleSearch(name) }}>
                {name}
              </button>
            ))}
          </div>

          {/* Diet Safety Guard Callout Box */}
          <div style={{
            margin: '0 0 2.25rem',
            padding: '1.25rem 1.5rem',
            borderRadius: '14px',
            borderLeft: '4.5px solid var(--color-amber)',
            backgroundColor: 'var(--color-amber-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.875rem',
            textAlign: 'left'
          }}>
            <div style={{ color: 'var(--color-amber)', display: 'flex', flexShrink: 0, marginTop: '0.125rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 0.25rem', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                Offline Diet Safety Guard Active
              </h4>
              <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--color-muted)', lineHeight: 1.55 }}>
                Prahari now cross-references searches with a local database of 3,600+ entries to identify dietary contraindications (e.g., grapefruit warnings for <strong>Atorvastatin</strong>, spinach warnings for <strong>Warfarin</strong>).
              </p>
            </div>
          </div>

          <div className="grid-auto-fill">
            {[
              { Icon: Icons.Flask, title: 'Clinical data', desc: 'Indications, dosage, contraindications from FDA' },
              { Icon: Icons.Alert, title: 'Drug interactions', desc: 'Pairwise interaction checks with severity tiers' },
              { Icon: Icons.Pill, title: 'Brand lookup', desc: 'Resolve brand names to generic equivalents' },
            ].map(f => (
              <div key={f.title} className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-forest-subtle)',
                  color: 'var(--color-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 0.875rem',
                }}>
                  <f.Icon />
                </div>
                <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.375rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {phase === 'results' && (
        <div className="fade-in-up">
          <div className="section-label">{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</div>
          {results.length === 0 ? (
            <div className="card" style={{ padding: '2.75rem', textAlign: 'center' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '14px', background: 'var(--color-cream)',
                color: 'var(--color-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <Icons.Empty />
              </div>
              <h3 style={{ color: 'var(--color-ink)', fontSize: '1rem' }}>No results found</h3>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                No drugs found for "<strong>{query}</strong>". Try the generic name (e.g. "paracetamol" instead of "Calpol").
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {results.map((drug, idx) => <DrugResultItem key={idx} drug={drug} onSelect={loadProfile} />)}
            </div>
          )}
        </div>
      )}

      {phase === 'profile' && profile && (
        <DrugProfileCard profile={profile} onClose={backToResults} />
      )}

      {phase === 'error' && (
        <div className="card ribbon-moderate modal-enter" style={{ padding: '1.75rem 1.75rem 1.75rem 2rem' }}>
          <h3 style={{ color: 'var(--color-warning)', margin: '0 0 0.5rem', fontSize: '1rem', fontFamily: 'var(--font-sans)' }}>
            Could not load results
          </h3>
          <p style={{ color: 'var(--color-muted)', margin: '0 0 1.25rem', fontSize: '0.875rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button id="medication-retry-btn" className="btn-primary btn-sm-auto" onClick={() => handleSearch()}>Retry</button>
            <button className="btn-secondary btn-sm-auto" onClick={() => { setPhase('idle'); setQuery('') }}>Clear Search</button>
          </div>
        </div>
      )}
    </div>
  )
}
