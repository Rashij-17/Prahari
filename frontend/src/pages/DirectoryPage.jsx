import { useState, useEffect } from 'react'
import { searchProviders } from '../services/api.js'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProviderCard({ provider }) {
  const isOpen     = provider.open_now
  const statusColor = isOpen === true ? 'var(--color-safe)' : isOpen === false ? 'var(--color-critical)' : 'var(--color-faint)'
  
  const statusIcon = (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ marginRight: '0.375rem', display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="4" cy="4" r="4" fill={statusColor} />
    </svg>
  )
  
  const statusText = isOpen === true ? 'Open now' : isOpen === false ? 'Closed' : 'Hours unknown'

  const stars = (rating) => {
    const full = Math.floor(rating)
    return '★'.repeat(full) + '☆'.repeat(5 - full)
  }

  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  return (
    <a
      href={provider.maps_url}
      target="_blank"
      rel="noopener noreferrer"
      id={`provider-${provider.place_id}`}
      style={{ textDecoration: 'none', display: 'block', outline: 'none' }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="card"
        style={{
          padding:    '1.25rem',
          cursor:     'pointer',
          border:     `1.5px solid ${hovered || focused ? 'var(--color-forest)' : 'var(--color-border)'}`,
          transform:  hovered || focused ? 'translateY(-2px)' : 'none',
          boxShadow:  hovered || focused ? 'var(--shadow-md)' : 'var(--shadow-sm)',
          transition: 'var(--transition-standard)',
          backgroundColor: 'var(--color-white)',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.875rem' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 0.375rem' }}>
              {provider.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem', color: 'var(--color-muted)', margin: '0 0 0.5rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-faint)' }}>
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{provider.address || 'Address not available'}</span>
            </div>
            {provider.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem', color: 'var(--color-forest-light)', margin: '0 0 0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span style={{ fontWeight: 500 }}>{provider.phone}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'inline-flex', alignItems: 'center', fontWeight: 500 }}>
                {statusIcon}
                {statusText}
              </span>
              {provider.rating > 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-amber)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                  <span>{stars(provider.rating)}</span>
                  <span>{provider.rating.toFixed(1)}</span>
                  <span style={{ color: 'var(--color-faint)', fontWeight: 400 }}>({provider.total_ratings})</span>
                </span>
              )}
            </div>
          </div>

          {/* Distance badge */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
              padding:         '0.5rem 0.875rem',
              borderRadius:    '8px',
              backgroundColor: 'var(--color-forest-subtle)',
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              justifyContent:  'center',
              border:          '1px solid rgba(45, 90, 61, 0.15)'
            }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-forest)', lineHeight: 1.1 }}>
                {provider.distance_km.toFixed(1)}
              </span>
              <span style={{ fontSize: '0.625rem', color: 'var(--color-forest-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>km</span>
            </div>
            <p style={{ fontSize: '0.675rem', color: 'var(--color-muted)', margin: '0.375rem 0 0', textAlign: 'center', fontWeight: 500 }}>
              away
            </p>
          </div>
        </div>

        {/* Provider type chips */}
        {provider.types?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {provider.types.filter(t => !['point_of_interest', 'establishment'].includes(t)).map((t, i) => (
              <span key={i} className="chip chip-info" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}>
                {t.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const SPECIALTIES = [
  { label: 'General Physician', value: '' },
  { label: 'Cardiologist',      value: 'cardiologist' },
  { label: 'Paediatrician',     value: 'paediatrician' },
  { label: 'Dermatologist',     value: 'dermatologist' },
  { label: 'Gynaecologist',     value: 'gynaecologist' },
  { label: 'Neurologist',       value: 'neurologist' },
  { label: 'Orthopaedist',      value: 'orthopaedist' },
  { label: 'Psychiatrist',      value: 'psychiatrist' },
  { label: 'Hospital / A&E',    value: 'hospital emergency' },
  { label: 'Pharmacy',          value: 'pharmacy' },
]

export default function DirectoryPage() {
  const [phase,     setPhase]     = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_directory_state')
      if (saved) {
        const parsed = JSON.parse(saved)
        return (parsed.phase === 'locating' || parsed.phase === 'loading') ? 'idle' : (parsed.phase ?? 'idle')
      }
    } catch (e) {}
    return 'idle'
  })
  const [results,   setResults]   = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_directory_state')
      return saved ? (JSON.parse(saved).results ?? []) : []
    } catch (e) { return [] }
  })
  const [specialty, setSpecialty] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_directory_state')
      return saved ? (JSON.parse(saved).specialty ?? '') : ''
    } catch (e) { return '' }
  })
  const [radius,    setRadius]    = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_directory_state')
      return saved ? (JSON.parse(saved).radius ?? 5) : 5
    } catch (e) { return 5 }
  })
  const [error,     setError]     = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_directory_state')
      return saved ? (JSON.parse(saved).error ?? '') : ''
    } catch (e) { return '' }
  })
  const [isMock,    setIsMock]    = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_directory_state')
      return saved ? (JSON.parse(saved).isMock ?? false) : false
    } catch (e) { return false }
  })
  const [mockNote,  setMockNote]  = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_directory_state')
      return saved ? (JSON.parse(saved).mockNote ?? '') : ''
    } catch (e) { return '' }
  })

  // Sync state to localStorage
  useEffect(() => {
    try {
      const stateToSave = {
        phase,
        results,
        specialty,
        radius,
        error,
        isMock,
        mockNote,
      }
      localStorage.setItem('prahari_directory_state', JSON.stringify(stateToSave))
    } catch (e) {
      console.error('Failed to save directory state to localStorage:', e)
    }
  }, [phase, results, specialty, radius, error, isMock, mockNote])

  const locateAndSearch = () => {
    setPhase('locating')
    setError('')

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Please use a modern browser.')
      setPhase('error')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setPhase('loading')

        try {
          const data = await searchProviders({ lat, lng, specialty, radius_km: radius })
          setResults(data.providers || [])
          setIsMock(data.is_mock || false)
          setMockNote(data.mock_notice || '')
          setPhase('results')
        } catch (err) {
          setError(err.message || 'Provider search failed.')
          setPhase('error')
        }
      },
      (err) => {
        setError(
          err.code === 1
            ? 'Location access was denied. Please allow location access in your browser settings.'
            : 'Could not determine your location. Please try again.'
        )
        setPhase('error')
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  const reset = () => {
    setResults([])
    setPhase('idle')
    setError('')
    try {
      localStorage.removeItem('prahari_directory_state')
    } catch (e) {
      console.error('Failed to clear directory state from localStorage:', e)
    }
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>

      {/* Heading */}
      <div style={{ marginBottom: '1.75rem', textAlign: 'left' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', margin: '0 0 0.5rem' }}>
          Provider Directory
        </h1>
        <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '0.975rem', lineHeight: 1.6 }}>
          Find nearby doctors, clinics, and hospitals sorted by distance from your location.
        </p>
      </div>

      {/* === FILTER CONTROLS (always visible) === */}
      {phase !== 'locating' && phase !== 'loading' && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', backgroundColor: 'var(--color-white)', border: '1px solid var(--color-border)', textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {/* Specialty */}
            <div style={{ flex: 2, minWidth: '180px' }}>
              <label htmlFor="specialty-select" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-ink)' }}>
                Specialty
              </label>
              <select
                id="specialty-select"
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.875rem',
                  borderRadius: '9px',
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-white)',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  transition: 'var(--transition-fast)',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-forest)';
                  e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--color-border)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                {SPECIALTIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Radius */}
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label htmlFor="radius-select" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-ink)' }}>
                Radius
              </label>
              <select
                id="radius-select"
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.875rem',
                  borderRadius: '9px',
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-white)',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  transition: 'var(--transition-fast)',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-forest)';
                  e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--color-border)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value={2}>2 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
              </select>
            </div>
          </div>

          <button
            id="directory-search-btn"
            className="btn-primary"
            onClick={locateAndSearch}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            </svg>
            Use My Location & Search
          </button>
        </div>
      )}

      {/* === LOCATING / LOADING === */}
      {(phase === 'locating' || phase === 'loading') && (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <div className="pulse-ring" style={{ width: '64px', height: '64px', margin: '0 auto 1.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'locating' ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-forest)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-forest)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            )}
          </div>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9375rem', fontWeight: 500 }}>
            {phase === 'locating' ? 'Accessing your location…' : 'Searching for nearby providers…'}
          </p>
        </div>
      )}

      {/* === RESULTS === */}
      {phase === 'results' && (
        <div className="modal-enter">
          {/* Mock notice */}
          {isMock && mockNote && (
            <div style={{
              backgroundColor: 'var(--color-cream)',
              borderRadius: '10px',
              padding: '0.875rem 1.125rem',
              marginBottom: '1.25rem',
              fontSize: '0.85rem',
              color: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
              textAlign: 'left'
            }}>
              {mockNote}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-muted)', fontWeight: 500 }}>
              {results.length} provider{results.length !== 1 ? 's' : ''} found within {radius} km
            </p>
            <button
              className="btn-secondary"
              onClick={reset}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '8px' }}
            >
              ↺ New Search
            </button>
          </div>

          {results.length === 0 ? (
            <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', backgroundColor: 'var(--color-white)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 21V9a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v12" />
                  <path d="M3 21V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16" />
                  <path d="M14 13h1" />
                  <path d="M14 17h1" />
                </svg>
              </div>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', margin: 0 }}>
                No providers found within {radius} km. Try increasing the search radius.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {results.map((p, i) => (
                <ProviderCard key={p.place_id || i} provider={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* === ERROR === */}
      {phase === 'error' && (
        <div className="card ribbon-moderate" style={{ padding: '1.5rem', textAlign: 'left', backgroundColor: 'var(--color-white)', borderLeftWidth: '4px' }}>
          <h3 style={{ color: 'var(--color-warning)', margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
            Search failed
          </h3>
          <p style={{ color: 'var(--color-muted)', margin: '0 0 1.25rem', fontSize: '0.9375rem', lineHeight: 1.6 }}>{error}</p>
          <button id="directory-retry-btn" className="btn-primary" onClick={locateAndSearch}>Try Again</button>
        </div>
      )}
    </div>
  )
}
