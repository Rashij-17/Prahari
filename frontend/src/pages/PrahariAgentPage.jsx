/**
 * PrahariAgentPage — Unified AI Health Assistant
 * ================================================
 * Single conversational input that routes to triage analysis,
 * healthcare directory, or a fallback — all powered by the
 * Prahari Core Agent (/agent/chat).
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { agentChat } from '../services/api.js'

// ─── Urgency config (mirrors TriagePage) ────────────────────────────────────
const URGENCY_CONFIG = {
  safe:     { color: 'var(--color-safe)',     bg: 'var(--color-safe-bg)',     border: 'var(--color-safe)',     label: 'Self-Care',     emoji: '✅' },
  moderate: { color: 'var(--color-warning)',  bg: 'var(--color-warning-bg)',  border: 'var(--color-warning)',  label: 'Doctor Visit', emoji: '⚠️' },
  critical: { color: 'var(--color-critical)', bg: 'var(--color-critical-bg)', border: 'var(--color-critical)', label: 'Emergency',    emoji: '🚨' },
}

// ─── Suggestion chips ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'I have a fever, headache, and stiff neck',
  'Find a hospital near Connaught Place Delhi',
  'Chest pain radiating to my left arm',
  'Where is the nearest pharmacy?',
  'Severe cough with blood-streaked sputum for 3 days',
  'Find a clinic near Bandra, Mumbai',
]

// ─── Animated typing dots ────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--color-forest)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.95rem', flexShrink: 0,
      }}>🛡️</div>
      <div style={{
        padding: '0.65rem 1.1rem',
        background: 'var(--color-white)',
        border: '1.5px solid var(--color-border)',
        borderRadius: '18px', borderTopLeftRadius: '4px',
        display: 'flex', alignItems: 'center', gap: '6px',
        boxShadow: 'var(--shadow-xs)',
      }}>
        {[0, 160, 320].map(d => (
          <span key={d} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--color-forest)',
            display: 'inline-block',
            animation: `agentBounce 1.2s ${d}ms ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Triage result card ───────────────────────────────────────────────────────
function TriageCard({ data, triageResult }) {
  // Prefer the full pipeline result; fall back to agent-only data
  const urgencyLevel = triageResult?.urgency_level || (() => {
    const t = data?.alert_title || ''
    if (t === 'Emergency Room') return 'critical'
    if (t === 'Self-Care') return 'safe'
    return 'moderate'
  })()
  const cfg = URGENCY_CONFIG[urgencyLevel] || URGENCY_CONFIG.moderate

  const conditions = triageResult?.conditions?.length
    ? triageResult.conditions
    : (data?.conditions || []).map(c => ({
        name: c.name,
        probability: (c.probability_percentage || 10) / 100,
      }))

  const recommendation = triageResult?.recommendation || data?.alert_description || ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      {/* Alert banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
        padding: '1rem 1.25rem',
        backgroundColor: cfg.bg,
        border: `2px solid ${cfg.border}`,
        borderRadius: '14px',
      }} role="alert">
        <span style={{ fontSize: '1.4rem', flexShrink: 0, lineHeight: 1 }}>{cfg.emoji}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: cfg.color, marginBottom: '0.3rem' }}>
            {data?.alert_title || triageResult?.urgency_label || 'Triage Result'}
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-ink)', lineHeight: 1.6 }}>
            {recommendation}
          </p>
        </div>
      </div>

      {/* Conditions probability bars */}
      {conditions.length > 0 && (
        <div style={{
          background: 'var(--color-white)',
          border: '1.5px solid var(--color-border)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.09em', color: 'var(--color-muted)', marginBottom: '0.875rem',
          }}>
            Most Likely Conditions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {conditions.slice(0, 3).map((c, i) => {
              const pct = c.probability != null
                ? Math.round(c.probability * 100)
                : (c.probability_percentage || 10)
              const barColor = i === 0 ? cfg.color : (i === 1 ? 'var(--color-forest)' : 'var(--color-muted)')
              return (
                <div key={i}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'baseline', marginBottom: '0.3rem',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-ink)' }}>
                      {c.name}
                    </span>
                    <span style={{
                      fontWeight: 700, fontSize: '0.8rem',
                      fontFamily: 'var(--font-mono)', color: barColor,
                    }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{
                    height: '7px', background: 'var(--color-cream)',
                    borderRadius: '99px', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: barColor,
                      borderRadius: '99px',
                      transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p style={{
        fontSize: '0.72rem', color: 'var(--color-faint)',
        lineHeight: 1.55, margin: 0,
        paddingTop: '0.25rem',
        borderTop: '1px dashed var(--color-border)',
      }}>
        ⚕️ This assessment is for informational purposes only. Always consult a qualified healthcare professional for medical decisions.
      </p>
    </div>
  )
}

// ─── Directory result card ────────────────────────────────────────────────────
function DirectoryCard({ data, navigate }) {
  const [extraLoc, setExtraLoc] = useState('')

  const iconMap = {
    hospital: '🏥',
    clinic:   '🩺',
    pharmacy: '💊',
    doctors:  '👨‍⚕️',
  }

  const openDirectory = (locationOverride) => {
    const loc = locationOverride || data.extracted_location_name
    const params = new URLSearchParams()
    if (data.facility_type) params.set('type', data.facility_type)
    if (loc) params.set('location', loc)
    navigate(`/directory?${params.toString()}`)
  }

  if (!data.location_provided_by_user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{
          padding: '1rem 1.25rem',
          background: 'var(--color-warning-bg)',
          border: '1.5px solid var(--color-warning-border)',
          borderRadius: '14px',
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-warning)', marginBottom: '0.25rem' }}>
              Location Needed
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-ink)', lineHeight: 1.6 }}>
              {data.system_message}
            </p>
          </div>
        </div>

        {/* Inline location input */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={extraLoc}
            onChange={e => setExtraLoc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && extraLoc.trim() && openDirectory(extraLoc.trim())}
            placeholder="Type your city or area…"
            style={{
              flex: 1, padding: '0.65rem 0.9rem',
              borderRadius: '9px', border: '1.5px solid var(--color-border)',
              background: 'var(--color-cream)', color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--color-forest)'}
            onBlur={e  => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button
            disabled={!extraLoc.trim()}
            onClick={() => openDirectory(extraLoc.trim())}
            style={{
              padding: '0.65rem 1rem', borderRadius: '9px',
              background: extraLoc.trim() ? 'var(--color-forest)' : 'var(--color-border)',
              color: '#fff', border: 'none',
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.875rem',
              cursor: extraLoc.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s ease',
            }}
          >
            Go →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{
        padding: '1rem 1.25rem',
        background: 'var(--color-forest-subtle)',
        border: '1.5px solid var(--color-forest)',
        borderRadius: '14px',
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>
          {iconMap[data.facility_type] || '📍'}
        </span>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--color-forest)', marginBottom: '0.25rem', textTransform: 'capitalize' }}>
            {data.facility_type} Search Ready
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-ink)', lineHeight: 1.6 }}>
            Searching for a <strong>{data.facility_type}</strong> near{' '}
            <strong>{data.extracted_location_name}</strong>.
          </p>
        </div>
      </div>

      <button
        onClick={() => openDirectory()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          background: 'var(--color-forest)', color: 'white',
          border: 'none', borderRadius: '10px',
          fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.9rem',
          cursor: 'pointer',
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        Open Directory Search →
      </button>
    </div>
  )
}


// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, navigate }) {
  const isUser = msg.role === 'user'

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      {/* Avatar */}
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'var(--color-forest)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.9rem',
          boxShadow: '0 2px 8px rgba(55,124,80,0.2)',
        }}>🛡️</div>
      )}

      <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Text bubble */}
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser ? 'var(--color-forest)' : 'var(--color-white)',
          color: isUser ? '#fff' : 'var(--color-ink)',
          border: isUser ? 'none' : '1.5px solid var(--color-border)',
          fontSize: '0.9rem', lineHeight: 1.6,
          boxShadow: 'var(--shadow-xs)',
        }}>
          {msg.text}
        </div>

        {/* Rich result cards (only on agent messages) */}
        {msg.intent === 'triage' && (
          <TriageCard data={msg.data} triageResult={msg.triageResult} />
        )}
        {msg.intent === 'directory' && (
          <DirectoryCard data={msg.data} navigate={navigate} />
        )}
        {msg.intent === 'unknown' && msg.data?.system_message && msg.text !== msg.data.system_message && (
          <div style={{
            padding: '0.75rem 1rem',
            background: 'var(--color-cream)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '12px',
            fontSize: '0.85rem',
            color: 'var(--color-muted)',
          }}>
            {msg.data.system_message}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PrahariAgentPage() {
  const navigate = useNavigate()

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'agent',
      text: 'Hello! I\'m the Prahari Health Sentinel. Describe your symptoms for an instant triage assessment, or ask me to find a nearby hospital, clinic, or pharmacy.',
      intent: null,
    },
  ])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (text) => {
    const q = (text || query).trim()
    if (!q || loading) return

    setQuery('')
    setLoading(true)

    // Append user message
    const userMsg = { id: Date.now(), role: 'user', text: q }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await agentChat(q)
      const intent = res.intent || 'unknown'
      const data   = res.data   || {}

      // Compose display text for the agent bubble
      let agentText = ''
      if (intent === 'triage') {
        agentText = `I've analyzed your symptoms. Here is my assessment:`
      } else if (intent === 'directory') {
        if (data.location_provided_by_user) {
          agentText = `I've identified your healthcare search request.`
        } else {
          agentText = data.system_message || 'I need your location to find nearby facilities.'
        }
      } else {
        agentText = data.system_message || 'I can help with symptoms or finding healthcare facilities near you.'
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'agent',
          text: agentText,
          intent,
          data,
          triageResult: res.triage_result || null,
        },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'agent',
          text: `Sorry, I couldn't reach the Prahari backend: ${err.message}`,
          intent: null,
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      maxWidth: '780px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 130px)',
      fontFamily: 'var(--font-sans)',
    }}>
      <style>{`
        @keyframes agentBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-6px); }
        }
        @keyframes agentSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .agent-msg { animation: agentSlideIn 0.25s ease-out both; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        padding: '1.25rem 1.5rem',
        background: 'var(--color-white)',
        border: '1.5px solid var(--color-border)',
        borderRadius: '16px 16px 0 0',
        borderBottom: 'none',
        display: 'flex', alignItems: 'center', gap: '0.875rem',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '12px',
          background: 'var(--color-forest)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.35rem',
          boxShadow: '0 4px 14px rgba(55,124,80,0.3)',
        }}>🛡️</div>
        <div>
          <h1 style={{
            margin: 0, fontSize: '1.15rem', fontWeight: 800,
            fontFamily: 'var(--font-display)', color: 'var(--color-forest)',
          }}>
            Prahari Health Sentinel
          </h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
            AI-powered triage · facility finder · 24/7
          </span>
        </div>

        {/* Live dot */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--color-safe)',
            boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
            animation: 'agentBounce 2.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-safe)' }}>
            Online
          </span>
        </div>
      </div>

      {/* Disclaimer strip */}
      <div style={{
        padding: '0.5rem 1.25rem',
        background: 'var(--color-warning-bg)',
        borderLeft: '1.5px solid var(--color-border)',
        borderRight: '1.5px solid var(--color-border)',
        borderBottom: '1px solid var(--color-warning-border)',
        fontSize: '0.76rem', color: 'var(--color-warning)', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: '0.4rem',
      }}>
        ⚠️ <strong>Disclaimer:</strong>&nbsp;Informational AI tool. Not a replacement for direct medical consultation.
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
        background: 'var(--color-cream)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        borderLeft: '1.5px solid var(--color-border)',
        borderRight: '1.5px solid var(--color-border)',
      }}>
        {messages.map((msg) => (
          <div key={msg.id} className="agent-msg">
            <MessageBubble msg={msg} navigate={navigate} />
          </div>
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggestion chips ── */}
      {messages.length <= 1 && !loading && (
        <div style={{
          padding: '0.875rem 1.25rem 0',
          background: 'var(--color-cream)',
          borderLeft: '1.5px solid var(--color-border)',
          borderRight: '1.5px solid var(--color-border)',
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-muted)', width: '100%' }}>
            Try asking:
          </span>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              style={{
                padding: '0.38rem 0.875rem',
                background: 'var(--color-white)',
                border: '1.5px solid var(--color-border)',
                borderRadius: '99px',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--color-ink)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--color-forest)'
                e.currentTarget.style.color = 'var(--color-forest)'
                e.currentTarget.style.background = 'var(--color-forest-subtle)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.color = 'var(--color-ink)'
                e.currentTarget.style.background = 'var(--color-white)'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{
        padding: '1rem 1.25rem',
        background: 'var(--color-white)',
        border: '1.5px solid var(--color-border)',
        borderTop: '1px solid var(--color-border)',
        borderRadius: '0 0 16px 16px',
        display: 'flex', gap: '0.75rem', alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          id="agent-query-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your symptoms or ask to find a hospital, clinic, or pharmacy…"
          rows={1}
          disabled={loading}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-cream)',
            color: 'var(--color-ink)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.9rem',
            outline: 'none',
            resize: 'none',
            lineHeight: 1.55,
            transition: 'border-color 0.15s ease',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--color-forest)'}
          onBlur={e  => e.target.style.borderColor = 'var(--color-border)'}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />

        <button
          id="agent-send-btn"
          onClick={() => handleSend()}
          disabled={loading || !query.trim()}
          style={{
            width: 44, height: 44, flexShrink: 0,
            borderRadius: '12px',
            background: (!loading && query.trim()) ? 'var(--color-forest)' : 'var(--color-border)',
            color: 'white',
            border: 'none', cursor: (!loading && query.trim()) ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s ease, transform 0.1s ease',
          }}
          onMouseEnter={e => { if (!loading && query.trim()) e.currentTarget.style.transform = 'scale(1.06)' }}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
