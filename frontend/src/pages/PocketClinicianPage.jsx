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

  // Bold (**text**) - constrained to a single line to prevent layout leakage
  safeText = safeText.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
  
  // Headings (e.g. ### Heading)
  safeText = safeText.replace(/^###\s+(.+)$/gm, '<strong style="font-size: 1.1em; display: block; margin-top: 0.5rem; color: var(--color-forest);">$1</strong>');
  safeText = safeText.replace(/^##\s+(.+)$/gm, '<strong style="font-size: 1.25em; display: block; margin-top: 0.75rem; color: var(--color-forest);">$1</strong>');
  safeText = safeText.replace(/^#\s+(.+)$/gm, '<strong style="font-size: 1.4em; display: block; margin-top: 1rem; color: var(--color-forest);">$1</strong>');

  // Horizontal rules (a single asterisk on a line, possibly with whitespace)
  safeText = safeText.replace(/^\*\s*$/gm, '<hr style="border: 0; border-top: 1.5px dashed var(--color-mint-border); margin: 0.75rem 0;" />');
  
  // Bullet points (* Item)
  safeText = safeText.replace(/^\*\s+/gm, '• ');
  
  // Italics (*text*) - constrained to a single line to prevent layout leakage
  safeText = safeText.replace(/\*([^\*\n]+?)\*/g, '<em>$1</em>');
  
  // Newlines to line breaks
  safeText = safeText.replace(/\n/g, '<br />');
  
  return { __html: safeText };
};

export default function PocketClinicianPage() {
  const { user, token } = useAuth()
  const encryptionSeed = user?.id || 'demo-fallback-seed'

  // Chat conversation state
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('prahari_clinician_messages')
    return saved ? JSON.parse(saved) : [
      {
        role: 'model',
        text: 'Hello! I am Prahari’s Pocket Clinician. I can analyze safety warnings for your medications, allergies, and health conditions. How can I help you today?'
      }
    ]
  })
  
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAiButton, setShowAiButton] = useState(false)
  const [lastUserQuery, setLastUserQuery] = useState('')
  const [isEmergency, setIsEmergency] = useState(false)

  // Profile Context (for UI Sidebar)
  const [allergies, setAllergies] = useState([])
  const [labs, setLabs] = useState([])
  const [meds, setMeds] = useState([])
  const [profileLoading, setProfileLoading] = useState(false)

  const messagesEndRef = useRef(null)

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
    localStorage.setItem('prahari_clinician_messages', JSON.stringify(messages))
  }, [messages])

  // Load patient context details
  const loadProfileContext = async () => {
    setProfileLoading(true)
    try {
      // Load allergies and labs
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

      // Load medicine cabinet
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
      console.error('Failed to load profile context for clinician chat:', err)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    loadProfileContext()
  }, [])

  // -------------------------------------------------------------
  // Chat Submit Handlers
  // -------------------------------------------------------------

  const handleSend = async (e, forceAiScan = false) => {
    if (e) e.preventDefault()
    
    const activeQuery = forceAiScan ? lastUserQuery : query
    if (!activeQuery.trim() && !forceAiScan) return

    setLoading(true)
    setShowAiButton(false)
    setIsEmergency(false)

    // Add user message to UI
    let updatedMessages = [...messages]
    if (!forceAiScan) {
      updatedMessages.push({ role: 'user', text: activeQuery.trim() })
      setMessages(updatedMessages)
      setLastUserQuery(activeQuery.trim())
      setQuery('')
    }

    try {
      // Map ChatMessage format to matches backend Pydantic ClinicianChatRequest message histories
      const historyPayload = updatedMessages.map((m) => ({
        role: m.role,
        text: m.text
      }))

      const chatRes = await clinicianChat(
        token,
        activeQuery.trim(),
        historyPayload,
        forceAiScan,
        allergies,
        labs.map((l) => `${l.key}: ${l.value}`)
      )

      setMessages((prev) => [
        ...prev,
        { role: 'model', text: chatRes.response }
      ])

      // Check if emergency alert triggered
      if (chatRes.is_emergency) {
        setIsEmergency(true)
      }

      // If local safety rules matched a warning and blocked the response, show the "Detailed AI Scan" button
      const hasWarnings = chatRes.local_warnings && chatRes.local_warnings.length > 0
      const isBlocked = chatRes.response.includes('Safety Warning Alert')
      if (hasWarnings && isBlocked && !forceAiScan) {
        setShowAiButton(true)
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: `Failed to fetch response: ${err.message}` }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleClearChat = () => {
    if (confirm('Clear chat logs?')) {
      const initial = [
        {
          role: 'model',
          text: 'Hello! I am Prahari’s Pocket Clinician. I can analyze safety warnings for your medications, allergies, and health conditions. How can I help you today?'
        }
      ]
      setMessages(initial)
      localStorage.removeItem('prahari_clinician_messages')
      setShowAiButton(false)
      setIsEmergency(false)
    }
  }

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 300px',
      height: 'calc(100vh - 140px)',
      gap: '1.5rem',
      fontFamily: 'var(--font-sans)',
      padding: '1rem 1.5rem'
    }}>
      
      {/* Column 1: Chat interface */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-cream-light)',
        border: '1.5px solid var(--color-mint-border)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        
        {/* Chat Titlebar */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1.5px solid var(--color-mint-border)',
          background: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-forest)', margin: 0 }}>
              🧠 Pocket Clinician AI
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>
              Fully E2EE-integrated context-aware safety assistant
            </span>
          </div>
          <button
            onClick={handleClearChat}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              color: 'var(--color-alert-critical)',
              background: 'none',
              border: '1px solid var(--color-alert-critical-border)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Clear History
          </button>
        </div>

        {/* Informational Disclaimer Banner */}
        <div style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: 'var(--color-alert-moderate-bg)',
          borderBottom: '1px solid var(--color-alert-moderate-border)',
          color: 'var(--color-alert-moderate)',
          fontSize: '0.8rem',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>⚠️ <strong>Disclaimer:</strong> Informational AI tool. Not a replacement for direct medical consultations.</span>
        </div>

        {/* Emergency Triage Overlay Card */}
        {isEmergency && (
          <div style={{
            margin: '1rem 1.5rem',
            padding: '1.25rem',
            backgroundColor: 'var(--color-alert-critical-bg)',
            border: '2px solid var(--color-alert-critical-border)',
            borderRadius: '12px',
            color: 'var(--color-alert-critical)',
            boxShadow: 'var(--shadow-md)',
            animation: 'pulseBorder 2s infinite',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            alignItems: 'flex-start'
          }}>
            <h3 style={{ margin: 0, fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🚨 EMERGENCY GUIDANCE DISPATCHED
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.5' }}>
              If you or the patient are experiencing chest pain, slurred speech, or breathing difficulties, please call <strong>112</strong> or go to the nearest emergency ward immediately. Do not wait for a chat response.
            </p>
            <button
              onClick={() => {
                const initial = [
                  {
                    role: 'model',
                    text: 'Hello! I am Prahari’s Pocket Clinician. I can analyze safety warnings for your medications, allergies, and health conditions. How can I help you today?'
                  }
                ]
                setMessages(initial)
                localStorage.removeItem('prahari_clinician_messages')
                setShowAiButton(false)
                setIsEmergency(false)
              }}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                color: 'white',
                background: 'var(--color-alert-critical)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              🔄 Clear & Start Next Chat
            </button>
          </div>
        )}

        {/* Chat Messages Log */}
        <div style={{
          flex: 1,
          padding: '1.5rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}
            >
              {msg.role !== 'user' && (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--color-forest-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  fontWeight: '800',
                  color: 'var(--color-forest)',
                  border: '1px solid var(--color-mint-border)',
                  flexShrink: 0
                }}>
                  🩺
                </div>
              )}

              <div style={{
                maxWidth: '75%',
                padding: '0.85rem 1.1rem',
                borderRadius: '16px',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                whiteSpace: 'pre-line',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                backgroundColor: msg.role === 'user' ? 'var(--color-forest)' : 'white',
                color: msg.role === 'user' ? 'white' : 'var(--color-slate-dark)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--color-mint-border)',
                borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderTopLeftRadius: msg.role === 'user' ? '16px' : '4px'
              }}>
                <div dangerouslySetInnerHTML={formatMessageTextHtml(msg.text)} />

                {/* Local safety warning fallback detailed scan button injection */}
                {msg.role === 'model' && index === messages.length - 1 && showAiButton && (
                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--color-mint-border)' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', margin: '0 0 0.5rem 0' }}>
                      Would you like to bypass local cache and run a detailed clinical AI review?
                    </p>
                    <button
                      onClick={(e) => handleSend(e, true)}
                      disabled={loading}
                      style={{
                        backgroundColor: 'var(--color-forest)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {loading ? 'Analyzing...' : '✨ Run Detailed AI Scan'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--color-forest-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-mint-border)'
              }}>
                🩺
              </div>
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'white',
                border: '1px solid var(--color-mint-border)',
                borderRadius: '16px',
                borderTopLeftRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div className="spinner" style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid var(--color-mint-border)',
                  borderTop: '2px solid var(--color-forest)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--color-slate-light)' }}>Evaluating safety profile...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <form onSubmit={(e) => handleSend(e, false)} style={{
          padding: '1rem 1.5rem',
          borderTop: '1.5px solid var(--color-mint-border)',
          background: 'white',
          display: 'flex',
          gap: '0.75rem'
        }}>
          <input
            type="text"
            placeholder="Ask about medications, side effects, or warning flags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1.5px solid var(--color-mint-border)',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              backgroundColor: 'var(--color-forest)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '0.75rem 1.25rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Send
          </button>
        </form>
      </div>

      {/* Column 2: Profile Context Sidebar */}
      <div style={{
        background: 'var(--color-cream-light)',
        border: '1.5px solid var(--color-mint-border)',
        borderRadius: '16px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--color-forest)', margin: '0 0 0.25rem 0' }}>
            📋 Active Patient Profile
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>
            These details are compiled to contextualize queries
          </span>
        </div>

        {profileLoading && <p style={{ fontSize: '0.85rem' }}>Loading context...</p>}

        {!profileLoading && (
          <>
            {/* Medications */}
            <div style={{ borderTop: '1px dashed var(--color-mint-border)', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                💊 Cabinet Medications ({meds.length})
              </h3>
              {meds.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', margin: 0 }}>No medicines registered.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {meds.map((m, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', background: 'white', border: '1px solid var(--color-mint-border)', borderRadius: '6px' }}>
                    <strong style={{ color: 'var(--color-forest)' }}>{m.brand_name}</strong>
                    {m.generic_name && <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-slate-light)' }}>{m.generic_name}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Allergies */}
            <div style={{ borderTop: '1px dashed var(--color-mint-border)', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                🚫 Allergies ({allergies.length})
              </h3>
              {allergies.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', margin: 0 }}>No allergy tags.</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {allergies.map((a, i) => (
                  <span key={i} style={{
                    backgroundColor: 'rgba(194,75,60,0.12)',
                    border: '1px solid rgba(194,75,60,0.25)',
                    color: 'var(--color-alert-critical)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Lab metrics */}
            <div style={{ borderTop: '1px dashed var(--color-mint-border)', paddingTop: '1rem', borderBottom: '1px dashed var(--color-mint-border)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                🔬 Lab Markers / Conditions ({labs.length})
              </h3>
              {labs.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)', margin: 0 }}>No lab notes.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {labs.map((l, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', background: 'white', border: '1px solid var(--color-mint-border)', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '600' }}>{l.key}</span>
                    <span style={{ color: 'var(--color-forest)', fontWeight: '600' }}>{l.value}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-light)', lineHeight: '1.4', margin: 0 }}>
              💡 Profile settings can be configured on the **Sentinel Settings** page.
            </p>
          </>
        )}
      </div>

    </div>
  )
}
