/**
 * Prahari — Home / Dashboard Page (v2.0 — Enhanced UI)
 * ======================================================
 * Premium landing page with gradient hero, animated stats,
 * and fully responsive feature card grid.
 */

import { NavLink } from 'react-router-dom'

// ----------------------------------------------------------------
// Feature Card Data
// ----------------------------------------------------------------

const FEATURES = [
  {
    id:          'feature-scanner',
    title:       'Visual Label Scanner',
    subtitle:    'Point. Capture. Understand.',
    description: 'Photograph any medication label. Our OCR engine reads the text and instantly looks up clinical information from openFDA and RxNorm.',
    path:        '/scanner',
    cta:         'Open Scanner',
    status:      'Live',
    statusClass: 'chip-safe',
    gradient:    'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
    iconBg:      'rgba(28,92,102,0.1)',
  },
  {
    id:          'feature-medications',
    title:       'Drug Intelligence',
    subtitle:    'Ingredients · Warnings · Interactions',
    description: 'Search any medication name to see active ingredients, dosage guidance, contraindications, and drug–drug interaction alerts.',
    path:        '/medications',
    cta:         'Search Medications',
    status:      'Live',
    statusClass: 'chip-safe',
    gradient:    'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    iconBg:      'rgba(28,92,102,0.1)',
  },
  {
    id:          'feature-triage',
    title:       'Symptom Triage',
    subtitle:    'Describe. Assess. Act.',
    description: "Enter your symptoms in plain language. AI evaluates your input and recommends an urgency tier — from self-care to emergency action.",
    path:        '/triage',
    cta:         'Check Symptoms',
    status:      'Beta',
    statusClass: 'chip-moderate',
    gradient:    'linear-gradient(135deg, #D97706 0%, #DC2626 100%)',
    iconBg:      'rgba(28,92,102,0.1)',
  },
  {
    id:          'feature-directory',
    title:       'Doctor Directory',
    subtitle:    'Local specialists, real-time.',
    description: 'Find nearby clinics, hospitals, and specialists sorted by distance. Filter by specialty, availability, and open status.',
    path:        '/directory',
    cta:         'Find Providers',
    status:      'Live',
    statusClass: 'chip-safe',
    gradient:    'linear-gradient(135deg, #059669 0%, #0D9488 100%)',
    iconBg:      'rgba(28,92,102,0.1)',
  },
]

const STATS = [
  { value: '125K+', label: 'Preventable deaths/yr', sub: 'from misread prescriptions' },
  { value: '55%',   label: 'Patients affected',     sub: 'in rural/semi-urban India' },
  { value: 'FDA',   label: 'Authoritative Data',    sub: 'openFDA · RxNorm · Infermedica' },
  { value: '0',     label: 'Data Stored',           sub: 'Privacy-by-design' },
]

// ----------------------------------------------------------------
// Feature Card
// ----------------------------------------------------------------

