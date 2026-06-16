/**
 * DrugProfileCard Component — v3.0 "Warm Rx"
 * =============================================
 * Renders a full clinical drug profile. Restyled with SVG icons,
 * forest/amber palette, warm paper surfaces.
 */

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icons = {
  Back: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  Check: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Alert: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 9v4M12 17h.01"/>
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  Box: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="1"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
    </svg>
  ),
  Factory: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2 20h20M4 20V10l5 3V10l5 3V8l5 3v9"/>
    </svg>
  ),
  External: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UrgencyBadge({ level }) {
  const config = {
    safe:     { label: 'Low risk',           cls: 'chip-safe',     Icon: Icons.Check },
    moderate: { label: 'Use caution',        cls: 'chip-moderate', Icon: Icons.Alert },
    critical: { label: 'Black box warning',  cls: 'chip-critical', Icon: Icons.Alert },
  }
  const { label, cls, Icon } = config[level] || config.safe

  return (
    <span className={`chip ${cls}`} style={{ padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem' }}>
      <Icon />
      {label}
    </span>
  )
}

function ClinicalSection({ title, content, defaultOpen = false, highlight = false }) {
  if (!content || content.trim().length === 0) return null

  const MAX_PREVIEW = 320
  const isLong = content.length > MAX_PREVIEW

  return (
    <details open={defaultOpen} style={{ borderBottom: '1px solid var(--color-border)', padding: '1.125rem 0' }}>
      <summary style={{
        cursor: 'pointer', fontWeight: 700, fontSize: '0.9375rem',
        color: highlight ? 'var(--color-critical)' : 'var(--color-ink)',
        userSelect: 'none', display: 'flex', alignItems: 'center', gap: '0.625rem', listStyle: 'none',
        fontFamily: 'var(--font-sans)',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          backgroundColor: highlight ? 'var(--color-critical)' : 'var(--color-forest)', flexShrink: 0,
        }} />
        {title}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-faint)', fontWeight: 400 }}>
          ▾
        </span>
      </summary>

      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: '0.875rem', color: 'var(--color-muted)',
        lineHeight: 1.7, marginTop: '0.75rem', marginBottom: 0, whiteSpace: 'pre-line',
      }}>
        {isLong ? content.slice(0, MAX_PREVIEW) + '…' : content}
      </p>

      {isLong && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-faint)', fontStyle: 'italic', margin: '0.375rem 0 0' }}>
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
    brand_name, generic_name, manufacturer, route, rxcui, ndc,
    indications, dosage, warnings, boxed_warning, contraindications,
    adverse_reactions, drug_interactions, precautions, storage, description,
    has_boxed_warning, urgency_level,
  } = profile

  const displayName  = brand_name || generic_name || 'Unknown Drug'
  const subName      = brand_name && generic_name ? generic_name : ''
  const routeLabel   = Array.isArray(route) ? route.join(', ') : route
  const primaryRxCUI = Array.isArray(rxcui) ? rxcui[0] : rxcui

  return (
    <article className="card modal-enter" style={{ padding: '1.75rem', maxWidth: '680px', margin: '0 auto' }}
      aria-label={`Drug profile for ${displayName}`}>

      <header style={{ marginBottom: '1.5rem' }}>
        {onClose && (
          <button id="drug-profile-back-btn" onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--color-forest)', cursor: 'pointer',
            fontSize: '0.85rem', padding: 0, marginBottom: '1.125rem', display: 'flex',
            alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-sans)', fontWeight: 600,
          }}>
            <Icons.Back /> Back to search
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--color-ink)', margin: '0 0 0.25rem', lineHeight: 1.15 }}>
              {displayName}
            </h2>
            {subName && (
              <p style={{ color: 'var(--color-muted)', margin: '0 0 0.625rem', fontSize: '0.9375rem' }}>
                {subName}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <UrgencyBadge level={urgency_level} />
              {routeLabel && (
                <span className="chip chip-info" style={{ fontSize: '0.75rem' }}>
                  <Icons.Box /> {routeLabel}
                </span>
              )}
            </div>
          </div>

          {primaryRxCUI && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.688rem', color: 'var(--color-faint)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                RxCUI
              </span>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--color-forest)' }}>
                {primaryRxCUI}
              </code>
            </div>
          )}
        </div>

        {manufacturer && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-faint)', margin: '0.75rem 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icons.Factory /> {manufacturer}
          </p>
        )}
      </header>

      {has_boxed_warning && boxed_warning && (
        <div className="ribbon-critical" style={{
          backgroundColor: 'var(--color-critical-bg)', borderRadius: '10px',
          padding: '1.125rem 1.125rem 1.125rem 1.375rem', marginBottom: '1.5rem',
        }} role="alert" aria-live="assertive">
          <h3 style={{
            fontWeight: 700, color: 'var(--color-critical)', margin: '0 0 0.5rem',
            fontSize: '0.9375rem', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <Icons.Alert /> FDA black box warning
          </h3>
          <p style={{ color: 'var(--color-critical)', margin: 0, fontSize: '0.875rem', lineHeight: 1.6 }}>
            {boxed_warning.slice(0, 500)}{boxed_warning.length > 500 ? '…' : ''}
          </p>
        </div>
      )}

      <div style={{
        backgroundColor: 'var(--color-cream)', borderRadius: '9px', padding: '0.75rem 1rem',
        marginBottom: '1.25rem', fontSize: '0.8125rem', color: 'var(--color-muted)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--color-ink)' }}>This information is for educational purposes only.</strong>{' '}
        Always consult a licensed healthcare professional before taking or adjusting any medication.
      </div>

      <div>
        <ClinicalSection title="Indications & usage" content={indications} defaultOpen={true} />
        <ClinicalSection title="Dosage & administration" content={dosage} defaultOpen={true} />
        <ClinicalSection title="Warnings" content={warnings} highlight={!!warnings} />
        <ClinicalSection title="Contraindications" content={contraindications} highlight={!!contraindications} />
        <ClinicalSection title="Adverse reactions" content={adverse_reactions} />
        <ClinicalSection title="Drug interactions" content={drug_interactions} highlight={!!drug_interactions} />
        <ClinicalSection title="Precautions" content={precautions} />
        <ClinicalSection title="Description" content={description} />
        <ClinicalSection title="Storage & handling" content={storage} />
      </div>

      <footer style={{
        marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)',
        display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--color-faint)',
      }}>
        <span>Source: openFDA + RxNorm (NLM)</span>
        {primaryRxCUI && (
          <a href={`https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${primaryRxCUI}`}
            target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--color-forest)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            View on RxNav <Icons.External />
          </a>
        )}
        {(ndc || []).length > 0 && <span>NDC: {ndc.join(', ')}</span>}
      </footer>
    </article>
  )
}
