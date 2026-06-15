import { useState } from 'react'

/**
 * Urgency severity badge — coloured chip matching the Vigilant Sage palette.
 */
function UrgencyBadge({ level }) {
  const config = {
    safe: {
      label: 'Low Risk',
      cls: 'ribbon-safe',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    },
    moderate: {
      label: 'Use Caution',
      cls: 'ribbon-moderate',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    },
    critical: {
      label: 'Black Box Warning',
      cls: 'ribbon-critical',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      )
    },
  }
  const { label, cls, icon } = config[level] || config.safe

  return (
    <span
      className={cls}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          '0.375rem',
        padding:      '0.3rem 0.85rem',
        borderRadius: '999px',
        fontSize:     '0.75rem',
        fontWeight:   700,
        letterSpacing: '0.04em',
      }}
    >
      {icon}
      {label}
    </span>
  )
}

/**
 * A collapsible clinical section (e.g. "Indications & Usage").
 * Shows a "Read more" button if the text exceeds a threshold.
 */
function ClinicalSection({ title, content, defaultOpen = false, highlight = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!content || content.trim().length === 0) return null

  const MAX_PREVIEW = 320
  const isLong      = content.length > MAX_PREVIEW

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.target.open)}
      style={{
        borderBottom: '1px solid var(--color-border)',
        padding:      '1rem 0',
      }}
    >
      <summary
        style={{
          cursor:       'pointer',
          fontWeight:   700,
          fontSize:     '0.9rem',
          color:        highlight ? 'var(--color-alert-critical)' : 'var(--color-text-primary)',
          userSelect:   'none',
          display:      'flex',
          alignItems:   'center',
          gap:          '0.5rem',
          listStyle:    'none',
        }}
      >
        <span style={{
          display:      'inline-block',
          width:        '6px',
          height:       '6px',
          borderRadius: '50%',
          backgroundColor: highlight ? 'var(--color-alert-critical)' : 'var(--color-teal)',
          flexShrink:   0,
        }} />
        {title}
        <span style={{
          marginLeft:   'auto',
          display:      'inline-flex',
          alignItems:   'center',
          transition:   'transform var(--transition-fast)',
          transform:    open ? 'rotate(180deg)' : 'rotate(0deg)',
          color:        'var(--color-text-secondary)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </summary>

      <p style={{
        fontFamily:   'var(--font-sans)',
        fontSize:     '0.875rem',
        color:        'var(--color-text-secondary)',
        lineHeight:   1.7,
        marginTop:    '0.75rem',
        marginBottom: 0,
        whiteSpace:   'pre-line',
      }}>
        {isLong ? content.slice(0, MAX_PREVIEW) + '…' : content}
      </p>

      {isLong && (
        <p style={{
          fontSize:  '0.75rem',
          color:     'var(--color-text-secondary)',
          fontStyle: 'italic',
          margin:    '0.375rem 0 0',
        }}>
          Full text available in the official FDA label.
        </p>
      )}
    </details>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DrugProfileCard({ profile, onClose }) {
  if (!profile) return null

  const {
    brand_name, generic_name, manufacturer, route,
    rxcui, ndc,
    indications, dosage, warnings, boxed_warning, contraindications,
    adverse_reactions, drug_interactions, precautions, storage, description,
    has_boxed_warning, urgency_level,
  } = profile

  const displayName    = brand_name || generic_name || 'Unknown Drug'
  const subName        = brand_name && generic_name ? generic_name : ''
  const routeLabel     = Array.isArray(route) ? route.join(', ') : route
  const primaryRxCUI   = Array.isArray(rxcui) ? rxcui[0] : rxcui

  return (
    <article
      className="card modal-enter"
      style={{ padding: '1.5rem', maxWidth: '680px', margin: '0 auto' }}
      aria-label={`Drug profile for ${displayName}`}
    >
      {/* ---- Header ---- */}
      <header style={{ marginBottom: '1.25rem' }}>
        {onClose && (
          <button
            id="drug-profile-back-btn"
            onClick={onClose}
            style={{
              background:   'none',
              border:       'none',
              color:        'var(--color-teal)',
              cursor:       'pointer',
              fontSize:     '0.85rem',
              padding:      '0.25rem 0.5rem',
              marginLeft:   '-0.5rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              display:      'flex',
              alignItems:   'center',
              gap:          '0.375rem',
              transition:   'var(--transition-fast)',
              outline:      'none',
            }}
            onFocus={(e) => {
              e.target.style.boxShadow = '0 0 0 3px rgba(42, 127, 140, 0.2)';
              e.target.style.background = 'var(--color-teal-subtle)';
            }}
            onBlur={(e) => {
              e.target.style.boxShadow = 'none';
              e.target.style.background = 'none';
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--color-teal-subtle)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to search
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{
              fontFamily:    'var(--font-display)',
              fontSize:      '1.6rem',
              color:         'var(--color-text-primary)',
              margin:        '0 0 0.25rem',
              lineHeight:    1.2,
            }}>
              {displayName}
            </h2>
            {subName && (
              <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                {subName}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <UrgencyBadge level={urgency_level} />
              {routeLabel && (
                <span className="chip chip-info" style={{ fontSize: '0.75rem' }}>
                  {routeLabel}
                </span>
              )}
            </div>
          </div>

          {/* RxCUI identifier */}
          {primaryRxCUI && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'block' }}>RxCUI</span>
              <code style={{
                fontFamily: 'var(--font-mono)',
                fontSize:   '0.85rem',
                color:      'var(--color-teal)',
              }}>
                {primaryRxCUI}
              </code>
            </div>
          )}
        </div>

        {manufacturer && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0.5rem 0 0' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                <path d="M20 21V9a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v12" />
                <path d="M3 21V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16" />
                <path d="M10 9H7" />
                <path d="M10 13H7" />
                <path d="M10 17H7" />
                <path d="M14 13h1" />
                <path d="M14 17h1" />
              </svg>
              {manufacturer}
            </span>
          </p>
        )}
      </header>

      {/* ---- Boxed Warning (critical alert) ---- */}
      {has_boxed_warning && boxed_warning && (
        <div
          className="ribbon-critical"
          style={{
            backgroundColor: 'var(--color-alert-critical-bg)',
            borderRadius:    '8px',
            padding:         '1rem 1rem 1rem 1.25rem',
            marginBottom:    '1.25rem',
          }}
          role="alert"
          aria-live="assertive"
        >
          <h3 style={{
            fontWeight: 700,
            color:      'var(--color-alert-critical)',
            margin:     '0 0 0.5rem',
            fontSize:   '0.9rem',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--color-alert-critical)', flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              FDA Black Box Warning
            </span>
          </h3>
          <p style={{ color: 'var(--color-alert-critical)', margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>
            {boxed_warning.slice(0, 500)}{boxed_warning.length > 500 ? '…' : ''}
          </p>
        </div>
      )}

      {/* ---- Medical Disclaimer ---- */}
      <div style={{
        backgroundColor: 'var(--color-beige)',
        borderRadius:    '6px',
        padding:         '0.6rem 0.875rem',
        marginBottom:    '1rem',
        fontSize:        '0.75rem',
        color:           'var(--color-text-secondary)',
        lineHeight:      1.5,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '0.4rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '0.125rem' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            <strong>This information is for educational purposes only.</strong> Always consult a licensed healthcare professional before taking or adjusting any medication.
          </span>
        </span>
      </div>

      {/* ---- Clinical Sections ---- */}
      <div>
        <ClinicalSection title="Indications & Usage"           content={indications}       defaultOpen={true} />
        <ClinicalSection title="Dosage & Administration"       content={dosage}             defaultOpen={true} />
        <ClinicalSection title="Warnings"                      content={warnings}           highlight={!!warnings} />
        <ClinicalSection title="Contraindications"             content={contraindications}  highlight={!!contraindications} />
        <ClinicalSection title="Adverse Reactions"             content={adverse_reactions} />
        <ClinicalSection title="Drug Interactions"             content={drug_interactions}  highlight={!!drug_interactions} />
        <ClinicalSection title="Precautions"                   content={precautions} />
        <ClinicalSection title="Description"                   content={description} />
        <ClinicalSection title="Storage & Handling"            content={storage} />
      </div>

      {/* ---- Data Source Footer ---- */}
      <footer style={{
        marginTop:  '1.25rem',
        paddingTop: '0.875rem',
        borderTop:  '1px solid var(--color-border)',
        display:    'flex',
        gap:        '1rem',
        flexWrap:   'wrap',
        fontSize:   '0.75rem',
        color:      'var(--color-text-secondary)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--color-text-muted)' }}>
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
          Source: openFDA + RxNorm (NLM)
        </span>
        {primaryRxCUI && (
          <a
            href={`https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${primaryRxCUI}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-teal)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            View on RxNav
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
        {(ndc || []).length > 0 && (
          <span>NDC: {ndc.join(', ')}</span>
        )}
      </footer>
    </article>
  )
}