function FeatureCard({ feature, index }) {
  const staggerClass = `card-stagger-${Math.min(index + 1, 4)}`

  // Render clean clinical SVGs instead of emojis
  const renderIcon = () => {
    switch (feature.id) {
      case 'feature-scanner':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        )
      case 'feature-medications':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
            <path d="m8.5 8.5 7 7"/>
          </svg>
        )
      case 'feature-triage':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        )
      case 'feature-directory':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <NavLink
      id={feature.id}
      to={feature.path}
      style={{ textDecoration: 'none', display: 'block', height: '100%' }}
      className="cursor-pointer"
    >
      <div
        className={`feature-card card-hover-lift ${staggerClass}`}
        style={{ opacity: 0 }}
      >
        {/* Status chip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span className={`chip ${feature.statusClass}`}>{feature.status}</span>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: feature.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
            opacity: 0.7,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>
        </div>

        {/* Icon */}
        <div
          className="feature-icon-wrapper"
          style={{ background: feature.iconBg }}
        >
          {renderIcon()}
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize:   'clamp(1.1rem, 2vw, 1.25rem)',
          color:      'var(--color-text-primary)',
          margin:     '0 0 0.35rem',
        }}>
          {feature.title}
        </h3>

        {/* Subtitle */}
        <p style={{
          fontSize:      '0.75rem',
          fontWeight:    700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color:         'var(--color-teal)',
          margin:        '0 0 0.875rem',
        }}>
          {feature.subtitle}
        </p>

        {/* Description */}
        <p style={{
          fontSize:   '0.875rem',
          lineHeight: 1.65,
          color:      'var(--color-text-secondary)',
          margin:     '0 0 1.5rem',
          flex:       1,
        }}>
          {feature.description}
        </p>

        {/* CTA */}
        <div style={{
          display:     'inline-flex',
          alignItems:  'center',
          gap:         '0.4rem',
          fontSize:    '0.875rem',
          fontWeight:  700,
          color:       'var(--color-teal)',
          padding:     '0.5rem 0',
          borderBottom: '2px solid transparent',
          transition:  'var(--transition-fast)',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderBottomColor = 'var(--color-teal)' }}
          onMouseLeave={e => { e.currentTarget.style.borderBottomColor = 'transparent' }}
        >
          {feature.cta}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </div>
      </div>
    </NavLink>
  )
}

