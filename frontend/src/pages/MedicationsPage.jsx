/**
 * MedicationsPage — v2.0 (Enhanced UI + Responsive)
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import DrugProfileCard from '../components/medication/DrugProfileCard.jsx'
import { getMedicationProfile, searchMedications } from '../services/api.js'

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="card skeleton-pulse" style={{
      padding: '1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.625rem',
    }}>
      <div style={{ height: '1rem', width: '55%', background: 'var(--color-border)', borderRadius: '6px' }}/>
      <div style={{ height: '0.75rem', width: '35%', background: 'var(--color-border)', borderRadius: '6px' }}/>
      <div style={{ height: '0.75rem', width: '75%', background: 'var(--color-border)', borderRadius: '6px' }}/>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drug Result Item
// ---------------------------------------------------------------------------
function DrugResultItem({ drug, onSelect }) {
  const name     = drug.generic_name || drug.name || drug.brand_name || 'Unknown'
  const brand    = drug.brand_name && drug.brand_name !== name ? drug.brand_name : ''
  const route    = Array.isArray(drug.route) ? drug.route.join(', ') : ''
  const urgency  = drug.urgency_level || 'safe'
  const urgencyColor = {
    safe:     'var(--color-alert-safe)',
    moderate: 'var(--color-alert-moderate)',
    critical: 'var(--color-alert-critical)',
  }[urgency]

  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  return (
    <button
      onClick={() => onSelect(name)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width:           '100%',
        textAlign:       'left',
        background:      hovered ? 'var(--color-teal-subtle)' : 'var(--color-surface-card)',
        border:          `1.5px solid ${hovered || focused ? 'var(--color-teal)' : 'var(--color-border)'}`,
        borderRadius:    '12px',
        padding:         '0.875rem 1.125rem',
        cursor:          'pointer',
        transition:      'var(--transition-standard)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        gap:             '0.75rem',
        boxShadow:       hovered || focused ? 'var(--shadow-sm), 0 0 0 3px rgba(42, 127, 140, 0.2)' : 'none',
        outline:         'none',
      }}
    >
      <div>
        <p style={{ margin: '0 0 0.2rem', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9375rem' }}>
          {name}
        </p>
        {brand && (
          <p style={{ margin: '0 0 0.2rem', color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
            Brand: {brand}
          </p>
        )}
        {route && (
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
            Route: {route}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
        {drug.has_boxed_warning && (
          <span style={{ fontSize: '0.65rem', color: 'var(--color-alert-critical)', fontWeight: 700, letterSpacing: '0.02em', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            </svg>
            BLACK BOX
          </span>
        )}
        <span style={{ fontSize: '0.68rem', color: urgencyColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {urgency}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="var(--color-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const QUICK_SEARCHES = [
  'Metformin', 'Paracetamol', 'Amoxicillin', 'Omeprazole',
  'Ibuprofen', 'Aspirin', 'Atorvastatin', 'Losartan',
]

export default function MedicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParam = searchParams.get('search')

  const [phase,       setPhase]       = useState('idle')
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState([])
  const [profile,     setProfile]     = useState(null)
  const [profileName, setProfileName] = useState('')
  const [error,       setError]       = useState('')
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
    setProfileName(drugName)
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

      {/* Page Header */}
      {phase !== 'profile' && (
        <div className="page-header">
          <h1>Drug Intelligence</h1>
          <p>Search any medication to view indications, dosage, warnings, and interactions — sourced from openFDA and RxNorm.</p>
        </div>
      )}

      {/* Search Bar */}
      {phase !== 'profile' && (
        <div className="search-wrapper" style={{ marginBottom: '1.5rem' }}>
          <input
            id="medication-search-input"
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by drug name, brand, or ingredient…"
            aria-label="Search medications"
          />
          <button
            id="medication-search-btn"
            onClick={() => handleSearch()}
            disabled={query.length < 2}
            aria-label="Search"
            style={{
              position:   'absolute',
              right:      '0.75rem',
              background: 'none',
              border:     'none',
              cursor:     query.length < 2 ? 'not-allowed' : 'pointer',
              opacity:    query.length < 2 ? 0.35 : 1,
              padding:    '0.25rem',
              transition: 'var(--transition-fast)',
              transform:  query.length >= 2 ? 'scale(1.1)' : 'scale(1)',
              display:    'flex',
              alignItems: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: query.length < 2 ? 'var(--color-text-muted)' : 'var(--color-teal)' }}>
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>
      )}

      {/* Idle — Quick Searches */}
      {phase === 'idle' && (
        <div className="fade-in-up">
          <div className="section-label">Popular searches</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
            {QUICK_SEARCHES.map(name => (
              <button
                key={name}
                className="pill-btn"
                onClick={() => { setQuery(name); handleSearch(name) }}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Feature info cards */}
          <div className="grid-auto-fill" style={{ '--min': '220px' }}>
            {[
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4.5 16.5c-1.5 1.25-2.5 3-2.5 5.5"/>
                    <path d="M19.5 16.5c1.5 1.25 2.5 3 2.5 5.5"/>
                    <path d="M12 2a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4Z"/>
                    <path d="M8 10h8"/>
                  </svg>
                ),
                title: 'Clinical Data',
                desc: 'Indications, dosage, contraindications from FDA'
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-alert-moderate)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                ),
                title: 'Drug Interactions',
                desc: 'Pairwise interaction checks with severity tiers'
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                    <path d="m8.5 8.5 7 7"/>
                  </svg>
                ),
                title: 'Brand Lookup',
                desc: 'Resolve brand names to generic equivalents'
              },
            ].map(f => (
              <div key={f.title} className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>{f.icon}</div>
                <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.375rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {phase === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Results */}
      {phase === 'results' && (
        <div className="fade-in-up">
          <div className="section-label">{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</div>
          {results.length === 0 ? (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1rem' }}>No results found</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                No drugs found for "<strong>{query}</strong>". Try the generic name (e.g. "paracetamol" instead of "Calpol").
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {results.map((drug, idx) => (
                <DrugResultItem key={idx} drug={drug} onSelect={loadProfile} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile */}
      {phase === 'profile' && profile && (
        <DrugProfileCard profile={profile} onClose={backToResults} />
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="card ribbon-moderate modal-enter" style={{ padding: '1.5rem 1.5rem 1.5rem 1.875rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-alert-moderate)', margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Could not load results
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 1.25rem', fontSize: '0.875rem' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button id="medication-retry-btn" className="btn-primary btn-sm-auto" onClick={() => handleSearch()}>
              Retry
            </button>
            <button className="btn-secondary btn-sm-auto" onClick={() => { setPhase('idle'); setQuery('') }}>
              Clear Search
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
