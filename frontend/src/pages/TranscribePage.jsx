import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { encryptText } from '../services/crypto'

export default function TranscribePage() {
  const { token, isDemo, user } = useAuth()
  
  const [consentGranted, setConsentGranted] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_transcribe_state')
      return saved ? (JSON.parse(saved).consentGranted ?? false) : false
    } catch (e) { return false }
  })
  const [showConsentModal, setShowConsentModal] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_transcribe_state')
      return saved ? (JSON.parse(saved).showConsentModal ?? true) : true
    } catch (e) { return true }
  })

  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [waveformBars, setWaveformBars] = useState(Array(15).fill(10))

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const animRef = useRef(null)

  const [transcript, setTranscript] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_transcribe_state')
      return saved ? (JSON.parse(saved).transcript ?? '') : ''
    } catch (e) { return '' }
  })
  const [medications, setMedications] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_transcribe_state')
      return saved ? (JSON.parse(saved).medications ?? []) : []
    } catch (e) { return [] }
  })
  const [appointments, setAppointments] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_transcribe_state')
      return saved ? (JSON.parse(saved).appointments ?? []) : []
    } catch (e) { return [] }
  })
  const [warnings, setWarnings] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_transcribe_state')
      return saved ? (JSON.parse(saved).warnings ?? []) : []
    } catch (e) { return [] }
  })
  const [confidence, setConfidence] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_transcribe_state')
      return saved ? (JSON.parse(saved).confidence ?? 1.0) : 1.0
    } catch (e) { return 1.0 }
  })
  const [isIncomplete, setIsIncomplete] = useState(() => {
    try {
      const saved = localStorage.getItem('prahari_transcribe_state')
      return saved ? (JSON.parse(saved).isIncomplete ?? false) : false
    } catch (e) { return false }
  })
  
  const [syncStatus, setSyncStatus] = useState({ active: false, message: '', type: '' })

  useEffect(() => {
    try {
      const stateToSave = { consentGranted, showConsentModal, transcript, medications, appointments, warnings, confidence, isIncomplete }
      localStorage.setItem('prahari_transcribe_state', JSON.stringify(stateToSave))
    } catch (e) { console.error('Failed to save transcription state to localStorage:', e) }
  }, [consentGranted, showConsentModal, transcript, medications, appointments, warnings, confidence, isIncomplete])

  const resetAll = () => {
    setTranscript('')
    setMedications([])
    setAppointments([])
    setWarnings([])
    setConfidence(1.0)
    setIsIncomplete(false)
    setAudioBlob(null)
    setSyncStatus({ active: false, message: '', type: '' })
    try { localStorage.removeItem('prahari_transcribe_state') } catch (e) {}
  }

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isRecording])

  useEffect(() => {
    if (isRecording) {
      const animateWaveform = () => {
        setWaveformBars(Array(15).fill(0).map(() => Math.floor(Math.random() * 40) + 5))
        animRef.current = requestAnimationFrame(animateWaveform)
      }
      animRef.current = requestAnimationFrame(animateWaveform)
    } else {
      cancelAnimationFrame(animRef.current)
      setWaveformBars(Array(15).fill(4))
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [isRecording])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  const startRecording = async () => {
    if (!consentGranted) { setShowConsentModal(true); return }
    try {
      audioChunksRef.current = []
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }
      mediaRecorderRef.current.start()
      setIsRecording(true)
      setRecordingTime(0)
      setTranscript(''); setMedications([]); setAppointments([]); setWarnings([])
    } catch (err) {
      console.error("Microphone access failed:", err)
      alert("Failed to access microphone. Please ensure permissions are granted.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleFileUpload = (event) => {
    if (!consentGranted) { setShowConsentModal(true); event.target.value = ''; return }
    const file = event.target.files[0]
    if (file) {
      setAudioBlob(file); setRecordingTime(0); setIsRecording(false)
      setTranscript(''); setMedications([]); setAppointments([]); setWarnings([])
    }
  }

  const processAudio = async () => {
    if (!audioBlob) return
    setIsProcessing(true)
    setSyncStatus({ active: false, message: '', type: '' })
    const formData = new FormData()
    formData.append("file", audioBlob, audioBlob.name || "consultation.wav")
    try {
      const headers = {}
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch("http://localhost:8000/triage/transcribe", { method: "POST", headers, body: formData })
      if (!res.ok) throw new Error(`Server returned code ${res.status}`)
      const data = await res.json()
      setTranscript(data.transcript || ''); setMedications(data.medications || [])
      setAppointments(data.appointments || []); setWarnings(data.warnings || [])
      setConfidence(data.confidence ?? 1.0); setIsIncomplete(data.is_incomplete ?? false)
    } catch (err) {
      console.error("Transcription processing failed:", err)
      setSyncStatus({ active: true, message: 'Failed to transcribe audio. Showing demo fallback items.', type: 'error' })
      setTranscript("Hello Mr. Sharma, Your blood pressure is slightly high. I am prescribing you Metformin 500mg once daily. Also take Crocin 650mg if you get fever. Please avoid high-sugar foods. See you next Tuesday at 11 AM.")
      setMedications([
        { brand_name: "Metformin", generic_name: "Metformin", dosage_strength: "500mg", frequency: "once daily", duration: "30 days", is_unverified: false },
        { brand_name: "Crocin", generic_name: "Paracetamol", dosage_strength: "650mg", frequency: "when needed", duration: "5 days", is_unverified: false }
      ])
      setAppointments([{ title: "Follow-up Visit", date: "2026-06-23", time: "11:00 AM", notes: "Check blood pressure" }])
      setWarnings(["Avoid high-sugar foods."])
    } finally { setIsProcessing(false) }
  }

  const handleApproveAndImport = async () => {
    setSyncStatus({ active: true, message: 'Syncing to Supabase database...', type: 'info' })
    let successCount = 0
    const encryptionSeed = user?.id || "demo-fallback-seed"
    try {
      for (const med of medications) {
        const headers = { "Content-Type": "application/json" }
        if (token) headers["Authorization"] = `Bearer ${token}`
        const encBrand = await encryptText(med.brand_name, encryptionSeed, true)
        const encGeneric = await encryptText(med.generic_name || "", encryptionSeed, false)
        const encDosage = await encryptText(med.dosage_strength || "", encryptionSeed, false)
        const encFrequency = await encryptText(med.frequency || "", encryptionSeed, false)
        const encInstructions = await encryptText(med.duration ? `Take for ${med.duration}` : "", encryptionSeed, false)
        const res = await fetch("http://localhost:8000/medication/cabinet", { method: "POST", headers, body: JSON.stringify({ brand_name: encBrand, generic_name: encGeneric, dosage_strength: encDosage, frequency: encFrequency, instructions: encInstructions }) })
        if (res.ok) { successCount++ } else { const errData = await res.json().catch(() => ({})); throw new Error(`Cabinet sync failed: ${errData.detail || res.status}`) }
      }
      for (const appt of appointments) {
        const headers = { "Content-Type": "application/json" }
        if (token) headers["Authorization"] = `Bearer ${token}`
        const encTitle = await encryptText(appt.title, encryptionSeed, true)
        const encTime = await encryptText(appt.time || "", encryptionSeed, false)
        const encNotes = await encryptText(appt.notes || "", encryptionSeed, false)
        const res = await fetch("http://localhost:8000/medication/appointments", { method: "POST", headers, body: JSON.stringify({ title: encTitle, date: appt.date, time: encTime, notes: encNotes }) })
        if (res.ok) { successCount++ } else { const errData = await res.json().catch(() => ({})); throw new Error(`Appointments sync failed: ${errData.detail || res.status}`) }
      }
      setSyncStatus({ active: true, message: `Successfully synced ${successCount} entries to Supabase Postgres database!`, type: 'success' })
    } catch (err) {
      console.error("Sync failed:", err)
      setSyncStatus({ active: true, message: `Database sync failed: ${err.message}`, type: 'error' })
    }
  }

  const handleConsentAccept = () => { setConsentGranted(true); setShowConsentModal(false) }

  const applySuggestedCorrection = (index, suggestedName) => {
    setMedications(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], brand_name: suggestedName, is_unverified: false, suggested_name: "" }
      return updated
    })
  }

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '1rem 1.5rem', minHeight: 'calc(100vh - 120px)', fontFamily: 'var(--font-sans)' }}>
      {/* Spinner style */}
      <style>{`
        @keyframes transcribeSpin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        @keyframes transcribeFadeIn { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
        .transcribe-spin { animation: transcribeSpin 1s linear infinite; }
        .transcribe-fade { animation: transcribeFadeIn 0.3s ease-out forwards; }
      `}</style>

      {/* Editorial header */}
      <header className="page-header">
        <span style={{ fontSize: '0.688rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: 'var(--color-forest)' }}>
          Phase 3 Feature
        </span>
        <h1 style={{ margin: '0.25rem 0 0' }}>Consultation Recorder &amp; Transcriber</h1>
        <p style={{ margin: '0.5rem 0 0', maxWidth: '480px' }}>
          Record conversations during clinic visits. Our model automatically parses medications, schedules follow-ups, and flags safety warnings.
        </p>
      </header>

      {/* Sync banner */}
      {syncStatus.active && (
        <div className="transcribe-fade" style={{
          marginBottom: '1.5rem',
          padding: '0.875rem 1rem',
          borderRadius: '12px',
          border: `1.5px solid ${syncStatus.type === 'success' ? 'var(--color-safe-border)' : syncStatus.type === 'error' ? 'var(--color-critical-border)' : 'var(--color-border)'}`,
          backgroundColor: syncStatus.type === 'success' ? 'var(--color-safe-bg)' : syncStatus.type === 'error' ? 'var(--color-critical-bg)' : 'var(--color-cream)',
          color: syncStatus.type === 'success' ? 'var(--color-safe)' : syncStatus.type === 'error' ? 'var(--color-critical)' : 'var(--color-ink)',
          display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', fontWeight: 500,
        }}>
          <span>ℹ️</span>
          <span>{syncStatus.message}</span>
        </div>
      )}

      {/* Main recording interface */}
      <section className="card" style={{ marginBottom: '2rem', textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', color: 'var(--color-ink)', margin: '0 0 0.5rem' }}>
          Patient Consultation Recorder
        </h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginBottom: '2rem', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
          Verify physician consent before starting. Audio data is processed in-memory and deleted immediately after analysis.
        </p>

        {/* Waveform visualizer */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', height: '60px', marginBottom: '1.5rem' }}>
          {waveformBars.map((height, idx) => (
            <div
              key={idx}
              style={{
                width: '4px',
                height: `${height}%`,
                background: 'var(--color-forest)',
                borderRadius: '2px',
                opacity: isRecording ? 1 : 0.35,
                transition: 'height 75ms ease',
                boxShadow: isRecording ? '0 0 6px var(--color-forest-glow)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Timer */}
        <div style={{ fontSize: '1.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-ink)', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>
          {formatTime(recordingTime)}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {!isRecording ? (
              <>
                <button
                  onClick={startRecording}
                  className="btn-primary-forest"
                  style={{ borderRadius: '999px', padding: '0.65rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Record Visit
                </button>

                <input type="file" id="audio-upload-input" accept="audio/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                <label
                  htmlFor="audio-upload-input"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.5rem', borderRadius: '999px', cursor: 'pointer',
                    background: 'var(--color-white)', color: 'var(--color-muted)',
                    border: '1.5px solid var(--color-border)', fontWeight: 600, fontSize: '0.9375rem',
                    fontFamily: 'var(--font-sans)', transition: 'var(--transition-fast)',
                  }}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Voice
                </label>
              </>
            ) : (
              <button
                onClick={stopRecording}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.65rem 1.5rem', borderRadius: '999px',
                  background: 'var(--color-critical)', color: '#fff', border: 'none',
                  fontWeight: 600, fontSize: '0.9375rem', fontFamily: 'var(--font-sans)',
                  cursor: 'pointer', animation: 'pulse 1.5s infinite',
                }}
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <rect x="6" y="6" width="12" height="12" rx="1.5" />
                </svg>
                Stop &amp; Save
              </button>
            )}

            {audioBlob && !isRecording && (
              <button
                onClick={processAudio}
                disabled={isProcessing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.65rem 1.5rem', borderRadius: '999px',
                  background: isProcessing ? 'var(--color-faint)' : 'var(--color-ink)',
                  color: '#fff', border: 'none',
                  fontWeight: 600, fontSize: '0.9375rem', fontFamily: 'var(--font-sans)',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                {isProcessing ? (
                  <>
                    <span className="transcribe-spin" style={{ width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid white', borderRadius: '50%', display: 'block' }} />
                    Processing...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Process Visit
                  </>
                )}
              </button>
            )}
          </div>

          {audioBlob && !isRecording && (
            <div style={{
              fontSize: '0.75rem', color: 'var(--color-muted)',
              background: 'var(--color-cream)', border: '1px solid var(--color-border)',
              borderRadius: '8px', padding: '5px 12px', fontWeight: 500,
            }}>
              Selected Audio: <span style={{ color: 'var(--color-forest)', fontWeight: 700 }}>{audioBlob.name || "consultation.wav"}</span>
            </div>
          )}
        </div>
      </section>

      {/* Results grid */}
      {(transcript || isProcessing) && (
        <div className="transcribe-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px,100%), 1fr))', gap: '1.5rem' }}>
          
          {/* Transcript panel */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>Visit Audio Transcript</h3>
              {confidence < 0.6 && (
                <span style={{ fontSize: '0.688rem', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--color-warning-border)', fontWeight: 600 }}>
                  ⚠️ Low Confidence
                </span>
              )}
            </div>
            {isProcessing ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem', color: 'var(--color-muted)' }}>
                <span className="transcribe-spin" style={{ width: '28px', height: '28px', border: '3.5px solid var(--color-border)', borderTop: '3.5px solid var(--color-forest)', borderRadius: '50%', display: 'block' }} />
                <span style={{ fontSize: '0.875rem' }}>Whisper-v3 transcribing audio...</span>
              </div>
            ) : (
              <p style={{ color: 'var(--color-muted)', lineHeight: 1.7, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '0.9375rem' }}>
                "{transcript}"
              </p>
            )}
          </div>

          {/* Care plan panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                Structured Care Plan
              </h3>

              {isProcessing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '10px' }} />)}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                  {/* Medications */}
                  <div>
                    <div className="section-label" style={{ color: 'var(--color-forest)' }}>Prescribed Medications ({medications.length})</div>
                    {medications.length === 0 ? (
                      <p style={{ color: 'var(--color-faint)', fontSize: '0.875rem', fontStyle: 'italic' }}>No medications detected.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {medications.map((med, idx) => (
                          <div key={idx} style={{
                            padding: '0.75rem', borderRadius: '10px',
                            background: 'var(--color-cream)',
                            border: `1.5px solid ${med.is_unverified ? 'var(--color-critical-border)' : 'var(--color-border)'}`,
                            fontSize: '0.875rem',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{med.brand_name}</span>
                              {med.dosage_strength && (
                                <span className="chip chip-neutral">{med.dosage_strength}</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                              {med.generic_name && <span>Generic: {med.generic_name} · </span>}
                              {med.frequency && <span>{med.frequency}</span>}
                              {med.duration && <span> ({med.duration})</span>}
                            </div>
                            {med.is_unverified && med.suggested_name && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', background: 'var(--color-critical-bg)', color: 'var(--color-critical)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-critical-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>Unverified drug. Did you mean <strong>{med.suggested_name}</strong>?</span>
                                <button onClick={() => applySuggestedCorrection(idx, med.suggested_name)} style={{ background: 'var(--color-critical)', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                              </div>
                            )}
                            {med.is_unverified && !med.suggested_name && (
                              <div style={{ marginTop: '0.25rem', fontSize: '0.688rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                                ⚠️ Not found in standard databases. Review carefully.
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Appointments */}
                  <div>
                    <div className="section-label" style={{ color: 'var(--color-forest)' }}>Follow-up Appointments ({appointments.length})</div>
                    {appointments.length === 0 ? (
                      <p style={{ color: 'var(--color-faint)', fontSize: '0.875rem', fontStyle: 'italic' }}>No follow-ups detected.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {appointments.map((appt, idx) => (
                          <div key={idx} style={{ padding: '0.75rem', border: '1.5px solid var(--color-border)', borderRadius: '10px', background: 'var(--color-cream)', fontSize: '0.875rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{appt.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                              <strong>Date:</strong> {appt.date} {appt.time && <span>· <strong>Time:</strong> {appt.time}</span>}
                            </div>
                            {appt.notes && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.25rem', fontStyle: 'italic', borderLeft: '2px solid var(--color-forest)', paddingLeft: '8px' }}>
                                "{appt.notes}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Warnings */}
                  {warnings.length > 0 && (
                    <div>
                      <div className="section-label" style={{ color: 'var(--color-amber)' }}>Clinical Warnings &amp; Instructions</div>
                      <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {warnings.map((warning, idx) => (
                          <li key={idx} style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-amber-dark)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: '8px', padding: '8px 12px' }}>
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                    <button onClick={resetAll} className="btn-secondary" style={{ padding: '0.55rem 1.125rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Reset
                    </button>
                    <button onClick={handleApproveAndImport} className="btn-primary-forest" style={{ padding: '0.55rem 1.25rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                      Approve &amp; Import
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Consent Modal */}
      {showConsentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,23,20,0.6)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '460px', width: '100%', animation: 'transcribeFadeIn 0.25s ease-out', borderRadius: '18px' }}>
            <div style={{ color: 'var(--color-forest)', marginBottom: '1rem' }}>
              <svg width="44" height="44" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 0.75rem' }}>Consent Required for Visit Recording</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
              To capture and transcribe your consultation, Prahari requires microphone permissions. In compliance with clinical data protection guidelines:<br /><br />
              • You must obtain verbal consent from your physician before recording.<br />
              • Audio files are processed entirely in-memory and immediately destroyed.<br />
              • Clinical identifiers are filtered to protect patient confidentiality.
            </p>
            <button onClick={handleConsentAccept} className="btn-primary-forest" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px' }}>
              I Consent &amp; Have Doctor's Permission
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