// ----------------------------------------------------------------
// Hero Section
// ----------------------------------------------------------------

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="hero-section">
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Eyebrow */}
        <div style={{ marginBottom: '1.25rem' }}>
          <span className="chip" style={{
            background:  'rgba(255,255,255,0.15)',
            color:       '#fff',
            border:      '1px solid rgba(255,255,255,0.25)',
            backdropFilter: 'blur(8px)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Your Personal Health Guardian
          </span>
        </div>

        {/* Two-column layout on desktop */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap:                 '2rem',
          alignItems:          'center',
        }}>
          <div>
            {/* Headline */}
            <h1
              id="hero-heading"
              style={{
                fontFamily:  'var(--font-display)',
                fontSize:    'clamp(2rem, 5vw, 3.25rem)',
                color:       '#ffffff',
                lineHeight:  1.12,
                marginBottom:'0.875rem',
                letterSpacing: '-0.02em',
              }}
            >
              Decode Meds.{' '}
              <span style={{
                background: 'linear-gradient(90deg, #2DD4BF, #A5B4FC)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Triage Fast.</span>
              <br />Find Care Now.
            </h1>

            {/* Subheadline */}
            <p style={{
              fontSize:    'clamp(0.95rem, 2vw, 1.1rem)',
              lineHeight:  1.7,
              color:       'rgba(255,255,255,0.8)',
              marginBottom:'2rem',
              maxWidth:    '520px',
            }}>
              Prahari demystifies medication labels, triages your symptoms, and connects
              you to the right local specialist — all backed by{' '}
              <strong style={{ color: '#fff' }}>clinically authoritative data</strong>.
            </p>

            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <NavLink to="/scanner" id="hero-cta-scanner" style={{
                display:         'inline-flex',
                alignItems:      'center',
                gap:             '0.5rem',
                padding:         '0.75rem 1.5rem',
                background:      '#fff',
                color:           'var(--color-teal-dark)',
                fontWeight:      700,
                fontSize:        '0.9375rem',
                borderRadius:    '10px',
                textDecoration:  'none',
                boxShadow:       '0 4px 16px rgba(0,0,0,0.2)',
                transition:      'var(--transition-standard)',
                whiteSpace:      'nowrap',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle' }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Scan a Medication
              </NavLink>
              <NavLink to="/triage" id="hero-cta-triage" style={{
                display:       'inline-flex',
                alignItems:    'center',
                gap:           '0.5rem',
                padding:       '0.75rem 1.5rem',
                background:    'rgba(255,255,255,0.12)',
                color:         '#fff',
                fontWeight:    600,
                fontSize:      '0.9375rem',
                borderRadius:  '10px',
                textDecoration:'none',
                border:        '1.5px solid rgba(255,255,255,0.3)',
                backdropFilter:'blur(8px)',
                transition:    'var(--transition-standard)',
                whiteSpace:    'nowrap',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle' }}>
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                Check Symptoms
              </NavLink>
            </div>
          </div>

          {/* Floating shield icon — hidden on small screens */}
          <div className="float-anim" style={{ display: 'none' }} aria-hidden="true"
            ref={el => {
              if (el) {
                const mq = window.matchMedia('(min-width: 680px)')
                el.style.display = mq.matches ? 'flex' : 'none'
                mq.addEventListener('change', e => { el.style.display = e.matches ? 'flex' : 'none' })
              }
            }}
          >
            <div style={{
              width:  '140px',
              height: '140px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '4rem',
              backdropFilter: 'blur(12px)',
            }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))',
          gap:                 '0.75rem',
          marginTop:           '2.5rem',
          paddingTop:          '2rem',
          borderTop:           '1px solid rgba(255,255,255,0.15)',
        }}>
          {STATS.map((s, i) => (
            <div key={i} className="stat-card">
              <div style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.6rem)', fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: '0.2rem' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '0.1rem' }}>
                {s.label}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ----------------------------------------------------------------
// TrustBadge
// ----------------------------------------------------------------
function TrustBadges() {
  const sources = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 22h18"/>
          <path d="M6 18v-7"/>
          <path d="M10 18v-7"/>
          <path d="M14 18v-7"/>
          <path d="M18 18v-7"/>
          <path d="M4 11h16L12 2z"/>
        </svg>
      ),
      name: 'openFDA',
      desc: 'FDA Drug Labels'
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      name: 'RxNorm',
      desc: 'NLM Drug Database'
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z"/>
        </svg>
      ),
      name: 'Infermedica',
      desc: 'AI Triage Engine'
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      ),
      name: 'Google Places',
      desc: 'Provider Directory'
    },
  ]
  return (
    <div style={{ margin: '0.5rem 0 2.5rem' }}>
      <div className="section-label">Powered by authoritative sources</div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {sources.map(s => (
          <div key={s.name} style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '0.5rem',
            padding:      '0.5rem 0.875rem',
            borderRadius: '10px',
            border:       '1px solid var(--color-border)',
            background:   'var(--color-surface-card)',
            boxShadow:    'var(--shadow-xs)',
            transition:   'var(--transition-fast)',
            cursor:       'default',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-teal)'; e.currentTarget.style.boxShadow = 'var(--shadow-teal)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{s.name}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// HomePage — Default Export
// ----------------------------------------------------------------

export default function HomePage() {
  return (
    <div>
      <Hero />

      <TrustBadges />

      {/* Feature Cards Grid */}
      <section aria-label="Application features">
        <div className="section-label">What Prahari can do</div>
        <div className="grid-auto-fit">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.id} feature={feature} index={i} />
          ))}
        </div>
      </section>

      {/* Privacy Promise */}
      <div style={{
        marginTop:    '2.5rem',
        padding:      '1.25rem 1.5rem',
        borderRadius: '14px',
        background:   'var(--color-teal-subtle)',
        border:       '1px solid rgba(28,92,102,0.15)',
        display:      'flex',
        alignItems:   'center',
        gap:          '1rem',
        flexWrap:     'wrap',
      }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </span>
        <div>
          <p style={{ margin: '0 0 0.15rem', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
            Zero Data Retention
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Camera frames, OCR outputs, and symptom logs are <strong>never stored</strong> beyond a single request. No PII collected, ever.
          </p>
        </div>
        <span className="chip chip-safe" style={{ marginLeft: 'auto', flexShrink: 0 }}>Privacy-First</span>
      </div>
    </div>
  )
}
