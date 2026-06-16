/**
 * Prahari — Home / Dashboard Page (v3.0 "Warm Rx")
 * ====================================================
 * Editorial layout: warm paper hero with Rx watermark,
 * numbered magazine-style feature list, clean stat row.
 * No gradients-as-decoration, no emoji, no glass cards.
 */

import { NavLink } from 'react-router-dom'

// ----------------------------------------------------------------
// Icons
// ----------------------------------------------------------------
const Icons = {
  Scanner: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
      <circle cx="12" cy="12" r="3.2"/>
    </svg>
  ),
  Pill: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2.5"/>
      <path d="m14.5 17.5 5-5"/>
      <circle cx="18" cy="18" r="4"/>
    </svg>
  ),
  Pulse: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Pin: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Arrow: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Lock: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4" y="11" width="16" height="9" rx="2"/>
      <path d="M8 11V7a4 4 0 1 1 8 0v4"/>
    </svg>
  ),
  Building: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4" y="2" width="16" height="20" rx="1"/>
      <line x1="9" y1="8" x2="9" y2="8"/>
      <line x1="15" y1="8" x2="15" y2="8"/>
      <line x1="9" y1="13" x2="9" y2="13"/>
      <line x1="15" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="18" x2="15" y2="18"/>
    </svg>
  ),
  Flask: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 2v6.5L4.5 17a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L15 8.5V2"/>
      <line x1="7" y1="2" x2="17" y2="2"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
    </svg>
  ),
  Brain: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9.5 2a3.5 3.5 0 0 0-3.5 3.5v.6A3 3 0 0 0 4 9v1a3 3 0 0 0 1 2.24V14a3 3 0 0 0 3 3h.5"/>
      <path d="M14.5 2A3.5 3.5 0 0 1 18 5.5v.6A3 3 0 0 1 20 9v1a3 3 0 0 1-1 2.24V14a3 3 0 0 1-3 3h-.5"/>
      <path d="M9.5 2v18M14.5 2v18"/>
    </svg>
  ),
  Map: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
      <line x1="9" y1="3" x2="9" y2="18"/>
      <line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  ),
}

// ----------------------------------------------------------------
// Data
// ----------------------------------------------------------------
const FEATURES = [
  {
    num: '01',
    id: 'feature-scanner',
    title: 'Visual Label Scanner',
    description: 'Photograph any medication label. Our vision pipeline reads the text and instantly cross-references it against openFDA and RxNorm.',
    path: '/scanner',
    Icon: Icons.Scanner,
    status: 'Live',
  },
  {
    num: '02',
    id: 'feature-medications',
    title: 'Drug Intelligence',
    description: 'Search any medication to see active ingredients, dosage guidance, contraindications, and drug-to-drug interaction alerts.',
    path: '/medications',
    Icon: Icons.Pill,
    status: 'Live',
  },
  {
    num: '03',
    id: 'feature-triage',
    title: 'Symptom Triage',
    description: 'Describe symptoms in plain language. Our system evaluates urgency and recommends a next step — from self-care to emergency action.',
    path: '/triage',
    Icon: Icons.Pulse,
    status: 'Beta',
  },
  {
    num: '04',
    id: 'feature-directory',
    title: 'Doctor Directory',
    description: 'Find nearby clinics, hospitals, and specialists sorted by distance. Filter by specialty, availability, and open status.',
    path: '/directory',
    Icon: Icons.Pin,
    status: 'Live',
  },
]

const STATS = [
  { value: '125K+', label: 'Preventable deaths/yr', sub: 'from misread prescriptions' },
  { value: '55%',   label: 'Patients affected',     sub: 'in rural & semi-urban India' },
  { value: 'FDA',   label: 'Authoritative data',    sub: 'openFDA · RxNorm · Infermedica' },
  { value: '0',     label: 'Records stored',        sub: 'privacy by design' },
]

const SOURCES = [
  { Icon: Icons.Building, name: 'openFDA',          desc: 'FDA drug labels' },
  { Icon: Icons.Flask,    name: 'RxNorm',            desc: 'NLM drug database' },
  { Icon: Icons.Brain,    name: 'Infermedica',       desc: 'Clinical triage engine' },
  { Icon: Icons.Map,      name: 'Google Places',     desc: 'Provider directory' },
]

