/**
 * TriagePage
 * ===========
 * Symptom Triage Analyzer — users describe symptoms in plain language
 * and receive an urgency classification + actionable recommendation.
 *
 * States: idle → loading → result | error
 * Source: FEATURES_AND_STRUCTURE.md §2.3
 */

import { useState } from 'react'
import { assessSymptoms } from '../services/api.js'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const URGENCY_CONFIG = {
  safe: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    color: 'var(--color-safe)',
    bg: 'var(--color-safe-bg)',
    cls: 'ribbon-safe'
  },
  moderate: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-bg)',
    cls: 'ribbon-moderate'
  },
  critical: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    color: 'var(--color-critical)',
    bg: 'var(--color-critical-bg)',
    cls: 'ribbon-critical'
  },
}

function UrgencyResult({ result, onReset }) {
  const cfg = URGENCY_CONFIG[result.urgency_level] || URGENCY_CONFIG.moderate

  return (
    <div className="modal-enter">
      {/* Main urgency card */}
      <div
        className={`card ${cfg.cls}`}
        style={{
          backgroundColor: 'var(--color-white)',
          padding: '1.5rem',
          marginBottom: '1.25rem',
          borderLeftWidth: '4px',
          textAlign: 'left'
        }}
        role="alert"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.875rem', color: cfg.color }}>
          <div style={{ display: 'flex', color: cfg.color }}>{cfg.icon}</div>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '1.25rem',
            color: 'var(--color-ink)',
            margin: 0,
            fontWeight: 700
          }}>
            {result.urgency_label}
          </h2>
        </div>
        <p style={{ color: 'var(--color-muted)', margin: 0, lineHeight: 1.6, fontSize: '0.9375rem' }}>
          {result.recommendation}
        </p>
      </div>

      {/* Mock notice */}
      {result.is_mock && result.mock_notice && (
        <div style={{
          backgroundColor: 'var(--color-cream)',
          borderRadius: '10px',
          padding: '0.875rem 1.125rem',
          fontSize: '0.825rem',
          color: 'var(--color-muted)',
          marginBottom: '1.25rem',
          border: '1px solid var(--color-border)',
          textAlign: 'left'
        }}>
          {result.mock_notice}
        </div>
      )}

      {/* Top conditions */}
      {result.conditions?.length > 0 && (
        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.875rem', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>
            Most Likely Conditions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {result.conditions.map((c, i) => (
              <div key={i} className="card" style={{
                padding: '0.875rem 1.125rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--color-white)',
                borderColor: 'var(--color-border)',
                borderRadius: '10px',
                transform: 'none',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-ink)', fontSize: '0.9rem' }}>
                  {c.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '80px',
                    height: '6px',
                    backgroundColor: 'var(--color-cream)',
                    borderRadius: '99px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.round(c.probability * 100)}%`,
                      height: '100%',
                      backgroundColor: 'var(--color-forest)',
                      borderRadius: '99px'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.785rem', color: 'var(--color-muted)', fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>
                    {Math.round(c.probability * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        fontSize: '0.775rem',
        color: 'var(--color-muted)',
        lineHeight: 1.6,
        borderTop: '1px solid var(--color-border)',
        paddingTop: '0.875rem',
        margin: '0 0 1.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        textAlign: 'left'
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '0.125rem', color: 'var(--color-faint)' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          This assessment is for educational purposes only and does not constitute medical advice.
          Always consult a qualified healthcare professional for medical decisions.
        </span>
      </div>

      <div style={{ textAlign: 'left' }}>
        <button
          id="triage-reset-btn"
          className="btn-primary-forest"
          onClick={onReset}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73" />
          </svg>
          Assess New Symptoms
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const SYMPTOM_EXAMPLES = [
  'I have a severe headache and stiff neck with fever since yesterday',
  'Chest pain radiating to my left arm, feeling dizzy and short of breath',
  'I have a mild cough, runny nose, and slight sore throat for 2 days',
  'Sharp stomach pain in lower right side that gets worse when I move',
]

export default function TriagePage() {
  const [phase,    setPhase]    = useState('idle')
  const [symptoms, setSymptoms] = useState('')
  const [sex,      setSex]      = useState('male')
  const [age,      setAge]      = useState(30)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')

  const handleAssess = async () => {
    if (symptoms.trim().length < 5) return
    setPhase('loading')
    setError('')

    try {
      const data = await assessSymptoms({ symptoms, sex, age })
      setResult(data)
      setPhase('result')
    } catch (err) {
      setError(err.message || 'Triage assessment failed. Please try again.')
      setPhase('error')
    }
  }

  const reset = () => {
    setResult(null)
    setSymptoms('')
    setPhase('idle')
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>

      {/* Heading */}
      {phase !== 'result' && (
        <div style={{ marginBottom: '1.75rem', textAlign: 'left' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', margin: '0 0 0.5rem' }}>
            Symptom Triage Analyzer
          </h1>
          <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '0.975rem', lineHeight: 1.6 }}>
            Describe your symptoms in plain language. Prahari will assess urgency and
            recommend your next step — self-care, doctor visit, or emergency.
          </p>
        </div>
      )}

      {/* === IDLE / FORM === */}
      {(phase === 'idle' || phase === 'error') && (
        <div style={{ textAlign: 'left' }}>
          {/* Symptom text area */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="symptom-input"
              style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-ink)', fontSize: '0.9rem' }}
            >
              Describe your symptoms
            </label>
            <textarea
              id="symptom-input"
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              placeholder="e.g. I have a fever of 39°C, severe headache, and stiff neck for the past 6 hours…"
              rows={5}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                borderRadius: '10px',
                border: '1.5px solid var(--color-border)',
                backgroundColor: 'var(--color-white)',
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9375rem',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                lineHeight: 1.6,
                transition: 'var(--transition-fast)',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--color-forest)';
                e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--color-border)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <p style={{ fontSize: '0.785rem', color: 'var(--color-muted)', margin: '0.375rem 0 0' }}>
              Include symptom duration, severity (1–10), and any relevant medical history.
            </p>
          </div>

          {/* Patient context */}
          <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label htmlFor="sex-select" style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-ink)' }}>
                Biological sex
              </label>
              <select
                id="sex-select"
                value={sex}
                onChange={e => setSex(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.875rem',
                  borderRadius: '9px',
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-white)',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  transition: 'var(--transition-fast)',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-forest)';
                  e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--color-border)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '120px' }}>
              <label htmlFor="age-input" style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-ink)' }}>
                Age
              </label>
              <input
                id="age-input"
                type="number"
                min={1} max={120}
                value={age}
                onChange={e => setAge(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.875rem',
                  borderRadius: '9px',
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-white)',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  transition: 'var(--transition-fast)',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-forest)';
                  e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--color-border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Quick examples */}
          <p style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.625rem' }}>
            Try an example:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.75rem' }}>
            {SYMPTOM_EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setSymptoms(ex)}
                style={{
                  textAlign: 'left',
                  padding: '0.625rem 1rem',
                  borderRadius: '9px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-white)',
                  color: 'var(--color-muted)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  lineHeight: 1.45,
                  transition: 'var(--transition-fast)',
                  outline: 'none',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-forest)';
                  e.target.style.color = 'var(--color-ink)';
                  e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--color-border)';
                  e.target.style.color = 'var(--color-muted)';
                  e.target.style.boxShadow = 'none';
                }}
                onMouseEnter={e => {
                  e.target.style.borderColor = 'var(--color-forest)';
                  e.target.style.color = 'var(--color-ink)';
                }}
                onMouseLeave={e => {
                  if (document.activeElement !== e.target) {
                    e.target.style.borderColor = 'var(--color-border)';
                    e.target.style.color = 'var(--color-muted)';
                  }
                }}
              >
                "{ex}"
              </button>
            ))}
          </div>

          {/* Error */}
          {phase === 'error' && (
            <div className="card ribbon-moderate" style={{ padding: '0.875rem 1.125rem', marginBottom: '1.5rem', borderLeftWidth: '3px', backgroundColor: 'var(--color-warning-bg)' }}>
              <p style={{ color: 'var(--color-warning)', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          <button
            id="triage-submit-btn"
            className="btn-primary"
            onClick={handleAssess}
            disabled={symptoms.trim().length < 5}
            style={{
              opacity: symptoms.trim().length < 5 ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: 'auto'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.8 3A2.4 2.4 0 1 0 9.6 3A2.4 2.4 0 1 0 4.8 3z"/>
              <path d="M14.4 3A2.4 2.4 0 1 0 19.2 3A2.4 2.4 0 1 0 14.4 3z"/>
              <path d="M7.2 5.4v4.2a4.8 4.8 0 0 0 9.6 0V5.4"/>
              <path d="M12 9.6v5.4a3 3 0 0 0 6 0v-1.2"/>
              <circle cx="18" cy="11.4" r="2"/>
            </svg>
            Assess My Symptoms
          </button>
        </div>
      )}

      {/* === LOADING === */}
      {phase === 'loading' && (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <div className="pulse-ring" style={{ width: '64px', height: '64px', margin: '0 auto 1.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 7v9c0 6.627 5.373 12 12 12s12-5.373 12-12V7L16 2z"
                fill="var(--color-forest-subtle)" stroke="var(--color-forest)" strokeWidth="1.75" />
              <rect x="14" y="9" width="4" height="14" rx="1.5" fill="var(--color-forest)" />
              <rect x="9" y="14" width="14" height="4" rx="1.5" fill="var(--color-forest)" />
            </svg>
          </div>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9375rem', fontWeight: 500 }}>
            Analysing your symptoms…
          </p>
        </div>
      )}

      {/* === RESULT === */}
      {phase === 'result' && result && (
        <UrgencyResult result={result} onReset={reset} />
      )}
    </div>
  )
}
