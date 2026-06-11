/**
 * Prahari — Home / Dashboard Page
 * =================================
 * Landing page shown at the root route "/".
 * Provides an overview of all four main features with
 * feature cards that link to each module.
 *
 * This is a Phase 1 scaffold — the cards link to placeholder pages.
 * Full implementations arrive in Phases 3–5.
 */

import { NavLink } from 'react-router-dom'

// ----------------------------------------------------------------
// Feature Card Data
// ----------------------------------------------------------------

const FEATURES = [
  {
    id: 'feature-scanner',
    title: 'Visual Label Scanner',
    subtitle: 'Point. Capture. Understand.',
    description:
      'Photograph any medication label. Our OCR engine reads the text and instantly looks up clinical information from openFDA and RxNorm.',
    path: '/scanner',
    ribbon: 'ribbon-safe',
    icon: '📷',
    cta: 'Open Scanner',
    status: 'Phase 3',
  },
  {
    id: 'feature-medications',
    title: 'Drug Intelligence',
    subtitle: 'Ingredients · Warnings · Interactions',
    description:
      'Search any medication name to see active ingredients, dosage guidance, contraindications, and drug–drug interaction alerts.',
    path: '/medications',
    ribbon: 'ribbon-safe',
    icon: '💊',
    cta: 'Search Medications',
    status: 'Phase 4',
  },
  {
    id: 'feature-triage',
    title: 'Symptom Triage',
    subtitle: 'Describe. Assess. Act.',
    description:
      `Enter your symptoms in plain language. Infermedica's AI engine evaluates your input and recommends an urgency tier and appropriate action.`,
    path: '/triage',
    ribbon: 'ribbon-moderate',
    icon: '🩺',
    cta: 'Check Symptoms',
    status: 'Phase 5',
  },
  {
    id: 'feature-directory',
    title: 'Doctor Directory',
    subtitle: 'Local specialists, real-time.',
    description:
      'Find nearby clinics, hospitals, and specialists sorted by distance. Filter by specialty, availability, and open status.',
    path: '/directory',
    ribbon: 'ribbon-safe',
    icon: '📍',
    cta: 'Find Providers',
    status: 'Phase 5',
  },
]

// ----------------------------------------------------------------
// Feature Card
// ----------------------------------------------------------------

function FeatureCard({ feature }) {
  return (
    <NavLink
      id={feature.id}
      to={feature.path}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        className={`card ${feature.ribbon}`}
        style={{ height: '100%', cursor: 'pointer', paddingLeft: '1.75rem' }}
      >
        {/* Status badge */}
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <span
            className="chip"
            style={{
              backgroundColor: 'var(--color-beige)',
              color: 'var(--color-text-secondary)',
              fontSize: '0.65rem',
            }}
          >
            {feature.status}
          </span>
        </div>

        {/* Icon */}
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem', lineHeight: 1 }}>
          {feature.icon}
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.2rem',
            color: 'var(--color-text-primary)',
            margin: '0 0 0.25rem',
          }}
        >
          {feature.title}
        </h3>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-teal)',
            margin: '0 0 0.75rem',
          }}
        >
          {feature.subtitle}
        </p>

        {/* Description */}
        <p
          style={{
            fontSize: '0.9rem',
            lineHeight: 1.6,
            color: 'var(--color-text-secondary)',
            margin: '0 0 1.25rem',
          }}
        >
          {feature.description}
        </p>

        {/* CTA */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--color-teal)',
          }}
        >
          {feature.cta}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </span>
      </div>
    </NavLink>
  )
}

// ----------------------------------------------------------------
// Hero Section
// ----------------------------------------------------------------

function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        textAlign: 'center',
        padding: '3rem 0 2.5rem',
        maxWidth: '680px',
        margin: '0 auto',
      }}
    >
      {/* Eyebrow label */}
      <p
        className="chip chip-info"
        style={{
          display: 'inline-flex',
          marginBottom: '1.25rem',
          fontSize: '0.7rem',
        }}
      >
        🛡️ The Sentinel is watching
      </p>

      {/* Main headline */}
      <h1
        id="hero-heading"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          color: 'var(--color-text-primary)',
          lineHeight: 1.15,
          marginBottom: '1rem',
        }}
      >
        Your Personal{' '}
        <span style={{ color: 'var(--color-sage)' }}>Health Sentinel</span>
      </h1>

      {/* Subheadline */}
      <p
        style={{
          fontSize: '1.05rem',
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          marginBottom: '2rem',
        }}
      >
        Prahari demystifies medication labels, triages your symptoms, and guides
        you to the right local specialist — all backed by{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>
          clinically authoritative data
        </strong>
        , never proprietary diagnoses.
      </p>

      {/* CTA buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <NavLink to="/scanner" id="hero-cta-scanner" className="btn-primary">
          📷 Scan a Medication
        </NavLink>
        <NavLink to="/triage" id="hero-cta-triage" className="btn-secondary">
          🩺 Check Symptoms
        </NavLink>
      </div>
    </section>
  )
}

// ----------------------------------------------------------------
// HomePage — Default Export
// ----------------------------------------------------------------

export default function HomePage() {
  return (
    <div>
      <Hero />

      {/* Feature Cards Grid */}
      <section aria-label="Application features">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.25rem',
            marginTop: '1rem',
          }}
        >
          {FEATURES.map(feature => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      </section>
    </div>
  )
}
