/**
 * DirectoryPage
 * ==============
 * Nearby healthcare provider search using the user's geolocation.
 * Integrates with Google Places API via the backend /directory/search endpoint.
 *
 * States: idle → locating → loading → results | error
 * Source: FEATURES_AND_STRUCTURE.md §2.4
 */

import { useState } from 'react'
import { searchProviders } from '../services/api.js'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProviderCard({ provider }) {
  const isOpen     = provider.open_now
  const openStatus = isOpen === true ? '🟢 Open now' : isOpen === false ? '🔴 Closed' : '⚪ Hours unknown'

  const stars = (rating) => {
    const full = Math.floor(rating)
    return '★'.repeat(full) + '☆'.repeat(5 - full)
  }

  return (
    <a
      href={provider.maps_url}
      target="_blank"
      rel="noopener noreferrer"
      id={`provider-${provider.place_id}`}
      style={{ textDecoration: 'none' }}
    >
      <div
        className="card"
        style={{
          padding:    '1rem 1.125rem',
          cursor:     'pointer',
          transition: 'all 150ms ease-in-out',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-teal)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 0.25rem' }}>
              {provider.name}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0 0 0.375rem' }}>
              📍 {provider.address || 'Address not available'}
            </p>
            {provider.phone && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-teal)', margin: '0 0 0.375rem' }}>
                📞 {provider.phone}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{openStatus}</span>
              {provider.rating > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#F5A623' }}>
                  {stars(provider.rating)} {provider.rating.toFixed(1)} ({provider.total_ratings})
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
          >
            📍 Use My Location & Search
          </button>
        </div>
      )}

      {/* === LOCATING / LOADING === */}
      {(phase === 'locating' || phase === 'loading') && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div className="pulse-ring" style={{ width: '56px', height: '56px', margin: '0 auto 1.25rem' }}>
            <span style={{ fontSize: '2rem' }}>{phase === 'locating' ? '📍' : '🏥'}</span>
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
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏥</div>
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
