/**
 * Placeholder Page Component
 * ===========================
 * A reusable placeholder rendered for routes not yet implemented
 * (Scanner, Medications, Triage, Directory).
 * Replaced module by module in Phases 3–5.
 */

export default function PlaceholderPage({ title, icon, phase, description }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>{icon}</div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2rem',
          color: 'var(--color-text-primary)',
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', maxWidth: '480px', margin: '0 auto 2rem' }}>
        {description}
      </p>
      <span
        className="chip"
        style={{
          backgroundColor: 'rgba(42, 127, 140, 0.1)',
          color: 'var(--color-teal)',
          fontSize: '0.75rem',
          padding: '0.4rem 1rem',
          borderRadius: '999px',
        }}
      >
        Coming in {phase}
      </span>
    </div>
  )
}
