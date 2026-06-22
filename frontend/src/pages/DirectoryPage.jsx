/**
 * DirectoryPage — v2.0 "Prahari Smart Directory"
 * ================================================
 * Three search modes:
 *   1. GPS — "Use My Location" (existing behaviour)
 *   2. Typed location — free text geocoded via OSM Nominatim
 *   3. Agent deep-link — reads ?type= and ?location= from URL
 *      (set by the Prahari AI Agent when intent == "directory")
 *
 * Fallback chain: OSM Overpass → Google Places → Dynamic Mock
 */

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchProviders, geocodeLocation } from '../services/api.js'

// ─── Facility type config ────────────────────────────────────────────────────
const FACILITY_TYPES = [
  { label: 'All Healthcare',  value: '',                  emoji: '🏥' },
  { label: 'Hospital / A&E',  value: 'hospital emergency',emoji: '🚑' },
  { label: 'Clinic / Doctor', value: 'clinic doctor',     emoji: '🩺' },
  { label: 'Pharmacy',        value: 'pharmacy',          emoji: '💊' },
  { label: 'Cardiologist',    value: 'cardiologist',      emoji: '❤️' },
  { label: 'Paediatrician',   value: 'paediatrician',     emoji: '👶' },
  { label: 'Dermatologist',   value: 'dermatologist',     emoji: '🔬' },
  { label: 'Neurologist',     value: 'neurologist',       emoji: '🧠' },
]

