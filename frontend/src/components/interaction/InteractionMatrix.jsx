import { useState, useEffect, useCallback } from 'react'
import { searchMedications, checkDrugInteractions } from '../../services/api.js'

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icons = {
  Search: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Alert: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Info: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  Check: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Close: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

export default function InteractionMatrix() {
  const [selectedMeds, setSelectedMeds] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [interactions, setInteractions] = useState([])
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null) // { med1, med2, severity, description }

  // Load initial cabinet list if exists
  useEffect(() => {
    try {
      const cabinet = JSON.parse(localStorage.getItem('medicine_cabinet') || '[]')
      if (cabinet.length > 0) {
        const meds = cabinet
          .filter(item => item.rxcui)
          .map(item => ({ name: item.name || item.generic_name, rxcui: item.rxcui }))
        setSelectedMeds(meds.slice(0, 8)) // Limit to 8 for UI grid sanity
      }
    } catch (e) {
      logger.warning("Could not read cabinet list from localStorage: ", e)
    }
  }, [])

  // Live drug search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const q = searchQuery.trim()
      if (q.length < 2) {
        setSuggestions([])
        return
      }

      setIsSearching(true)
      try {
        const response = await searchMedications(q, 5)
        const results = response.results || []
        
        // Map to standard items
        const items = results
          .filter(r => r.rxcui)
          .map(r => {
            const name = r.generic_name || r.name || r.brand_name
            const rxcuiVal = Array.isArray(r.rxcui) ? r.rxcui[0] : r.rxcui
            return { name, rxcui: rxcuiVal, brand: r.brand_name }
          })
        setSuggestions(items)
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  // Fetch interactions when selected list changes
  useEffect(() => {
    const fetchInteractions = async () => {
      if (selectedMeds.length < 2) {
        setInteractions([])
        return
      }

      setIsLoadingInteractions(true)
      try {
        const rxcuis = selectedMeds.map(m => m.rxcui)
        const response = await checkDrugInteractions(rxcuis)
        setInteractions(response.interactions || [])
      } catch (err) {
        console.error("Failed to check interactions: ", err)
      } finally {
        setIsLoadingInteractions(false)
      }
    }

    fetchInteractions()
  }, [selectedMeds])

  const addMedication = (med) => {
    if (selectedMeds.some(m => m.rxcui === med.rxcui)) {
      setSearchQuery('')
      setSuggestions([])
      return // Avoid duplicates
    }

    setSelectedMeds(prev => [...prev, med])
    setSearchQuery('')
    setSuggestions([])
  }

  const removeMedication = (rxcui) => {
    setSelectedMeds(prev => prev.filter(m => m.rxcui !== rxcui))
  }

  // Lookup interaction result for a pair of rxcuis
  const getPairInteraction = (rxcui1, rxcui2) => {
    const pair = interactions.find(
      i => (i.rxcui_1 === rxcui1 && i.rxcui_2 === rxcui2) || 
           (i.rxcui_1 === rxcui2 && i.rxcui_2 === rxcui1)
    )
    return pair || { severity: 'safe', description: 'No known interactions.' }
  }

  const handleCellClick = (med1, med2) => {
    if (med1.rxcui === med2.rxcui) return
    const details = getPairInteraction(med1.rxcui, med2.rxcui)
    setSelectedCell({
      med1: med1.name,
      med2: med2.name,
      severity: details.severity,
      description: details.description
    })
  }

  return (
    <div style={{ textAlign: 'left' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', margin: '0 0 0.5rem' }}>
          Drug Interaction Matrix
        </h1>
        <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '0.975rem', lineHeight: 1.6 }}>
          Evaluate adverse drug-drug interactions (ADDIs) in real-time. Add multiple medications below to construct a color-coded safety matrix.
        </p>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <div className="search-wrapper" style={{ margin: 0 }}>
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Type a drug name to add to the matrix comparison..."
            style={{ width: '100%' }}
          />
          <div style={{ position: 'absolute', right: '1rem', color: 'var(--color-faint)' }}>
            <Icons.Search />
          </div>
        </div>

        {/* Search Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--color-white)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 50,
            marginTop: '0.375rem',
            overflow: 'hidden'
          }}>
            {suggestions.map((med, idx) => (
              <button
                key={idx}
                onClick={() => addMedication(med)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid var(--color-cream)',
                  cursor: 'pointer',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.15rem'
                }}
                onMouseEnter={e => e.target.style.backgroundColor = 'var(--color-forest-subtle)'}
                onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
              >
                <span style={{ fontWeight: 700 }}>{med.name}</span>
                {med.brand && med.brand !== med.name && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Brand: {med.brand}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Medications list */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-ink)', marginBottom: '0.75rem' }}>
          Medications in Comparison ({selectedMeds.length})
        </h3>
        {selectedMeds.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: 'var(--color-faint)', fontSize: '0.875rem', margin: 0 }}>
            No medications selected. Search and add drugs above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedMeds.map((med) => (
              <span
                key={med.rxcui}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--color-parchment)',
                  color: 'var(--color-ink)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                {med.name}
                <button
                  onClick={() => removeMedication(med.rxcui)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--color-muted)',
                    display: 'flex'
                  }}
                  aria-label={`Remove ${med.name}`}
                >
                  <Icons.Close />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Matrix Table */}
      {selectedMeds.length < 2 ? (
        <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', backgroundColor: 'var(--color-white)' }}>
          <div style={{ color: 'var(--color-faint)', marginBottom: '0.75rem' }}>
            <Icons.Info style={{ width: '40px', height: '40px', margin: '0 auto' }} />
          </div>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', color: 'var(--color-ink)' }}>Comparison Requires Multiple Drugs</h3>
          <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--color-muted)' }}>
            Search and add at least 2 medications above to visualize the drug interaction matrix.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {isLoadingInteractions && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(254, 252, 248, 0.7)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              color: 'var(--color-forest)',
              fontWeight: 600
            }}>
              Loading interactions...
            </div>
          )}

          <div style={{ overflowX: 'auto', border: '1.5px solid var(--color-border)', borderRadius: '12px', backgroundColor: 'var(--color-white)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ backgroundColor: 'var(--color-cream)', width: '140px', borderRight: '1px solid var(--color-border)' }}></th>
                  {selectedMeds.map((med, colIdx) => (
                    <th
                      key={colIdx}
                      style={{
                        padding: '0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-ink)',
                        textAlign: 'center',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        backgroundColor: 'var(--color-cream)',
                        borderRight: colIdx === selectedMeds.length - 1 ? 'none' : '1px solid var(--color-border)'
                      }}
                      title={med.name}
                    >
                      {med.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedMeds.map((rowMed, rowIdx) => (
                  <tr key={rowIdx} style={{ borderBottom: rowIdx === selectedMeds.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                    {/* Row Header */}
                    <td
                      style={{
                        padding: '0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-ink)',
                        backgroundColor: 'var(--color-cream)',
                        borderRight: '1px solid var(--color-border)',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                      title={rowMed.name}
                    >
                      {rowMed.name}
                    </td>

                    {/* Matrix Cells */}
                    {selectedMeds.map((colMed, colIdx) => {
                      const isDiagonal = rowIdx === colIdx
                      const details = isDiagonal ? null : getPairInteraction(rowMed.rxcui, colMed.rxcui)
                      
                      let cellBg = 'var(--color-white)'
                      let cellText = 'var(--color-muted)'
                      
                      if (!isDiagonal && details) {
                        if (details.severity === 'critical') {
                          cellBg = 'var(--color-critical-bg)'
                          cellText = 'var(--color-critical)'
                        } else if (details.severity === 'moderate') {
                          cellBg = 'var(--color-warning-bg)'
                          cellText = 'var(--color-warning)'
                        } else {
                          cellBg = 'var(--color-safe-bg)'
                          cellText = 'var(--color-safe)'
                        }
                      } else if (isDiagonal) {
                        cellBg = 'var(--color-cream)'
                        cellText = 'var(--color-faint)'
                      }

                      return (
                        <td
                          key={colIdx}
                          onClick={() => handleCellClick(rowMed, colMed)}
                          style={{
                            padding: '0.75rem',
                            textAlign: 'center',
                            cursor: isDiagonal ? 'default' : 'pointer',
                            backgroundColor: cellBg,
                            color: cellText,
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            borderRight: colIdx === selectedMeds.length - 1 ? 'none' : '1px solid var(--color-border)',
                            transition: 'all 0.1s ease-out'
                          }}
                          onMouseEnter={e => {
                            if (!isDiagonal) {
                              e.target.style.filter = 'brightness(0.93)'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isDiagonal) {
                              e.target.style.filter = 'none'
                            }
                          }}
                        >
                          {isDiagonal ? (
                            '—'
                          ) : details?.severity === 'critical' ? (
                            '🔴 CRIT'
                          ) : details?.severity === 'moderate' ? (
                            '🟡 WARN'
                          ) : (
                            '🟢 SAFE'
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cell Detail Modal */}
      {selectedCell && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(26, 23, 20, 0.4)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}
        onClick={() => setSelectedCell(null)}
        >
          <div style={{
            backgroundColor: 'var(--color-white)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-xl)',
            animation: 'scaleUp 0.15s ease-out',
            textAlign: 'left'
          }}
          onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-ink)' }}>
                Interaction Details
              </h3>
              <button
                onClick={() => setSelectedCell(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted)',
                  display: 'flex',
                  padding: '0.25rem'
                }}
              >
                <Icons.Close style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--color-cream)',
              marginBottom: '1.25rem',
              fontSize: '0.85rem'
            }}>
              <span style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{selectedCell.med1}</span>
              <span style={{ color: 'var(--color-faint)' }}>↔</span>
              <span style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{selectedCell.med2}</span>
            </div>

            {/* Severity Card Banner */}
            <div style={{
              borderLeft: `4px solid ${
                selectedCell.severity === 'critical' ? 'var(--color-critical)' :
                selectedCell.severity === 'moderate' ? 'var(--color-warning)' : 'var(--color-safe)'
              }`,
              backgroundColor: selectedCell.severity === 'critical' ? 'var(--color-critical-bg)' :
                               selectedCell.severity === 'moderate' ? 'var(--color-warning-bg)' : 'var(--color-safe-bg)',
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              <div style={{
                color: selectedCell.severity === 'critical' ? 'var(--color-critical)' :
                       selectedCell.severity === 'moderate' ? 'var(--color-warning)' : 'var(--color-safe)',
                marginTop: '0.125rem'
              }}>
                {selectedCell.severity === 'critical' ? (
                  <Icons.Alert />
                ) : selectedCell.severity === 'moderate' ? (
                  <Icons.Alert />
                ) : (
                  <Icons.Check />
                )}
              </div>
              <div>
                <h4 style={{
                  margin: '0 0 0.25rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: selectedCell.severity === 'critical' ? 'var(--color-critical)' :
                         selectedCell.severity === 'moderate' ? 'var(--color-warning)' : 'var(--color-safe)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {selectedCell.severity === 'critical' ? 'Critical Interaction' :
                   selectedCell.severity === 'moderate' ? 'Moderate Warning' : 'Safe / Minimal Risk'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
                  {selectedCell.description}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedCell(null)}
                className="btn-primary-forest btn-sm"
                style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.825rem' }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
