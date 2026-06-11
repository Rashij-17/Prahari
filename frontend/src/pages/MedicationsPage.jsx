/**
 * MedicationsPage
 * ================
 * The Drug Intelligence hub — search for any drug by name and view
 * its full clinical profile from openFDA + RxNorm.
 *
 * States:
 *   idle     → Search bar prompt
 *   loading  → Skeleton loader during API call
 *   results  → List of matching drug summaries
 *   profile  → Full DrugProfileCard for a selected drug
 *   error    → Error state with retry
 *
 * Source: FEATURES_AND_STRUCTURE.md §2.2 (Drug Intelligence Module)
 */

import { useState, useRef, useCallback } from 'react'
import DrugProfileCard from '../components/medication/DrugProfileCard.jsx'
import { getMedicationProfile, searchMedications } from '../services/api.js'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated skeleton card shown during search/load */
function SkeletonCard() {
  return (
    <div className="card skeleton-pulse" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ height: '1rem', width: '60%', backgroundColor: 'var(--color-border)', borderRadius: '4px' }} />
      <div style={{ height: '0.75rem', width: '40%', backgroundColor: 'var(--color-border)', borderRadius: '4px' }} />
      <div style={{ height: '0.75rem', width: '80%', backgroundColor: 'var(--color-border)', borderRadius: '4px' }} />
    </div>
  )
}