const AGENT_TYPE_MAP = {
  hospital: 'hospital emergency',
  clinic:   'clinic doctor',
  pharmacy: 'pharmacy',
  doctors:  'clinic doctor',
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
      <div style={{
        width: 56, height: 56, margin: '0 auto 1.25rem',
        borderRadius: '50%',
        border: '3px solid var(--color-forest-subtle)',
        borderTop: '3px solid var(--color-forest)',
        animation: 'dirSpin 0.7s linear infinite',
      }} />
      <p style={{ color: 'var(--color-muted)', fontWeight: 500, margin: 0 }}>{label}</p>
      <style>{`@keyframes dirSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Provider Card ────────────────────────────────────────────────────────────
function ProviderCard({ provider, index }) {
  const [hovered, setHovered] = useState(false)
  const isOpen = provider.open_now
  const statusColor = isOpen === true ? 'var(--color-safe)' : isOpen === false ? 'var(--color-critical)' : 'var(--color-faint)'
  const statusText  = isOpen === true ? 'Open now' : isOpen === false ? 'Closed' : 'Hours unknown'

  const stars = (r) => '★'.repeat(Math.floor(r)) + '☆'.repeat(5 - Math.floor(r))

  return (
    <a
      href={provider.maps_url}
      target="_blank"
      rel="noopener noreferrer"
      id={`provider-${provider.place_id || index}`}
      style={{ textDecoration: 'none', display: 'block', outline: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        padding: '1.25rem',
        background: 'var(--color-white)',
        border: `1.5px solid ${hovered ? 'var(--color-forest)' : 'var(--color-border)'}`,
        borderRadius: '14px',
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all 0.18s ease',
        display: 'flex', gap: '1rem', alignItems: 'flex-start',
        animation: `dirFadeUp 0.3s ${index * 60}ms ease-out both`,
      }}>
        <style>{`
          @keyframes dirFadeUp {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 700,
            color: 'var(--color-ink)', fontFamily: 'var(--font-sans)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {provider.name}
          </h3>

          {provider.address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem', marginBottom: '0.4rem' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', lineHeight: 1.45 }}>
                {provider.address}
              </span>
            </div>
          )}

          {provider.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-forest)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-forest)', fontWeight: 600 }}>
                {provider.phone}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: statusColor, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
              {statusText}
            </span>
            {provider.rating > 0 && (
              <span style={{ fontSize: '0.78rem', color: 'var(--color-amber)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                {stars(provider.rating)} {provider.rating.toFixed(1)}
                <span style={{ color: 'var(--color-faint)', fontWeight: 400 }}>({provider.total_ratings})</span>
              </span>
            )}
          </div>

          {provider.types?.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
              {provider.types.filter(t => !['point_of_interest','establishment','health'].includes(t)).slice(0, 3).map((t, i) => (
                <span key={i} style={{
                  padding: '0.2rem 0.55rem', borderRadius: '99px',
                  background: 'var(--color-forest-subtle)',
                  color: 'var(--color-forest)', fontSize: '0.7rem', fontWeight: 600,
                  border: '1px solid rgba(55,124,80,0.2)',
                }}>
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
              {provider.is_mock && (
                <span style={{
                  padding: '0.2rem 0.55rem', borderRadius: '99px',
                  background: 'var(--color-cream)',
                  color: 'var(--color-faint)', fontSize: '0.7rem', fontWeight: 500,
                  border: '1px dashed var(--color-border)',
                }}>
                  demo
                </span>
              )}
            </div>
          )}
        </div>

        {/* Distance badge */}
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <div style={{
            padding: '0.55rem 0.875rem', borderRadius: '10px',
            background: hovered ? 'var(--color-forest)' : 'var(--color-forest-subtle)',
            color: hovered ? '#fff' : 'var(--color-forest)',
            transition: 'all 0.18s ease',
          }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1 }}>
              {provider.distance_km.toFixed(1)}
            </div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>
              km
            </div>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-muted)', marginTop: '0.3rem' }}>away</div>
        </div>
      </div>
    </a>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DirectoryPage() {
  const [searchParams] = useSearchParams()

  // Form state
  const [locationText, setLocationText] = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [radius,       setRadius]       = useState(5)
  const [searchMode,   setSearchMode]   = useState('gps') // 'gps' | 'text'

  // Result state
  const [phase,     setPhase]     = useState('idle') // idle | locating | geocoding | loading | results | error
  const [results,   setResults]   = useState([])
  const [isMock,    setIsMock]    = useState(false)
  const [mockNote,  setMockNote]  = useState('')
  const [error,     setError]     = useState('')
  const [resolvedLocation, setResolvedLocation] = useState('')

  const inputRef = useRef(null)

  // ── Read agent deep-link params on mount ───────────────────────
  useEffect(() => {
    const agentType     = searchParams.get('type')
    const agentLocation = searchParams.get('location')

    if (agentType) {
      const mapped = AGENT_TYPE_MAP[agentType] || agentType
      setFacilityType(mapped)
    }
    if (agentLocation && agentLocation.trim()) {
      setLocationText(agentLocation.trim())
      setSearchMode('text')
      // Auto-trigger the search
      runTextSearch(agentLocation.trim(), agentType ? (AGENT_TYPE_MAP[agentType] || agentType) : facilityType, radius)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS search ─────────────────────────────────────────────────
  const runGpsSearch = () => {
    setPhase('locating')
    setError('')
    setResults([])

    if (!navigator.geolocation) {
      runFallbackSearch(28.6139, 77.2090, 'Geolocation not supported — using New Delhi as default.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        await doSearch(coords.latitude, coords.longitude, facilityType, radius, '')
      },
      async (err) => {
        const reason = err.code === 1
          ? 'Location access denied.'
          : 'Could not get location (timeout).'
        await runFallbackSearch(28.6139, 77.2090, reason)
      },
      { timeout: 8000, maximumAge: 60000 }
    )
  }

  // ── Text / geocoded search ──────────────────────────────────────
  const runTextSearch = async (locText, type, rad) => {
    const loc = (locText ?? locationText).trim()
    if (!loc) {
      inputRef.current?.focus()
      return
    }

    setPhase('geocoding')
    setError('')
    setResults([])

    try {
      const geo = await geocodeLocation(loc)
      setResolvedLocation(geo.display_name || loc)
      await doSearch(geo.lat, geo.lng, type ?? facilityType, rad ?? radius, geo.display_name || loc)
    } catch (err) {
      setError(err.message || 'Could not find that location. Try a more specific name (e.g. "Bandra, Mumbai").')
      setPhase('error')
    }
  }

  // ── Shared search executor ─────────────────────────────────────
  const doSearch = async (lat, lng, specialty, rad, locationLabel) => {
    setPhase('loading')
    try {
      const data = await searchProviders({ lat, lng, specialty, radius_km: rad, limit: 15 })
      setResults(data.providers || [])
      setIsMock(data.is_mock || false)
      setMockNote(data.mock_notice || '')
      setResolvedLocation(locationLabel)
      setPhase('results')
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.')
      setPhase('error')
    }
  }

  const runFallbackSearch = async (lat, lng, reason) => {
    await doSearch(lat, lng, facilityType, radius, '')
    setMockNote(prev => `⚠️ ${reason} Showing results for New Delhi.\n\n${prev}`.trim())
  }

  const reset = () => {
    setPhase('idle')
    setResults([])
    setError('')
    setMockNote('')
    setIsMock(false)
    setResolvedLocation('')
  }

  const selectedFacility = FACILITY_TYPES.find(f => f.value === facilityType) || FACILITY_TYPES[0]

  const isSearching = ['locating', 'geocoding', 'loading'].includes(phase)

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', fontFamily: 'var(--font-sans)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '2rem',
          color: 'var(--color-ink)', margin: '0 0 0.4rem',
        }}>
          Provider Directory
        </h1>
        <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>
          Find nearby hospitals, clinics, pharmacies and specialists — powered by live OpenStreetMap data.
        </p>
      </div>

      {/* ── Search Panel ── */}
      {phase !== 'locating' && phase !== 'geocoding' && phase !== 'loading' && (
        <div style={{
          background: 'var(--color-white)',
          border: '1.5px solid var(--color-border)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--shadow-sm)',
        }}>

          {/* ── Mode tabs ── */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {[
              { key: 'gps',  label: '📍 Use My Location' },
              { key: 'text', label: '🔍 Search by Area' },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setSearchMode(m.key)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '8px',
                  border: `1.5px solid ${searchMode === m.key ? 'var(--color-forest)' : 'var(--color-border)'}`,
                  background: searchMode === m.key ? 'var(--color-forest-subtle)' : 'transparent',
                  color: searchMode === m.key ? 'var(--color-forest)' : 'var(--color-muted)',
                  fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '0.85rem',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* ── Location text input (text mode only) ── */}
          {searchMode === 'text' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="location-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-ink)' }}>
                Area / Neighbourhood / City
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  ref={inputRef}
                  id="location-input"
                  type="text"
                  value={locationText}
                  onChange={e => setLocationText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runTextSearch()}
                  placeholder="e.g. Connaught Place Delhi, Bandra Mumbai…"
                  style={{
                    flex: 1, padding: '0.7rem 0.975rem',
                    borderRadius: '9px', border: '1.5px solid var(--color-border)',
                    background: 'var(--color-cream)', color: 'var(--color-ink)',
                    fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-forest)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--color-border)'}
                />
              </div>
            </div>
          )}

          {/* ── Filters row ── */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {/* Facility type */}
            <div style={{ flex: 2, minWidth: '180px' }}>
              <label htmlFor="facility-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-ink)' }}>
                Facility Type
              </label>
              <select
                id="facility-select"
                value={facilityType}
                onChange={e => setFacilityType(e.target.value)}
                style={{
                  width: '100%', padding: '0.7rem 0.875rem',
                  borderRadius: '9px', border: '1.5px solid var(--color-border)',
                  background: 'var(--color-white)', color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)', fontSize: '0.9rem', outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-forest)'}
                onBlur={e  => e.target.style.borderColor = 'var(--color-border)'}
              >
                {FACILITY_TYPES.map(f => (
                  <option key={f.value} value={f.value}>{f.emoji} {f.label}</option>
                ))}
              </select>
            </div>

            {/* Radius */}
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label htmlFor="radius-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-ink)' }}>
                Radius
              </label>
              <select
                id="radius-select"
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                style={{
                  width: '100%', padding: '0.7rem 0.875rem',
                  borderRadius: '9px', border: '1.5px solid var(--color-border)',
                  background: 'var(--color-white)', color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)', fontSize: '0.9rem', outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-forest)'}
                onBlur={e  => e.target.style.borderColor = 'var(--color-border)'}
              >
                <option value={2}>2 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
              </select>
            </div>
          </div>

          {/* ── Search button ── */}
          <button
            id="directory-search-btn"
            onClick={searchMode === 'gps' ? runGpsSearch : () => runTextSearch()}
            disabled={isSearching}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem', borderRadius: '10px',
              background: 'var(--color-forest)', color: 'white',
              border: 'none', fontFamily: 'var(--font-sans)',
              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              transition: 'opacity 0.15s ease',
              opacity: isSearching ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!isSearching) e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => e.currentTarget.style.opacity = isSearching ? '0.6' : '1'}
          >
            {searchMode === 'gps' ? (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
                </svg>
                Use My Location &amp; Search
              </>
            ) : (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Search {locationText ? `"${locationText}"` : 'This Area'}
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Loading / Locating / Geocoding ── */}
      {phase === 'locating'  && <Spinner label="Accessing your GPS location…" />}
      {phase === 'geocoding' && <Spinner label={`Resolving "${locationText}"…`} />}
      {phase === 'loading'   && <Spinner label="Searching for nearby providers via OpenStreetMap…" />}

      {/* ── Results ── */}
      {phase === 'results' && (
        <div>
          {/* Context bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem',
          }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-ink)', fontSize: '0.95rem' }}>
                {selectedFacility.emoji} {results.length} {selectedFacility.label} provider{results.length !== 1 ? 's' : ''}
                {resolvedLocation && (
                  <span style={{ fontWeight: 500, color: 'var(--color-muted)' }}>
                    {' '}near <em>{resolvedLocation.split(',').slice(0, 2).join(',')}</em>
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                within {radius} km · sorted by distance
              </div>
            </div>
            <button
              id="directory-new-search-btn"
              onClick={reset}
              style={{
                padding: '0.4rem 0.875rem', borderRadius: '8px',
                border: '1.5px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-muted)',
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '0.8rem',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-forest)'; e.currentTarget.style.color = 'var(--color-forest)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-muted)' }}
            >
              ↺ New Search
            </button>
          </div>

          {/* Mock / data-source notice */}
          {mockNote && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem',
              background: isMock ? 'var(--color-warning-bg)' : 'var(--color-forest-subtle)',
              border: `1px solid ${isMock ? 'var(--color-warning-border)' : 'rgba(55,124,80,0.2)'}`,
              fontSize: '0.8rem', color: isMock ? 'var(--color-warning)' : 'var(--color-forest)',
              fontWeight: 500, whiteSpace: 'pre-line',
            }}>
              {mockNote}
            </div>
          )}

          {results.length === 0 ? (
            <div style={{
              padding: '3rem 2rem', textAlign: 'center',
              background: 'var(--color-white)', border: '1.5px solid var(--color-border)',
              borderRadius: '14px', color: 'var(--color-muted)', fontSize: '0.95rem',
            }}>
              No providers found within {radius} km. Try increasing the search radius.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {results.map((p, i) => (
                <ProviderCard key={p.place_id || i} provider={p} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {phase === 'error' && (
        <div style={{
          padding: '1.5rem',
          background: 'var(--color-white)',
          border: '2px solid var(--color-warning)',
          borderRadius: '14px',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--color-warning)', marginBottom: '0.5rem', fontSize: '1rem' }}>
            ⚠️ Search failed
          </div>
          <p style={{ color: 'var(--color-muted)', margin: '0 0 1rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              id="directory-retry-btn"
              onClick={searchMode === 'gps' ? runGpsSearch : () => runTextSearch()}
              style={{
                padding: '0.65rem 1.25rem', borderRadius: '9px',
                background: 'var(--color-forest)', color: '#fff',
                border: 'none', fontFamily: 'var(--font-sans)', fontWeight: 700,
                fontSize: '0.875rem', cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={reset}
              style={{
                padding: '0.65rem 1.25rem', borderRadius: '9px',
                background: 'transparent', color: 'var(--color-muted)',
                border: '1.5px solid var(--color-border)',
                fontFamily: 'var(--font-sans)', fontWeight: 600,
                fontSize: '0.875rem', cursor: 'pointer',
              }}
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
