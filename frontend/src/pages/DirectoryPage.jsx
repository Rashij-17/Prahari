import { useState } from 'react'
import { searchProviders } from '../services/api.js'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProviderCard({ provider }) {
  const isOpen     = provider.open_now
  const statusIcon = isOpen === true ? (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ marginRight: '0.375rem', display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="4" cy="4" r="4" fill="var(--color-alert-safe)" />
    </svg>
  ) : isOpen === false ? (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ marginRight: '0.375rem', display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="4" cy="4" r="4" fill="var(--color-alert-critical)" />
    </svg>
  ) : (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ marginRight: '0.375rem', display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="4" cy="4" r="4" fill="var(--color-text-muted)" />
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
          padding:    '1rem 1.125rem',
          cursor:     'pointer',
          border:     `1.5px solid ${hovered || focused ? 'var(--color-teal)' : 'var(--color-border)'}`,
          transform:  hovered || focused ? 'translateY(-2px)' : 'none',
          boxShadow:  hovered || focused ? 'var(--shadow-md), 0 0 0 3px rgba(42, 127, 140, 0.2)' : 'none',
          transition: 'var(--transition-standard)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 0.25rem' }}>
              {provider.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0 0 0.375rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-text-muted)' }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{provider.address || 'Address not available'}</span>
            </div>
            {provider.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--color-teal)', margin: '0 0 0.375rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>{provider.phone}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center' }}>
                {statusIcon}
                {statusText}
              </span>
              {provider.rating > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#F5A623', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>{stars(provider.rating)}</span>
                  <span>{provider.rating.toFixed(1)}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>({provider.total_ratings})</span>
                </span>
              )}
            </div>
          </div>

          {/* Distance badge */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
              width:           '56px',
              height:          '56px',
              borderRadius:    '50%',
              backgroundColor: 'var(--color-alert-safe-bg)',
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              justifyContent:  'center',
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-alert-safe)', lineHeight: 1.1 }}>
                {provider.distance_km.toFixed(1)}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--color-alert-safe)' }}>km</span>
            </div>
            <p style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0', textAlign: 'center' }}>
              away
            </p>
          </div>
        </div>

        {/* Provider type chips */}
        {provider.types?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
            {provider.types.filter(t => !['point_of_interest', 'establishment'].includes(t)).map((t, i) => (
              <span key={i} className="chip chip-info" style={{ fontSize: '0.65rem' }}>
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
  const [phase,     setPhase]     = useState('idle')
  const [results,   setResults]   = useState([])
  const [specialty, setSpecialty] = useState('')
  const [radius,    setRadius]    = useState(5)
  const [error,     setError]     = useState('')
  const [isMock,    setIsMock]    = useState(false)
  const [mockNote,  setMockNote]  = useState('')

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
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>

      {/* Heading */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--color-text-primary)', margin: '0 0 0.375rem' }}>
          Provider Directory
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
          Find nearby doctors, clinics, and hospitals sorted by distance from your location.
        </p>
      </div>

      {/* === FILTER CONTROLS (always visible) === */}
      {phase !== 'locating' && phase !== 'loading' && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {/* Specialty */}
            <div style={{ flex: 2, minWidth: '180px' }}>
              <label htmlFor="specialty-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-text-primary)' }}>
                Specialty
              </label>
              <select
                id="specialty-select"
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-teal)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(42, 127, 140, 0.2)';
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
              <label htmlFor="radius-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-text-primary)' }}>
                Radius
              </label>
              <select
                id="radius-select"
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-teal)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(42, 127, 140, 0.2)';
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
            Use My Location & Search
          </button>
        </div>
      )}

      {/* === LOCATING / LOADING === */}
      {(phase === 'locating' || phase === 'loading') && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div className="pulse-ring" style={{ width: '56px', height: '56px', margin: '0 auto 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'locating' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            )}
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
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
              backgroundColor: 'var(--color-beige)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              color: 'var(--color-text-secondary)',
            }}>
              {mockNote}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              {results.length} provider{results.length !== 1 ? 's' : ''} found within {radius} km
            </p>
            <button
              className="btn-secondary"
              onClick={reset}
              style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
            >
              ↺ New Search
            </button>
          </div>

          {results.length === 0 ? (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 21V9a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v12" />
                  <path d="M3 21V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16" />
                  <path d="M14 13h1" />
                  <path d="M14 17h1" />
                </svg>
              </div>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                No providers found within {radius} km. Try increasing the search radius.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {results.map((p, i) => (
                <ProviderCard key={p.place_id || i} provider={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* === ERROR === */}
      {phase === 'error' && (
        <div className="card ribbon-moderate" style={{ padding: '1.25rem 1.25rem 1.25rem 1.75rem' }}>
          <h3 style={{ color: 'var(--color-alert-moderate)', margin: '0 0 0.5rem', fontSize: '1rem' }}>
            Search failed
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 1rem', fontSize: '0.9rem' }}>{error}</p>
          <button id="directory-retry-btn" className="btn-primary" onClick={locateAndSearch}>Try Again</button>
        </div>
      )}
    </div>
  )
}
