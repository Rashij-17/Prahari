/**
 * SchedulerPage.jsx — Module 2
 * ===============================
 * Daily Medication Scheduler Widget.
 * Reads medicines from IndexedDB (Module 1's store).
 * Tracks daily doses via localStorage key: prahari_schedule
 * Shows a 30-day heatmap + fire streak counter.
 */

import { useState, useEffect, useCallback } from 'react'
import { getMedicines } from '../services/medicineCabinetDB.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LS_KEY = 'prahari_schedule'

const TIME_SLOTS = [
  { id: 'morning',   label: 'Morning',   emoji: '🌅', desc: 'Before 12 PM' },
  { id: 'afternoon', label: 'Afternoon', emoji: '☀️', desc: '12 PM – 5 PM' },
  { id: 'evening',   label: 'Evening',   emoji: '🌆', desc: '5 PM – 9 PM' },
  { id: 'night',     label: 'Night',     emoji: '🌙', desc: 'After 9 PM' },
]

/**
 * Maps a medicine frequency string to a list of time slot IDs.
 * Returns array of slot ids from TIME_SLOTS.
 */
function frequencyToSlots(freq) {
  if (!freq) return ['morning']
  const f = freq.toUpperCase().trim()
  if (['OD', 'QD', 'MANE', 'OM'].includes(f)) return ['morning']
  if (['BD', 'BID', 'B.D.'].includes(f)) return ['morning', 'evening']
  if (['TDS', 'TID', 'T.D.S.'].includes(f)) return ['morning', 'afternoon', 'evening']
  if (['QID', 'QUAD'].includes(f)) return ['morning', 'afternoon', 'evening', 'night']
  if (['HS', 'NOCTE', 'NOCT', 'ON'].includes(f)) return ['night']
  if (['SOS/PRN', 'PRN', 'SOS'].includes(f)) return ['morning']
  if (['STAT'].includes(f)) return ['morning']
  // Default: once in morning
  return ['morning']
}

/** Get today's ISO date string: "YYYY-MM-DD" */
function todayStr() {
  return new Date().toLocaleDateString('en-CA') // en-CA gives YYYY-MM-DD
}

/** Load the full schedule log from localStorage */
function loadLog() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** Persist the full schedule log to localStorage */
function saveLog(log) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(log))
  } catch (e) {
    console.error('Failed to save schedule log:', e)
  }
}

/**
 * Compute consecutive-day streak ending on today.
 * A day is "complete" if every medicine assigned that day is checked.
 * @param {object} log - { "YYYY-MM-DD": { "medId": boolean, ... } }
 * @param {Medicine[]} medicines
 */
function computeStreak(log, medicines) {
  if (!medicines.length) return 0

  let streak = 0
  const now = new Date()

  for (let i = 0; i < 365; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-CA')
    const dayLog = log[key]

    if (!dayLog) {
      // If it's today and no entries yet, continue (don't break streak for today)
      if (i === 0) continue
      break
    }

    // Check if all medicines for that day were taken
    const allDone = medicines.every(med => dayLog[med.id] === true)
    if (allDone) {
      streak++
    } else {
      // Don't break if it's today (user might still take them)
      if (i === 0) continue
      break
    }
  }

  return streak
}

/**
 * Build the last-30-days data for the heatmap.
 * Returns array of { dateStr, label, status } in order oldest→newest.
 */