// ----------------------------------------------------------------
// Hero
// ----------------------------------------------------------------
function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="hero-section">
      {/* Rx watermark — signature element */}
      <span className="hero-rx-mark" aria-hidden="true">℞</span>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px' }}>
        {/* Eyebrow */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.875rem 0.375rem 0.625rem',
          borderRadius: '999px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-white)',
          marginBottom: '1.75rem',
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'var(--color-forest)',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-muted)',
            letterSpacing: '0.01em',
          }}>
            Your personal health companion
          </span>
        </div>

        {/* Headline */}
        <h1
          id="hero-heading"
          style={{
            fontSize: 'clamp(2.25rem, 6vw, 3.75rem)',
            lineHeight: 1.08,
            marginBottom: '1.25rem',
            color: 'var(--color-ink)',
          }}
        >
          Decode meds.{' '}
          <span style={{ fontStyle: 'italic', color: 'var(--color-forest)' }}>
            Triage fast.
          </span>
          <br />
          Find care now.
        </h1>

        {/* Subheadline */}
        <p style={{
          fontSize: 'clamp(1rem, 1.5vw, 1.125rem)',
          lineHeight: 1.7,
          color: 'var(--color-muted)',
          marginBottom: '2.25rem',
          maxWidth: '480px',
        }}>
          Prahari demystifies medication labels, triages your symptoms, and connects you to the right local specialist — all backed by clinically authoritative data.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap' }}>
          <NavLink to="/scanner" id="hero-cta-scanner" className="btn-primary">
            Scan a medication
            <Icons.Arrow />
          </NavLink>
          <NavLink to="/triage" id="hero-cta-triage" className="btn-secondary">
            Check symptoms
          </NavLink>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
        gap: '1rem',
        marginTop: 'clamp(2.5rem, 5vw, 3.5rem)',
      }}>
        {STATS.map((s, i) => (
          <div key={i} className="stat-card">
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.5rem, 2.5vw, 1.875rem)',
              color: 'var(--color-forest)',
              lineHeight: 1.1,
              marginBottom: '0.25rem',
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.125rem' }}>
              {s.label}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-faint)', lineHeight: 1.4 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ----------------------------------------------------------------
// Feature Row — magazine-style numbered list
// ----------------------------------------------------------------
function FeatureRow({ feature, isLast }) {
  const { num, id, title, description, path, Icon, status } = feature

  return (
    <NavLink
      id={id}
      to={path}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto 1fr auto',
          alignItems: 'center',
          gap: 'clamp(1rem, 3vw, 2rem)',
          padding: 'clamp(1.5rem, 3vw, 2rem) 0',
          borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
          transition: 'var(--transition-standard)',
          cursor: 'pointer',
        }}
        className="feature-row"
      >
        {/* Number */}
        <span style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
          color: 'var(--color-border-strong)',
          fontWeight: 400,
          lineHeight: 1,
        }}>
          {num}
        </span>

        {/* Icon */}
        <div className="feature-row-icon" style={{
          width: '52px',
          height: '52px',
          borderRadius: '13px',
          background: 'var(--color-forest-subtle)',
          color: 'var(--color-forest)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'var(--transition-standard)',
        }}>
          <Icon />
        </div>

        {/* Text */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
            <h3 style={{
              fontSize: 'clamp(1.125rem, 2vw, 1.375rem)',
              color: 'var(--color-ink)',
              margin: 0,
            }}>
              {title}
            </h3>
            <span className={status === 'Beta' ? 'chip chip-moderate' : 'chip chip-safe'}>
              {status}
            </span>
          </div>
          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--color-muted)',
            lineHeight: 1.65,
            margin: 0,
            maxWidth: '560px',
          }}>
            {description}
          </p>
        </div>

        {/* Arrow */}
        <div className="feature-row-arrow" style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: '1.5px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-muted)',
          flexShrink: 0,
          transition: 'var(--transition-standard)',
        }}>
          <Icons.Arrow />
        </div>
      </div>

      <style>{`
        .feature-row:hover .feature-row-icon {
          background: var(--color-forest);
          color: white;
          transform: scale(1.05);
        }
        .feature-row:hover .feature-row-arrow {
          background: var(--color-forest);
          border-color: var(--color-forest);
          color: white;
          transform: translateX(3px);
        }
      `}</style>
    </NavLink>
  )
}

// ----------------------------------------------------------------
// Trust Sources
// ----------------------------------------------------------------
function TrustSources() {
  return (
    <div style={{ margin: '3rem 0' }}>
      <div className="section-label">Powered by authoritative sources</div>
      <div className="grid-auto-fit" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
        {SOURCES.map(s => (
          <div key={s.name} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.125rem',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-white)',
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '9px',
              background: 'var(--color-cream)',
              color: 'var(--color-forest)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <s.Icon />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>{s.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-faint)' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Privacy Banner
// ----------------------------------------------------------------
function PrivacyBanner() {
  return (
    <div style={{
      marginTop: '1rem',
      padding: '1.5rem 1.75rem',
      borderRadius: '16px',
      background: 'var(--color-forest)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '1.25rem',
      flexWrap: 'wrap',
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '11px',
        background: 'rgba(255,255,255,0.15)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icons.Lock />
      </div>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <p style={{ margin: '0 0 0.25rem', fontWeight: 700, color: 'white', fontSize: '0.9375rem' }}>
          Zero data retention
        </p>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, maxWidth: '520px' }}>
          Camera frames, OCR outputs, and symptom logs are never stored beyond a single request. No accounts, no PII collected — ever.
        </p>
      </div>
      <span style={{
        padding: '0.3rem 0.75rem',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.15)',
        color: 'white',
        fontSize: '0.688rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        Privacy-first
      </span>
    </div>
  )
}

// ----------------------------------------------------------------
// HomePage — default export
// ----------------------------------------------------------------
export default function HomePage() {
  return (
    <div>
      <Hero />
      <TrustSources />

      <section aria-label="Application features" style={{ marginTop: '1rem' }}>
        <div className="section-label">What Prahari can do</div>
        <div>
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.id} feature={f} isLast={i === FEATURES.length - 1} />
          ))}
        </div>
      </section>

      <PrivacyBanner />
    </div>
  )
}
