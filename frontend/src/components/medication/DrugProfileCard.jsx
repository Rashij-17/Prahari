/**
 * DrugProfileCard Component
 * ==========================
 * Renders a full clinical drug profile returned by GET /medication/profile.
 *
 * Sections displayed (when content exists):
 *   - Header: Brand name, generic name, urgency badge, route
 *   - Boxed Warning (if present) — rendered with critical styling
 *   - Indications & Usage
 *   - Dosage & Administration
 *   - Warnings
 *   - Contraindications
 *   - Adverse Reactions
 *   - Drug Interactions
 *   - Storage & Handling
 *
 * Props:
 *   profile {object} — DrugProfile response from /medication/profile
 *   onClose {function} — Optional: called when the close/back button is pressed
 */

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Urgency severity badge — coloured chip matching the Vigilant Sage palette.
 */
function UrgencyBadge({ level }) {
  const config = {
    safe:     { label: '✅ Low Risk',       cls: 'ribbon-safe'     },
    moderate: { label: '⚠️ Use Caution',    cls: 'ribbon-moderate' },
    critical: { label: '🚨 Black Box Warning', cls: 'ribbon-critical' },
  }
  const { label, cls } = config[level] || config.safe

  return (
    <span
      className={cls}
      style={{
        display:      'inline-block',
        padding:      '0.3rem 0.85rem',
        borderRadius: '999px',
        fontSize:     '0.75rem',
        fontWeight:   700,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  )
}

/**
 * A collapsible clinical section (e.g. "Indications & Usage").
 * Shows a "Read more" button if the text exceeds a threshold.
 */
function ClinicalSection({ title, content, defaultOpen = false, highlight = false }) {
  if (!content || content.trim().length === 0) return null

  const MAX_PREVIEW = 320
  const isLong      = content.length > MAX_PREVIEW

  return (
    <details
      open={defaultOpen}
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
          fontSize:     '0.75rem',
          color:        'var(--color-text-secondary)',
          fontWeight:   400,
        }}>
          ▼
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
              padding:      0,
              marginBottom: '1rem',
              display:      'flex',
              alignItems:   'center',
              gap:          '0.375rem',
            }}
          >
            ← Back to search
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
            🏭 {manufacturer}
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
            ⬛ FDA Black Box Warning
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
        ⚕️ <strong>This information is for educational purposes only.</strong> Always consult a licensed
        healthcare professional before taking or adjusting any medication.
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
        <span>📊 Source: openFDA + RxNorm (NLM)</span>
        {primaryRxCUI && (
          <a
            href={`https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${primaryRxCUI}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-teal)' }}
          >
            View on RxNav →
          </a>
        )}
        {(ndc || []).length > 0 && (
          <span>NDC: {ndc.join(', ')}</span>
        )}
      </footer>
    </article>
  )
}