function buildHeatmapData(log, medicines) {
  const days = []
  const now = new Date()

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toLocaleDateString('en-CA')
    const dayLog = log[dateStr]

    let status = 'none' // no data
    if (i === 0) {
      status = 'today'
    } else if (dayLog && medicines.length > 0) {
      const allDone = medicines.every(m => dayLog[m.id] === true)
      const anyDone = medicines.some(m => dayLog[m.id] === true)
      status = allDone ? 'complete' : anyDone ? 'partial' : 'missed'
    }

    days.push({
      dateStr,
      label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      dayNum: d.getDate(),
      status,
    })
  }

  return days
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icon = {
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Reset: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  ),
  Empty: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StreakBanner({ streak }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.875rem',
      padding: '1rem 1.25rem',
      borderRadius: '14px',
      background: streak > 0
        ? 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)'
        : 'var(--color-cream)',
      border: streak > 0 ? 'none' : '1px solid var(--color-border)',
      marginBottom: '1.25rem',
      boxShadow: streak > 0 ? '0 4px 20px rgba(99,102,241,0.30)' : 'none',
      transition: 'background 400ms ease',
    }}>
      <span style={{ fontSize: '2rem', lineHeight: 1 }}>{streak > 0 ? '🔥' : '💤'}</span>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: streak > 0 ? '#fff' : 'var(--color-ink)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
          {streak} day{streak !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: '0.8rem', color: streak > 0 ? 'rgba(255,255,255,0.75)' : 'var(--color-muted)', marginTop: '0.1rem', fontWeight: 500 }}>
          {streak > 0 ? 'medication streak — keep it up!' : 'Start your streak by taking today\'s doses'}
        </div>
      </div>
    </div>
  )
}

function HeatmapCell({ day }) {
  const colors = {
    complete: { bg: '#22c55e', title: 'All doses taken' },
    partial:  { bg: '#f59e0b', title: 'Some doses taken' },
    missed:   { bg: '#ef4444', title: 'Missed doses' },
    today:    { bg: 'rgba(99,102,241,0.3)', title: 'Today', border: '2px solid #6366f1' },
    none:     { bg: 'var(--color-cream)', title: 'No data' },
  }
  const cfg = colors[day.status]
  return (
    <div
      title={`${day.label}: ${cfg.title}`}
      style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: '4px',
        background: cfg.bg,
        border: cfg.border || 'none',
        cursor: 'default',
        transition: 'transform 150ms ease',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    />
  )
}

function DoseCheckbox({ medId, medName, dosage, checked, onChange, slotId }) {
  const id = `dose-${medId}-${slotId}`
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 0.875rem',
        borderRadius: '10px',
        background: checked ? 'rgba(34,197,94,0.07)' : 'var(--color-white)',
        border: `1.5px solid ${checked ? '#86efac' : 'var(--color-border)'}`,
        cursor: 'pointer',
        transition: 'background 200ms ease, border-color 200ms ease',
        userSelect: 'none',
      }}
    >
      <input type="checkbox" id={id} checked={checked} onChange={onChange} style={{ display: 'none' }} />
      <div style={{
        width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
        border: `2px solid ${checked ? '#22c55e' : 'var(--color-border)'}`,
        background: checked ? '#22c55e' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 200ms ease, border-color 200ms ease',
        color: '#fff',
      }}>
        {checked && <Icon.Check />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '0.9rem', fontWeight: 600,
          color: checked ? 'var(--color-safe)' : 'var(--color-ink)',
          textDecoration: checked ? 'line-through' : 'none',
          transition: 'color 200ms ease',
        }}>
          {medName}
        </div>
        {dosage && (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-faint)', marginTop: '0.1rem' }}>
            {dosage}
          </div>
        )}
      </div>
      {checked && (
        <span style={{ fontSize: '0.7rem', color: 'var(--color-safe)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Taken ✓
        </span>
      )}
    </label>
  )
}

