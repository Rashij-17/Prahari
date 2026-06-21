import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { decryptText } from '../services/crypto'
import { getUserProfile, clinicianChat } from '../services/api'

const formatMessageTextHtml = (text) => {
  if (!text) return { __html: '' };
  let safeText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  safeText = safeText.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
  safeText = safeText.replace(/^###\s+(.+)$/gm, '<strong style="font-size: 1.1em; display: block; margin-top: 0.5rem; color: var(--color-forest);">$1</strong>');
  safeText = safeText.replace(/^##\s+(.+)$/gm, '<strong style="font-size: 1.25em; display: block; margin-top: 0.75rem; color: var(--color-forest);">$1</strong>');
  safeText = safeText.replace(/^#\s+(.+)$/gm, '<strong style="font-size: 1.4em; display: block; margin-top: 1rem; color: var(--color-forest);">$1</strong>');
  safeText = safeText.replace(/^\*\s*$/gm, '<hr style="border: 0; border-top: 1.5px dashed var(--color-border); margin: 0.75rem 0;" />');
  safeText = safeText.replace(/^\*\s+/gm, '• ');
  safeText = safeText.replace(/\*([^\*\n]+?)\*/g, '<em>$1</em>');
  safeText = safeText.replace(/\n/g, '<br />');
  
  return { __html: safeText };
};

export default function PocketClinicianPage() {
  const { user, token } = useAuth()
  const encryptionSeed = user?.id || 'demo-fallback-seed'

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('prahari_clinician_messages')
    return saved ? JSON.parse(saved) : [
      {
        role: 'model',
        text: 'Hello! I am Prahari\u2019s Pocket Clinician. I can analyze safety warnings for your medications, allergies, and health conditions. How can I help you today?'
      }
    ]
  })
  
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAiButton, setShowAiButton] = useState(false)
  const [lastUserQuery, setLastUserQuery] = useState('')
  const [isEmergency, setIsEmergency] = useState(false)

  const [allergies, setAllergies] = useState([])
  const [labs, setLabs] = useState([])
  const [meds, setMeds] = useState([])
  const [profileLoading, setProfileLoading] = useState(false)

  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
    localStorage.setItem('prahari_clinician_messages', JSON.stringify(messages))
  }, [messages])

  const loadProfileContext = async () => {
    setProfileLoading(true)
    try {
      const prof = await getUserProfile(token).catch(() => ({ allergies: '', lab_results: '' }))
      let decAllergies = []
      let decLabs = []
      if (prof.allergies) {
        const decAll = await decryptText(prof.allergies, encryptionSeed)
        try { decAllergies = JSON.parse(decAll) } catch {}
      }
      if (prof.lab_results) {
        const decL = await decryptText(prof.lab_results, encryptionSeed)
        try { decLabs = JSON.parse(decL) } catch {}
      }
      setAllergies(decAllergies)
      setLabs(decLabs)
      const res = await fetch('http://localhost:8000/medication/cabinet', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const cabinet = await res.json()
        const decCabinet = []
        for (const item of cabinet) {
          const decBrand = await decryptText(item.brand_name, encryptionSeed)
          const decGeneric = await decryptText(item.generic_name || '', encryptionSeed)
          decCabinet.push({ brand_name: decBrand, generic_name: decGeneric })
        }
        setMeds(decCabinet)
      }
    } catch (err) {
      console.error('Failed to load profile context:', err)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => { loadProfileContext() }, [])

  const handleSend = async (e, forceAiScan = false) => {
    if (e) e.preventDefault()
    const activeQuery = forceAiScan ? lastUserQuery : query
    if (!activeQuery.trim() && !forceAiScan) return

    setLoading(true)
    setShowAiButton(false)
    setIsEmergency(false)

    let updatedMessages = [...messages]
    if (!forceAiScan) {
      updatedMessages.push({ role: 'user', text: activeQuery.trim() })
      setMessages(updatedMessages)
      setLastUserQuery(activeQuery.trim())
      setQuery('')
    }

    try {
      const historyPayload = updatedMessages.map((m) => ({ role: m.role, text: m.text }))
      const chatRes = await clinicianChat(
        token, activeQuery.trim(), historyPayload, forceAiScan,
        allergies, labs.map((l) => `${l.key}: ${l.value}`)
      )
      setMessages((prev) => [...prev, { role: 'model', text: chatRes.response }])
      if (chatRes.is_emergency) setIsEmergency(true)
      const hasWarnings = chatRes.local_warnings && chatRes.local_warnings.length > 0
      const isBlocked = chatRes.response.includes('Safety Warning Alert')
      if (hasWarnings && isBlocked && !forceAiScan) setShowAiButton(true)
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'model', text: `Failed to fetch response: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleClearChat = () => {
    if (confirm('Clear chat logs?')) {
      const initial = [{ role: 'model', text: 'Hello! I am Prahari\u2019s Pocket Clinician. I can analyze safety warnings for your medications, allergies, and health conditions. How can I help you today?' }]
      setMessages(initial)
      localStorage.removeItem('prahari_clinician_messages')
      setShowAiButton(false)
      setIsEmergency(false)
    }
  }

  const resetChat = () => {
    const initial = [{ role: 'model', text: 'Hello! I am Prahari\u2019s Pocket Clinician. I can analyze safety warnings for your medications, allergies, and health conditions. How can I help you today?' }]
    setMessages(initial)
    localStorage.removeItem('prahari_clinician_messages')
    setShowAiButton(false)
    setIsEmergency(false)
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 280px',
      height: 'calc(100vh - 140px)',
      gap: '1.25rem',
      fontFamily: 'var(--font-sans)',
      padding: '1rem 1.5rem',
    }}>
      <style>{`
        @keyframes clinicSpin { 0%{transform:rotate(0deg);}100%{transform:rotate(360deg);} }
        @keyframes pulseBorder {
          0%,100% { box-shadow: 0 0 0 0 rgba(185,28,28,0.25); }
          50%      { box-shadow: 0 0 0 8px rgba(185,28,28,0); }
        }
        .clinic-spin { animation: clinicSpin 1s linear infinite; }
      `}</style>

      {/* ── Column 1: Chat interface ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-white)',
        border: '1.5px solid var(--color-border)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}>
        
        {/* Titlebar */}
        <div style={{
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-paper)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-forest)', margin: 0, fontFamily: 'var(--font-display)' }}>
              🧠 Pocket Clinician AI
            </h1>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
              E2EE-integrated context-aware safety assistant
            </span>
          </div>
          <button
            onClick={handleClearChat}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--color-critical)',
              background: 'transparent',
              border: '1px solid var(--color-critical-border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Clear History
          </button>
        </div>

        {/* Disclaimer banner */}
        <div style={{
          padding: '0.6rem 1.25rem',
          backgroundColor: 'var(--color-warning-bg)',
          borderBottom: '1px solid var(--color-warning-border)',
          color: 'var(--color-warning)',
          fontSize: '0.78rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexShrink: 0,
        }}>
          ⚠️ <strong>Disclaimer:</strong> Informational AI tool. Not a replacement for direct medical consultations.
        </div>

        {/* Emergency overlay */}
        {isEmergency && (
          <div style={{
            margin: '0.75rem 1.25rem',
            padding: '1rem',
            backgroundColor: 'var(--color-critical-bg)',
            border: '2px solid var(--color-critical-border)',
            borderRadius: '12px',
            color: 'var(--color-critical)',
            animation: 'pulseBorder 2s infinite',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
            flexShrink: 0,
          }}>
            <h3 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
              🚨 EMERGENCY GUIDANCE DISPATCHED
            </h3>
            <p style={{ margin: 0, fontSize: '0.83rem', lineHeight: 1.5 }}>
              If you or the patient are experiencing chest pain, slurred speech, or breathing difficulties, call <strong>112</strong> or go to the nearest emergency ward immediately.
            </p>
            <button
              onClick={resetChat}
              style={{
                padding: '0.4rem 0.875rem', fontSize: '0.8rem', fontWeight: 700,
                color: 'white', background: 'var(--color-critical)', border: 'none',
                borderRadius: '8px', cursor: 'pointer', alignSelf: 'flex-start',
                fontFamily: 'var(--font-sans)',
              }}
            >
              🔄 Clear &amp; Start Next Chat
            </button>
          </div>
        )}

        {/* Messages scroll area */}
        <div style={{
          flex: 1,
          padding: '1.25rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          background: 'var(--color-cream)',
        }}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}
            >
              {/* AI avatar */}
              {msg.role !== 'user' && (
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: 'var(--color-forest-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', border: '1px solid var(--color-border)',
                  flexShrink: 0,
                }}>
                  🩺
                </div>
              )}

              {/* Message bubble */}
              <div style={{
                maxWidth: '75%',
                padding: '0.75rem 1rem',
                borderRadius: '16px',
                fontSize: '0.875rem',
                lineHeight: 1.55,
                whiteSpace: 'pre-line',
                boxShadow: 'var(--shadow-xs)',
                backgroundColor: msg.role === 'user'
                  ? 'var(--color-forest)'
                  : 'var(--color-white)',
                color: msg.role === 'user'
                  ? '#ffffff'
                  : 'var(--color-ink)',
                border: msg.role === 'user'
                  ? 'none'
                  : '1px solid var(--color-border)',
                borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderTopLeftRadius: msg.role === 'user' ? '16px' : '4px',
              }}>
                <div dangerouslySetInnerHTML={formatMessageTextHtml(msg.text)} />

                {/* Detailed AI scan inline CTA */}
                {msg.role === 'model' && index === messages.length - 1 && showAiButton && (
                  <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--color-border)' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0 0 0.5rem' }}>
                      Would you like to bypass local cache and run a detailed clinical AI review?
                    </p>
                    <button
                      onClick={(e) => handleSend(e, true)}
                      disabled={loading}
                      style={{
                        background: 'var(--color-forest)', color: 'white', border: 'none',
                        borderRadius: '8px', padding: '0.4rem 0.875rem',
                        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {loading ? 'Analyzing...' : '✨ Run Detailed AI Scan'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'var(--color-forest-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--color-border)',
              }}>
                🩺
              </div>
              <div style={{
                padding: '0.65rem 1rem',
                background: 'var(--color-white)',
                border: '1px solid var(--color-border)',
                borderRadius: '16px',
                borderTopLeftRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span className="clinic-spin" style={{
                  width: '13px', height: '13px',
                  border: '2px solid var(--color-border)',
                  borderTop: '2px solid var(--color-forest)',
                  borderRadius: '50%', display: 'block',
                }} />
                <span style={{ fontSize: '0.83rem', color: 'var(--color-muted)' }}>Evaluating safety profile...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <form
          onSubmit={(e) => handleSend(e, false)}
          style={{
            padding: '0.875rem 1.25rem',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-paper)',
            display: 'flex',
            gap: '0.625rem',
            flexShrink: 0,
          }}
        >
          <input
            type="text"
            placeholder="Ask about medications, side effects, or warning flags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              border: '1.5px solid var(--color-border)',
              fontSize: '0.9rem',
              outline: 'none',
              background: 'var(--color-white)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)',
              transition: 'border-color 140ms ease',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--color-forest)'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-primary-forest"
            style={{ borderRadius: '10px', padding: '0.65rem 1.25rem', fontSize: '0.9rem', opacity: (loading || !query.trim()) ? 0.5 : 1, cursor: (loading || !query.trim()) ? 'not-allowed' : 'pointer' }}
          >
            Send
          </button>
        </form>
      </div>

      {/* ── Column 2: Profile Context Sidebar ── */}
      <div style={{
        background: 'var(--color-white)',
        border: '1.5px solid var(--color-border)',
        borderRadius: '16px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Header */}
        <div>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--color-forest)', margin: '0 0 0.2rem', fontFamily: 'var(--font-display)' }}>
            📋 Active Patient Profile
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
            Compiled context for queries
          </span>
        </div>

        {profileLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted)', fontSize: '0.83rem' }}>
            <span className="clinic-spin" style={{ width: '14px', height: '14px', border: '2px solid var(--color-border)', borderTop: '2px solid var(--color-forest)', borderRadius: '50%', display: 'block' }} />
            Loading context...
          </div>
        )}

        {!profileLoading && (
          <>
            {/* Medications */}
            <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '1rem' }}>
              <div className="section-label">💊 Cabinet Medications ({meds.length})</div>
              {meds.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--color-faint)', margin: 0, fontStyle: 'italic' }}>No medicines registered.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {meds.map((m, i) => (
                  <div key={i} style={{
                    fontSize: '0.8rem', padding: '0.35rem 0.625rem',
                    background: 'var(--color-cream)', border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                  }}>
                    <strong style={{ color: 'var(--color-forest)' }}>{m.brand_name}</strong>
                    {m.generic_name && <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-muted)' }}>{m.generic_name}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Allergies */}
            <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '1rem' }}>
              <div className="section-label">🚫 Allergies ({allergies.length})</div>
              {allergies.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--color-faint)', margin: 0, fontStyle: 'italic' }}>No allergy tags.</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {allergies.map((a, i) => (
                  <span key={i} className="chip chip-critical">{a}</span>
                ))}
              </div>
            </div>

            {/* Lab metrics */}
            <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '1rem', borderBottom: '1px dashed var(--color-border)', paddingBottom: '1rem' }}>
              <div className="section-label">🔬 Lab Markers ({labs.length})</div>
              {labs.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--color-faint)', margin: 0, fontStyle: 'italic' }}>No lab notes.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {labs.map((l, i) => (
                  <div key={i} style={{
                    fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between',
                    padding: '0.35rem 0.625rem',
                    background: 'var(--color-cream)', border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{l.key}</span>
                    <span style={{ color: 'var(--color-forest)', fontWeight: 600 }}>{l.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: '0.72rem', color: 'var(--color-faint)', lineHeight: 1.5, margin: 0 }}>
              💡 Configure profile on the <strong>Sentinel Settings</strong> page.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
