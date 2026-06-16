import { useState, useRef, useEffect, useCallback } from 'react'
import { assessTriageChat } from '../../services/api.js'

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icons = {
  Bot: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 8V4m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
      <rect x="3" y="8" width="18" height="12" rx="2" strokeWidth="1.75"/>
      <path d="M7 13h.01M17 13h.01M9 16h6"/>
    </svg>
  ),
  User: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Send: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Alert: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 9v4M12 17h.01"/>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    </svg>
  ),
  Shield: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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
  Refresh: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Typing Indicator Component
// ---------------------------------------------------------------------------
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '0.35rem', padding: '0.5rem 0.25rem' }}>
      <span className="dot-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-muted)', animation: 'pulse 1.2s infinite ease-in-out' }} />
      <span className="dot-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-muted)', animation: 'pulse 1.2s infinite ease-in-out 0.2s' }} />
      <span className="dot-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-muted)', animation: 'pulse 1.2s infinite ease-in-out 0.4s' }} />
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(0.6); opacity: 0.4; }
          50% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Triage Result Summary Card
// ---------------------------------------------------------------------------
function TriageChatResult({ result, onReset }) {
  const { urgency_level, urgency_label, urgency_color, recommendation, conditions, risk_factors, mock_notice } = result

  const ribbonClass = {
    safe: 'ribbon-safe',
    moderate: 'ribbon-moderate',
    critical: 'ribbon-critical',
  }[urgency_level] || 'ribbon-moderate'

  return (
    <div className="modal-enter" style={{ textAlign: 'left', marginTop: '1rem' }}>
      {mock_notice && (
        <div style={{
          backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)',
          borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--color-warning)',
          lineHeight: 1.45, marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
        }}>
          <Icons.Info style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{mock_notice}</span>
        </div>
      )}

      {/* Main Urgency Badge Card */}
      <div className={`card ${ribbonClass}`} style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)' }}>
          Assessment Complete
        </h3>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.4rem 0.875rem', borderRadius: '8px', fontSize: '0.875rem',
          fontWeight: 700, color: `var(--color-${urgency_color})`,
          backgroundColor: `var(--color-${urgency_color}-bg)`,
          border: `1px solid var(--color-${urgency_color}-border)`,
          marginBottom: '1rem'
        }}>
          {urgency_label}
        </div>
        <p style={{ margin: 0, fontSize: '0.925rem', color: 'var(--color-ink)', lineHeight: 1.6 }}>
          {recommendation}
        </p>
      </div>

      {/* Probable Conditions */}
      {conditions && conditions.length > 0 && (
        <div style={{ marginBottom: '1.75rem' }}>
          <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-ink)', marginBottom: '0.75rem' }}>
            Top Probable Explanations
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {conditions.map((cond, idx) => (
              <div key={idx} className="card" style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--color-white)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-ink)' }}>{cond.name}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-forest)' }}>
                    {Math.round(cond.probability * 100)}% Match
                  </span>
                </div>
                <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--color-cream)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${cond.probability * 100}%`,
                    backgroundColor: 'var(--color-forest)', borderRadius: '3px',
                    transition: 'width 0.5s ease-out'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {risk_factors && risk_factors.length > 0 && (
        <div className="card ribbon-critical" style={{ padding: '1.25rem', marginBottom: '1.5rem', backgroundColor: 'var(--color-white)' }}>
          <h4 style={{ margin: '0 0 0.5rem', color: 'var(--color-critical)', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icons.Alert style={{ width: '16px', height: '16px' }} />
            OBSERVED RISK WARNINGS:
          </h4>
          <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {risk_factors.map((item, idx) => (
              <li key={idx} style={{ fontSize: '0.85rem', color: 'var(--color-critical)', lineHeight: 1.5, fontWeight: 500 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button className="btn-primary" onClick={onReset} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
        <Icons.Refresh />
        Start New Conversation
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Chatbot Component
// ---------------------------------------------------------------------------
export default function TriageChatbot() {
  // Config states
  const [sex, setSex] = useState('male')
  const [age, setAge] = useState(30)
  const [started, setStarted] = useState(false)
  const [initialText, setInitialText] = useState('')

  // Conversation state
  const [messages, setMessages] = useState([]) // [{ sender: 'bot'|'user', text: string, question?: object, isTriage?: boolean }]
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(false)
  const [triageResult, setTriageResult] = useState(null)
  
  // Multiple choice group temp states
  const [checkedIds, setCheckedIds] = useState({}) // { [symptomId]: boolean }

  const chatEndRef = useRef(null)

  // Scroll to bottom helper
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Initialize and Seed Triage Chat
  const handleStartChat = async (e) => {
    if (e) e.preventDefault()
    if (!initialText.trim()) return

    setStarted(true)
    setLoading(true)

    // Add user initial message
    const userMsg = { sender: 'user', text: initialText }
    setMessages([userMsg])

    try {
      const response = await assessTriageChat([], sex, age, initialText.trim())
      setEvidence(response.evidence || [])
      
      if (response.should_stop && response.triage_result) {
        setTriageResult(response.triage_result)
        setMessages(prev => [
          ...prev,
          { sender: 'bot', text: 'I have gathered enough details to complete your health assessment. Here are your triage recommendations:', isTriage: true }
        ])
      } else if (response.question) {
        setMessages(prev => [
          ...prev,
          { sender: 'bot', text: response.question.text, question: response.question }
        ])
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [
        ...prev,
        { sender: 'bot', text: 'Oops, I encountered a communication error with our diagnosis server. Let\'s try that again.' }
      ])
    } finally {
      setLoading(false)
    }
  }

  // Answer single Yes/No/Don't Know questions
  const handleSingleAnswer = async (itemId, choiceId, choiceLabel) => {
    setLoading(true)

    // Append to messages list
    setMessages(prev => {
      // Remove question buttons from the last bot message so user can't double-click it
      const copy = [...prev]
      if (copy.length > 0 && copy[copy.length - 1].sender === 'bot') {
        copy[copy.length - 1] = { ...copy[copy.length - 1], question: null }
      }
      return [...copy, { sender: 'user', text: choiceLabel }]
    })

    // Append to evidence
    const updatedEvidence = [...evidence, { id: itemId, choice_id: choiceId }]
    setEvidence(updatedEvidence)

    try {
      const response = await assessTriageChat(updatedEvidence, sex, age)
      setEvidence(response.evidence || updatedEvidence)

      if (response.should_stop && response.triage_result) {
        setTriageResult(response.triage_result)
        setMessages(prev => [
          ...prev,
          { sender: 'bot', text: 'I have gathered enough details to complete your health assessment. Here are your triage recommendations:', isTriage: true }
        ])
      } else if (response.question) {
        setMessages(prev => [
          ...prev,
          { sender: 'bot', text: response.question.text, question: response.question }
        ])
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [
        ...prev,
        { sender: 'bot', text: 'Something went wrong. Let\'s try that step again.' }
      ])
    } finally {
      setLoading(false)
    }
  }

  // Answer group_single (select exactly one or none) questions
  const handleGroupSingleAnswer = async (items, selectedItemId, selectedLabel) => {
    setLoading(true)

    // Remove buttons from last bot msg
    setMessages(prev => {
      const copy = [...prev]
      if (copy.length > 0 && copy[copy.length - 1].sender === 'bot') {
        copy[copy.length - 1] = { ...copy[copy.length - 1], question: null }
      }
      return [...copy, { sender: 'user', text: selectedLabel }]
    })

    // Map evidence
    // In group_single, the chosen symptom is "present", others are "absent"
    const newEvidence = [...evidence]
    items.forEach(item => {
      if (item.id === selectedItemId) {
        newEvidence.push({ id: item.id, choice_id: 'present' })
      } else {
        newEvidence.push({ id: item.id, choice_id: 'absent' })
      }
    })
    setEvidence(newEvidence)

    try {
      const response = await assessTriageChat(newEvidence, sex, age)
      setEvidence(response.evidence || newEvidence)

      if (response.should_stop && response.triage_result) {
        setTriageResult(response.triage_result)
        setMessages(prev => [
          ...prev,
          { sender: 'bot', text: 'Health assessment completed. Here are your results:', isTriage: true }
        ])
      } else if (response.question) {
        setMessages(prev => [
          ...prev,
          { sender: 'bot', text: response.question.text, question: response.question }
        ])
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [
        ...prev,
        { sender: 'bot', text: 'Error submitting answer. Please retry.' }
      ])
    } finally {
      setLoading(false)
    }
  }

  // Submit group_multiple checklist answers
  const handleGroupMultipleSubmit = async (items) => {
    setLoading(true)

    const checkedNames = items
      .filter(item => checkedIds[item.id])
      .map(item => item.name)

    const label = checkedNames.length > 0 
      ? `Yes, I have: ${checkedNames.join(', ')}` 
      : 'No, I have none of these symptoms.'

    // Remove buttons from last bot msg
    setMessages(prev => {
      const copy = [...prev]
      if (copy.length > 0 && copy[copy.length - 1].sender === 'bot') {
        copy[copy.length - 1] = { ...copy[copy.length - 1], question: null }
      }
      return [...copy, { sender: 'user', text: label }]
    })

    // Map evidence
    const newEvidence = [...evidence]
    items.forEach(item => {
      newEvidence.push({
        id: item.id,
        choice_id: checkedIds[item.id] ? 'present' : 'absent'
      })
    })
    setEvidence(newEvidence)
    setCheckedIds({}) // Reset checkbox map

    try {
      const response = await assessTriageChat(newEvidence, sex, age)
      setEvidence(response.evidence || newEvidence)

      if (response.should_stop && response.triage_result) {
        setTriageResult(response.triage_result)
        setMessages(prev => [
          ...prev,
          { sender: 'bot', text: 'Assessment complete. Loading your recommendations:', isTriage: true }
        ])
      } else if (response.question) {
        setMessages(prev => [
          ...prev,
          { sender: 'bot', text: response.question.text, question: response.question }
        ])
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [
        ...prev,
        { sender: 'bot', text: 'Checklist submission failed. Please try again.' }
      ])
    } finally {
      setLoading(false)
    }
  }

  // Reset conversation to initial state
  const resetAll = () => {
    setMessages([])
    setEvidence([])
    setTriageResult(null)
    setInitialText('')
    setStarted(false)
    setCheckedIds({})
  }

  // Render chatbot question controls dynamically
  const renderQuestionControls = (question) => {
    if (!question) return null

    const { type, items } = question

    // type === 'single' (usually Yes / No / Don't Know buttons)
    if (type === 'single') {
      const item = items[0]
      const choices = item.choices || [
        { id: 'present', label: 'Yes' },
        { id: 'absent', label: 'No' },
        { id: 'unknown', label: 'Don\'t Know' }
      ]

      return (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => handleSingleAnswer(item.id, choice.id, choice.label)}
              className="btn-outline"
              style={{
                fontSize: '0.8rem',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                borderColor: 'var(--color-border-strong)',
                background: 'var(--color-white)',
                cursor: 'pointer',
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )
    }

    // type === 'group_single' (radio choices list)
    if (type === 'group_single') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem', maxWidth: '380px' }}>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleGroupSingleAnswer(items, item.id, item.name)}
              className="btn-outline"
              style={{
                textAlign: 'left',
                fontSize: '0.825rem',
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                borderColor: 'var(--color-border-strong)',
                background: 'var(--color-white)',
                cursor: 'pointer',
              }}
            >
              {item.name}
            </button>
          ))}
          <button
            onClick={() => handleGroupSingleAnswer(items, '', 'None of these symptoms')}
            className="btn-ghost"
            style={{
              textAlign: 'center',
              fontSize: '0.8rem',
              padding: '0.5rem 1rem',
              color: 'var(--color-muted)',
              cursor: 'pointer',
            }}
          >
            None of these
          </button>
        </div>
      )
    }

    // type === 'group_multiple' (checklist checkboxes + submit)
    if (type === 'group_multiple') {
      return (
        <div style={{ marginTop: '0.75rem', maxWidth: '400px' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
            backgroundColor: 'var(--color-cream)', padding: '0.875rem 1rem',
            borderRadius: '10px', border: '1px solid var(--color-border)',
            marginBottom: '0.75rem'
          }}>
            {items.map((item) => (
              <label
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.825rem', color: 'var(--color-ink)', cursor: 'pointer',
                  userSelect: 'none', padding: '0.2rem 0'
                }}
              >
                <input
                  type="checkbox"
                  checked={!!checkedIds[item.id]}
                  onChange={(e) => setCheckedIds(prev => ({ ...prev, [item.id]: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-forest)', cursor: 'pointer' }}
                />
                <span>{item.name}</span>
              </label>
            ))}
          </div>
          <button
            onClick={() => handleGroupMultipleSubmit(items)}
            className="btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 1.25rem', borderRadius: '8px' }}
          >
            Submit Symptom Report
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div style={{ textAlign: 'left' }}>
      
      {/* 1. SETUP / SEEDING SCREEN */}
      {!started && (
        <div className="card ribbon-safe" style={{ padding: '2rem 1.5rem', backgroundColor: 'var(--color-white)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              backgroundColor: 'var(--color-forest-subtle)', color: 'var(--color-forest)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icons.Bot />
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                Conversational Symptom Checker
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                Triage chatbot powered by Infermedica clinical data engine.
              </p>
            </div>
          </div>

          <form onSubmit={handleStartChat} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Context row */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="chat-sex-select" style={{ display: 'block', fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.8125rem', color: 'var(--color-ink)' }}>
                  Biological Sex
                </label>
                <select
                  id="chat-sex-select"
                  value={sex}
                  onChange={e => setSex(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px',
                    border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-white)',
                    color: 'var(--color-ink)', fontSize: '0.875rem', outline: 'none'
                  }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '100px' }}>
                <label htmlFor="chat-age-input" style={{ display: 'block', fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.8125rem', color: 'var(--color-ink)' }}>
                  Age (Years)
                </label>
                <input
                  id="chat-age-input"
                  type="number"
                  min={1} max={120}
                  value={age}
                  onChange={e => setAge(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px',
                    border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-white)',
                    color: 'var(--color-ink)', fontSize: '0.875rem', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Prompt input */}
            <div>
              <label htmlFor="chat-prompt-input" style={{ display: 'block', fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.8125rem', color: 'var(--color-ink)' }}>
                How are you feeling today?
              </label>
              <textarea
                id="chat-prompt-input"
                rows={3}
                value={initialText}
                onChange={e => setInitialText(e.target.value)}
                placeholder="e.g. I have a severe throbbing headache, sensitive to light, and nausea since yesterday morning..."
                style={{
                  width: '100%', padding: '0.75rem 0.875rem', borderRadius: '8px',
                  border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-white)',
                  color: 'var(--color-ink)', fontSize: '0.9rem', outline: 'none',
                  resize: 'none', boxSizing: 'border-box', lineHeight: 1.5
                }}
              />
            </div>

            <button
              type="submit"
              disabled={initialText.trim().length < 5}
              className="btn-primary"
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '8px',
                opacity: initialText.trim().length < 5 ? 0.55 : 1
              }}
            >
              Begin Diagnosis
            </button>
          </form>
        </div>
      )}

      {/* 2. ACTIVE CHAT DIALOGUE */}
      {started && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          border: '1.5px solid var(--color-border)', borderRadius: '14px',
          overflow: 'hidden', backgroundColor: 'var(--color-white)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.875rem 1.25rem', backgroundColor: 'var(--color-cream)',
            borderBottom: '1.5px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ color: 'var(--color-forest)' }}><Icons.Bot /></div>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                Prahari Triage Assistant
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              Patient: {sex === 'male' ? 'M' : 'F'}, {age}y
            </span>
          </div>

          {/* Messages Area */}
          <div style={{
            height: '380px', overflowY: 'auto', padding: '1.25rem',
            display: 'flex', flexDirection: 'column', gap: '1rem',
            backgroundColor: 'var(--color-paper-light)'
          }}>
            {/* Bot Greeting */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', maxWidth: '85%' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: 'var(--color-forest-subtle)', color: 'var(--color-forest)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Icons.Bot style={{ width: '18px', height: '18px' }} />
              </div>
              <div style={{
                backgroundColor: 'var(--color-white)', border: '1.5px solid var(--color-border)',
                borderRadius: '0 14px 14px 14px', padding: '0.75rem 1rem',
                fontSize: '0.875rem', color: 'var(--color-ink)', lineHeight: 1.5
              }}>
                Hello, I am Prahari's Triage assistant. I will ask you a few questions to understand your symptoms and determine the appropriate urgency rating.
              </div>
            </div>

            {/* Live Message History */}
            {messages.map((msg, index) => {
              const isBot = msg.sender === 'bot'
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                    alignSelf: isBot ? 'flex-start' : 'flex-end',
                    flexDirection: isBot ? 'row' : 'row-reverse',
                    maxWidth: '85%'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: isBot ? 'var(--color-forest-subtle)' : 'var(--color-amber-subtle)',
                    color: isBot ? 'var(--color-forest)' : 'var(--color-amber)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isBot ? <Icons.Bot style={{ width: '18px', height: '18px' }} /> : <Icons.User style={{ width: '18px', height: '18px' }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                      backgroundColor: isBot ? 'var(--color-white)' : 'var(--color-parchment)',
                      border: '1.5px solid var(--color-border)',
                      borderRadius: isBot ? '0 14px 14px 14px' : '14px 0 14px 14px',
                      padding: '0.75rem 1rem',
                      fontSize: '0.875rem',
                      color: 'var(--color-ink)',
                      lineHeight: 1.5
                    }}>
                      {msg.text}
                    </div>
                    {isBot && msg.question && renderQuestionControls(msg.question)}
                  </div>
                </div>
              )
            })}

            {/* Loading / Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', maxWidth: '85%', alignSelf: 'flex-start' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  backgroundColor: 'var(--color-forest-subtle)', color: 'var(--color-forest)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Icons.Bot style={{ width: '18px', height: '18px' }} />
                </div>
                <div style={{
                  backgroundColor: 'var(--color-white)', border: '1.5px solid var(--color-border)',
                  borderRadius: '0 14px 14px 14px', padding: '0.5rem 0.875rem'
                }}>
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Bottom Area: Either reset button if done, or informational footer */}
          <div style={{
            padding: '0.875rem 1.25rem',
            backgroundColor: 'var(--color-cream)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
              {triageResult ? "Diagnosis complete." : "Answer questions above to progress."}
            </span>
            <button className="btn-ghost" onClick={resetAll} style={{ fontSize: '0.75rem', color: 'var(--color-critical)', padding: '0.2rem 0.5rem' }}>
              Reset Chat
            </button>
          </div>
        </div>
      )}

      {/* 3. DIAGNOSTIC RESULTS OVERLAY (displayed when done) */}
      {triageResult && (
        <TriageChatResult result={triageResult} onReset={resetAll} />
      )}
    </div>
  )
}