function TimeSlotSection({ slot, meds, todayLog, onToggle }) {
  if (!meds.length) return null

  const allTaken = meds.every(m => todayLog[m.id])
  const takenCount = meds.filter(m => todayLog[m.id]).length

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{slot.emoji}</span>
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' }}>
          {slot.label}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-faint)' }}>— {slot.desc}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: allTaken ? 'var(--color-safe)' : 'var(--color-faint)' }}>
          {takenCount}/{meds.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {meds.map(med => (
          <DoseCheckbox
            key={med.id}
            medId={med.id}
            medName={med.name}
            dosage={med.dosage}
            slotId={slot.id}
            checked={!!todayLog[med.id]}
            onChange={() => onToggle(med.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function SchedulerPage() {
  const [medicines, setMedicines] = useState([])
  const [log, setLog] = useState({})
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const meds = await getMedicines()
      setMedicines(meds)
      setLog(loadLog())
    } catch (err) {
      console.error('Scheduler load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const dateKey = todayStr()

  const todayLog = log[dateKey] || {}

  const handleToggle = (medId) => {
    const newLog = {
      ...log,
      [dateKey]: {
        ...todayLog,
        [medId]: !todayLog[medId],
      },
    }
    setLog(newLog)
    saveLog(newLog)
  }

  const handleResetToday = () => {
    const newLog = { ...log, [dateKey]: {} }
    setLog(newLog)
    saveLog(newLog)
  }

  // Build slot-to-medicine mapping
  const slotMap = {}
  TIME_SLOTS.forEach(s => { slotMap[s.id] = [] })
  medicines.forEach(med => {
    const slots = frequencyToSlots(med.frequency)
    slots.forEach(slot => {
      if (slotMap[slot]) slotMap[slot].push(med)
    })
  })

  const streak = computeStreak(log, medicines)
  const heatmapData = buildHeatmapData(log, medicines)

  const totalDosesToday = medicines.reduce((sum, med) => sum + frequencyToSlots(med.frequency).length, 0)
  const takenToday = medicines.reduce((sum, med) => {
    return sum + (todayLog[med.id] ? frequencyToSlots(med.frequency).length : 0)
  }, 0)
  const progress = totalDosesToday > 0 ? Math.round((takenToday / totalDosesToday) * 100) : 0

  const todayFormatted = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Sticky Date Header */}
      <div style={{
        position: 'sticky',
        top: '62px',
        zIndex: 50,
        background: 'var(--color-paper)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0.75rem 0',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', margin: 0, fontFamily: 'var(--font-display)' }}>
              Today's Schedule
            </h1>
            <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--color-muted)' }}>{todayFormatted}</p>
          </div>
          <button
            id="scheduler-reset-btn"
            onClick={handleResetToday}
            aria-label="Reset today's doses"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.875rem', borderRadius: '8px',
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-white)', color: 'var(--color-muted)',
              fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: 'pointer', transition: 'var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-warning)'; e.currentTarget.style.color = 'var(--color-warning)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-muted)' }}
          >
            <Icon.Reset /> Reset Today
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton-pulse" style={{ height: '80px', borderRadius: '14px' }} />)}
        </div>
      ) : medicines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div style={{ color: 'var(--color-faint)', display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}><Icon.Empty /></div>
          <h3 style={{ color: 'var(--color-ink)', fontSize: '1.05rem', marginBottom: '0.5rem' }}>No medicines scheduled</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
            Add medicines to your <a href="/cabinet" style={{ color: '#6366f1', fontWeight: 600 }}>Medicine Cabinet</a> to see them here.
          </p>
        </div>
      ) : (
        <>
          {/* Streak Banner */}
          <StreakBanner streak={streak} />

          {/* Progress Bar */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-muted)' }}>Today's progress</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: progress === 100 ? 'var(--color-safe)' : 'var(--color-ink)' }}>
                {takenToday}/{totalDosesToday} doses {progress === 100 ? '🎉' : ''}
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${progress}%`,
                  background: progress === 100
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : 'linear-gradient(90deg, #6366f1, #7c3aed)',
                }}
              />
            </div>
          </div>

          {/* Time Slot Sections */}
          {TIME_SLOTS.map(slot => (
            <TimeSlotSection
              key={slot.id}
              slot={slot}
              meds={slotMap[slot.id]}
              todayLog={todayLog}
              onToggle={handleToggle}
            />
          ))}

          {/* Heatmap */}
          <div style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '1.25rem',
            marginTop: '1.5rem',
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <div className="section-label">30-Day Adherence Map</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '5px', marginBottom: '0.75rem' }}>
              {heatmapData.map(day => (
                <HeatmapCell key={day.dateStr} day={day} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {[
                { color: '#22c55e', label: 'Complete' },
                { color: '#f59e0b', label: 'Partial' },
                { color: '#ef4444', label: 'Missed' },
                { color: 'rgba(99,102,241,0.3)', label: 'Today', border: '2px solid #6366f1' },
                { color: 'var(--color-cream)', label: 'No data', border: '1px solid var(--color-border)' },
              ].map(({ color, label, border }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color, border: border || 'none', flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