/** Individual drug result card in the search list */
function DrugResultItem({ drug, onSelect }) {
  const name        = drug.generic_name || drug.name || drug.brand_name || 'Unknown'
  const brand       = drug.brand_name && drug.brand_name !== name ? drug.brand_name : ''
  const route       = Array.isArray(drug.route) ? drug.route.join(', ') : ''
  const urgency     = drug.urgency_level || 'safe'
  const urgencyColor = { safe: 'var(--color-sage)', moderate: 'var(--color-alert-moderate)', critical: 'var(--color-alert-critical)' }[urgency]

  return (
    <button
      onClick={() => onSelect(name)}
      style={{
        width:           '100%',
        textAlign:       'left',
        background:      'var(--color-surface-card)',
        border:          '1px solid var(--color-border)',
        borderRadius:    '10px',
        padding:         '0.875rem 1.125rem',
        cursor:          'pointer',
        transition:      'all 150ms ease-in-out',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        gap:             '0.75rem',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-teal)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(42,127,140,0.12)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div>
        <p style={{ margin: '0 0 0.2rem', fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
          {name}
        </p>
        {brand && (
          <p style={{ margin: '0 0 0.2rem', color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
            Brand: {brand}
          </p>
        )}
        {route && (
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
            Route: {route}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
        {drug.has_boxed_warning && (
          <span style={{ fontSize: '0.65rem', color: 'var(--color-alert-critical)', fontWeight: 700 }}>⬛ BLACK BOX</span>
        )}
        <span style={{ fontSize: '0.7rem', color: urgencyColor, fontWeight: 600, textTransform: 'uppercase' }}>
          {urgency}
        </span>
        <span style={{ color: 'var(--color-teal)', fontSize: '1rem' }}>→</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function MedicationsPage() {
  const [phase,       setPhase]       = useState('idle')
  // Phases: 'idle' | 'loading' | 'results' | 'profile' | 'error'

  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState([])
  const [profile,     setProfile]     = useState(null)
  const [profileName, setProfileName] = useState('')
  const [error,       setError]       = useState('')
  const inputRef = useRef(null)

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  // ---------------------------------------------------------------------------
  // Profile Load
  // ---------------------------------------------------------------------------

  const loadProfile = useCallback(async (drugName) => {
    setPhase('loading')
    setProfileName(drugName)
    setError('')

    try {
      const data = await getMedicationProfile(drugName)
      setProfile(data)
      setPhase('profile')
    } catch (err) {
      if (err.message?.includes('404')) {
        setError(`No clinical data found for "${drugName}". Try searching by the generic name.`)
      } else {
        setError(err.message || 'Could not load drug profile.')
      }
      setPhase('error')
    }
  }, [])

  const backToResults = () => {
    setProfile(null)
    setPhase(results.length > 0 ? 'results' : 'idle')
  }

  // ---------------------------------------------------------------------------
  // Popular Quick Searches
  // ---------------------------------------------------------------------------

  const QUICK_SEARCHES = [
    'Metformin', 'Paracetamol', 'Amoxicillin', 'Omeprazole',
    'Ibuprofen', 'Aspirin', 'Atorvastatin', 'Losartan',
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>

      {/* Page heading (always visible unless viewing profile) */}
      {phase !== 'profile' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize:   '1.75rem',
            color:      'var(--color-text-primary)',
            margin:     '0 0 0.375rem',
          }}>
            Drug Intelligence
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Search any medication to view indications, dosage, warnings, and interactions — sourced from openFDA and RxNorm.
          </p>
        </div>
      )}

      {/* === SEARCH BAR (visible except on profile) === */}
      {phase !== 'profile' && (
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <input
            id="medication-search-input"
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by drug name, brand, or ingredient…"
            aria-label="Search medications"
            style={{
              width:           '100%',
              padding:         '0.875rem 3.5rem 0.875rem 1.125rem',
              borderRadius:    '10px',
              border:          '1.5px solid var(--color-border)',
              backgroundColor: 'var(--color-surface-card)',
              color:           'var(--color-text-primary)',
              fontFamily:      'var(--font-sans)',
              fontSize:        '0.95rem',
              outline:         'none',
              boxSizing:       'border-box',
              transition:      'border-color 150ms ease',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--color-teal)'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button
            id="medication-search-btn"
            onClick={() => handleSearch()}
            disabled={query.length < 2}
            aria-label="Search"
            style={{
              position:        'absolute',
              right:           '0.75rem',
              top:             '50%',
              transform:       'translateY(-50%)',
              background:      'none',
              border:          'none',
              cursor:          query.length < 2 ? 'not-allowed' : 'pointer',
              fontSize:        '1.25rem',
              opacity:         query.length < 2 ? 0.4 : 1,
              padding:         '0.25rem',
            }}
          >
            🔍
          </button>
        </div>
      )}

      {/* === IDLE — Quick searches === */}
      {phase === 'idle' && (
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
            Popular searches:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {QUICK_SEARCHES.map(name => (
              <button
                key={name}
                onClick={() => { setQuery(name); handleSearch(name) }}
                style={{
                  padding:         '0.4rem 0.875rem',
                  borderRadius:    '999px',
                  border:          '1px solid var(--color-border)',
                  background:      'var(--color-surface-card)',
                  color:           'var(--color-text-secondary)',
                  fontSize:        '0.825rem',
                  cursor:          'pointer',
                  transition:      'all 120ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-teal)'; e.currentTarget.style.color = 'var(--color-teal)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* === LOADING === */}
      {phase === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* === RESULTS === */}
      {phase === 'results' && (
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </p>
          {results.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔎</div>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                No drugs found for "<strong>{query}</strong>". Try the generic name (e.g. "paracetamol" instead of "Calpol").
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {results.map((drug, idx) => (
                <DrugResultItem
                  key={idx}
                  drug={drug}
                  onSelect={loadProfile}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* === PROFILE === */}
      {phase === 'profile' && profile && (
        <DrugProfileCard profile={profile} onClose={backToResults} />
      )}

      {/* === ERROR === */}
      {phase === 'error' && (
        <div className="card ribbon-moderate" style={{ padding: '1.25rem 1.25rem 1.25rem 1.75rem' }}>
          <h3 style={{ color: 'var(--color-alert-moderate)', margin: '0 0 0.5rem' }}>Could not load results</h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 1rem', fontSize: '0.9rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button id="medication-retry-btn" className="btn-primary" onClick={() => handleSearch()}>Retry</button>
            <button className="btn-secondary" onClick={() => { setPhase('idle'); setQuery('') }}>Clear Search</button>
          </div>
        </div>
      )}

    </div>
  )
}
