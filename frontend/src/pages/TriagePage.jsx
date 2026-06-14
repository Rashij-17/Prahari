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
  safe:     { icon: '✅', color: 'var(--color-alert-safe)',     bg: 'var(--color-alert-safe-bg)',     cls: 'ribbon-safe' },
  moderate: { icon: '⚠️', color: 'var(--color-alert-moderate)', bg: 'var(--color-alert-moderate-bg)', cls: 'ribbon-moderate' },
  critical: { icon: '🚨', color: 'var(--color-alert-critical)', bg: 'var(--color-alert-critical-bg)', cls: 'ribbon-critical' },
}

function UrgencyResult({ result, onReset }) {
  const cfg = URGENCY_CONFIG[result.urgency_level] || URGENCY_CONFIG.moderate

  return (
    <div className="modal-enter">
      {/* Main urgency card */}
      <div
        className={`card ${cfg.cls}`}
        style={{ backgroundColor: cfg.bg, padding: '1.5rem 1.5rem 1.5rem 1.75rem', marginBottom: '1rem' }}
        role="alert"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>{cfg.icon}</span>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            color: cfg.color,
            margin: 0,
          }}>
            {result.urgency_label}
          </h2>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.7 }}>
          {result.recommendation}
        </p>
      </div>

      {/* Mock notice */}
      {result.is_mock && (
        <div style={{
          backgroundColor: 'var(--color-beige)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          fontSize: '0.8rem',
          color: 'var(--color-text-secondary)',
          marginBottom: '1rem',
        }}>
          {result.mock_notice}
        </div>
      )}

      {/* Top conditions */}
      {result.conditions?.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem', color: 'var(--color-text-primary)' }}>
            Most Likely Conditions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {result.conditions.map((c, i) => (
              <div key={i} className="card" style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                  {c.name}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    width: '100px',
                    height: '6px',
                    backgroundColor: 'var(--color-border)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginBottom: '2px',
                  }}>
                    <div style={{
                      width: `${Math.round(c.probability * 100)}%`,
                      height: '100%',
                      backgroundColor: 'var(--color-sage)',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                    {Math.round(c.probability * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p style={{
        fontSize: '0.75rem',
        color: 'var(--color-text-secondary)',
        fontStyle: 'italic',
        lineHeight: 1.6,
        borderTop: '1px solid var(--color-border)',
        paddingTop: '0.75rem',
        margin: '0 0 1.25rem',
      }}>
        ⚕️ This assessment is for educational purposes only and does not constitute medical advice.
        Always consult a qualified healthcare professional for medical decisions.
      </p>

      <button id="triage-reset-btn" className="btn-primary" onClick={onReset}>
        🩺 Assess New Symptoms
      </button>
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
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--color-text-primary)', margin: '0 0 0.375rem' }}>
            Symptom Triage Analyzer
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Describe your symptoms in plain language. Prahari will assess urgency and
            recommend your next step — self-care, doctor visit, or emergency.
          </p>
        </div>
      )}

      {/* === IDLE / FORM === */}
      {(phase === 'idle' || phase === 'error') && (
        <div>
          {/* Symptom text area */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="symptom-input"
              style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}
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
                backgroundColor: 'var(--color-surface-card)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9rem',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                lineHeight: 1.6,
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-teal)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: '0.375rem 0 0' }}>
              Include symptom duration, severity (1–10), and any relevant medical history.
            </p>
          </div>

          {/* Patient context */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label htmlFor="sex-select" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                Biological sex
              </label>
              <select
                id="sex-select"
                value={sex}
                onChange={e => setSex(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.9rem',
                }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '120px' }}>
              <label htmlFor="age-input" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
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
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          {/* Quick examples */}
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
            Try an example:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1.5rem' }}>
            {SYMPTOM_EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setSymptoms(ex)}
                style={{
                  textAlign: 'left',
                  padding: '0.5rem 0.875rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-card)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                }}
              >
                "{ex}"
              </button>
            ))}
          </div>

          {/* Error */}
          {phase === 'error' && (
            <div className="card ribbon-moderate" style={{ padding: '1rem 1.25rem 1rem 1.5rem', marginBottom: '1.25rem' }}>
              <p style={{ color: 'var(--color-alert-moderate)', margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            id="triage-submit-btn"
            className="btn-primary"
            onClick={handleAssess}
            disabled={symptoms.trim().length < 5}
            style={{ opacity: symptoms.trim().length < 5 ? 0.5 : 1 }}
          >
            🩺 Assess My Symptoms
          </button>
        </div>
      )}

      {/* === LOADING === */}
      {phase === 'loading' && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div className="pulse-ring" style={{ width: '56px', height: '56px', margin: '0 auto 1.25rem' }}>
            <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 7v9c0 6.627 5.373 12 12 12s12-5.373 12-12V7L16 2z"
                fill="var(--color-teal)" fillOpacity="0.2" stroke="var(--color-teal)" strokeWidth="1.5" />
              <rect x="14" y="9" width="4" height="14" rx="1" fill="var(--color-sage)" />
              <rect x="9" y="14" width="14" height="4" rx="1" fill="var(--color-sage)" />
            </svg>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
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
