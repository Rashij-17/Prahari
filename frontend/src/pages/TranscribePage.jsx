import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { encryptText } from '../services/crypto'

export default function TranscribePage() {
  const { token, isDemo, user } = useAuth()
  
  // Auth state
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

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Waveform visualization bars
  const [waveformBars, setWaveformBars] = useState(Array(15).fill(10))

  // MediaRecorder references
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const animRef = useRef(null)

  // Output results state
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
  
  // Import/Sync feedback
  const [syncStatus, setSyncStatus] = useState({ active: false, message: '', type: '' })

  // Sync state to localStorage
  useEffect(() => {
    try {
      const stateToSave = {
        consentGranted,
        showConsentModal,
        transcript,
        medications,
        appointments,
        warnings,
        confidence,
        isIncomplete,
      }
      localStorage.setItem('prahari_transcribe_state', JSON.stringify(stateToSave))
    } catch (e) {
      console.error('Failed to save transcription state to localStorage:', e)
    }
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
    try {
      localStorage.removeItem('prahari_transcribe_state')
    } catch (e) {
      console.error('Failed to clear transcription state from localStorage:', e)
    }
  }

  // Handle timer ticks
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isRecording])

  // Waveform animation loop (simulated microphone volume levels)
  useEffect(() => {
    if (isRecording) {
      const animateWaveform = () => {
        setWaveformBars(
          Array(15)
            .fill(0)
            .map(() => Math.floor(Math.random() * 40) + 5)
        )
        animRef.current = requestAnimationFrame(animateWaveform)
      }
      animRef.current = requestAnimationFrame(animateWaveform)
    } else {
      cancelAnimationFrame(animRef.current)
      setWaveformBars(Array(15).fill(4))
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [isRecording])

  // Timer formatter (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  // Audio capture triggers
  const startRecording = async () => {
    if (!consentGranted) {
      setShowConsentModal(true)
      return
    }

    try {
      audioChunksRef.current = []
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(audioBlob)
        // Stop all tracks on the stream to release mic
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setRecordingTime(0)
      // Reset past runs
      setTranscript('')
      setMedications([])
      setAppointments([])
      setWarnings([])
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
    if (!consentGranted) {
      setShowConsentModal(true)
      event.target.value = ''
      return
    }
    const file = event.target.files[0]
    if (file) {
      setAudioBlob(file)
      setRecordingTime(0)
      setIsRecording(false)
      setTranscript('')
      setMedications([])
      setAppointments([])
      setWarnings([])
    }
  }

  // API Call to Backend transcription service
  const processAudio = async () => {
    if (!audioBlob) return
    setIsProcessing(true)
    setSyncStatus({ active: false, message: '', type: '' })

    const formData = new FormData()
    formData.append("file", audioBlob, audioBlob.name || "consultation.wav")

    try {
      const headers = {}
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const res = await fetch("http://localhost:8000/triage/transcribe", {
        method: "POST",
        headers,
        body: formData
      })

      if (!res.ok) {
        throw new Error(`Server returned code ${res.status}`)
      }

      const data = await res.json()
      setTranscript(data.transcript || '')
      setMedications(data.medications || [])
      setAppointments(data.appointments || [])
      setWarnings(data.warnings || [])
      setConfidence(data.confidence ?? 1.0)
      setIsIncomplete(data.is_incomplete ?? false)
    } catch (err) {
      console.error("Transcription processing failed:", err)
      setSyncStatus({
        active: true,
        message: 'Failed to transcribe audio. Showing demo fallback items.',
        type: 'error'
      })
      // Local Mock fallback on error
      setTranscript(
        "Hello Mr. Sharma, Your blood pressure is slightly high. I am prescribing you Metformin 500mg once daily. " +
        "Also take Crocin 650mg if you get fever. Please avoid high-sugar foods. See you next Tuesday at 11 AM."
      )
      setMedications([
        { brand_name: "Metformin", generic_name: "Metformin", dosage_strength: "500mg", frequency: "once daily", duration: "30 days", is_unverified: false },
        { brand_name: "Crocin", generic_name: "Paracetamol", dosage_strength: "650mg", frequency: "when needed", duration: "5 days", is_unverified: false }
      ])
      setAppointments([
        { title: "Follow-up Visit", date: "2026-06-23", time: "11:00 AM", notes: "Check blood pressure" }
      ])
      setWarnings(["Avoid high-sugar foods."])
    } finally {
      setIsProcessing(false)
    }
  }

  // Sync / Approve & Import handler
  const handleApproveAndImport = async () => {
    setSyncStatus({ active: true, message: 'Syncing to Supabase database...', type: 'info' })
    let successCount = 0
    
    const encryptionSeed = user?.id || "demo-fallback-seed"

    try {
      // 1. Sync Medications
      for (const med of medications) {
        const headers = {
          "Content-Type": "application/json"
        }
        if (token) headers["Authorization"] = `Bearer ${token}`

        // Encrypt medication fields (brand_name is deterministic, others are randomized)
        const encBrand = await encryptText(med.brand_name, encryptionSeed, true)
        const encGeneric = await encryptText(med.generic_name || "", encryptionSeed, false)
        const encDosage = await encryptText(med.dosage_strength || "", encryptionSeed, false)
        const encFrequency = await encryptText(med.frequency || "", encryptionSeed, false)
        const encInstructions = await encryptText(med.duration ? `Take for ${med.duration}` : "", encryptionSeed, false)

        const res = await fetch("http://localhost:8000/medication/cabinet", {
          method: "POST",
          headers,
          body: JSON.stringify({
            brand_name: encBrand,
            generic_name: encGeneric,
            dosage_strength: encDosage,
            frequency: encFrequency,
            instructions: encInstructions
          })
        })
        if (res.ok) {
          successCount++
        } else {
          const errData = await res.json().catch(() => ({}))
          const detail = errData.detail || `Server returned status ${res.status}`
          console.error("Cabinet sync failed:", detail)
          throw new Error(`Cabinet sync failed: ${detail}`)
        }
      }

      // 2. Sync Appointments
      for (const appt of appointments) {
        const headers = {
          "Content-Type": "application/json"
        }
        if (token) headers["Authorization"] = `Bearer ${token}`

        // Encrypt appointment fields (title is deterministic, time/notes are randomized, date is plain)
        const encTitle = await encryptText(appt.title, encryptionSeed, true)
        const encTime = await encryptText(appt.time || "", encryptionSeed, false)
        const encNotes = await encryptText(appt.notes || "", encryptionSeed, false)

        const res = await fetch("http://localhost:8000/medication/appointments", {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: encTitle,
            date: appt.date, // Plain date string (no PHI, needed for queries)
            time: encTime,
            notes: encNotes
          })
        })
        if (res.ok) {
          successCount++
        } else {
          const errData = await res.json().catch(() => ({}))
          const detail = errData.detail || `Server returned status ${res.status}`
          console.error("Appointments sync failed:", detail)
          throw new Error(`Appointments sync failed: ${detail}`)
        }
      }

      setSyncStatus({
        active: true,
        message: `Successfully synced ${successCount} entries to Supabase Postgres database!`,
        type: 'success'
      })
    } catch (err) {
      console.error("Sync failed:", err)
      setSyncStatus({
        active: true,
        message: `Database sync failed: ${err.message}`,
        type: 'error'
      })
    }
  }

  const handleConsentAccept = () => {
    setConsentGranted(true)
    setShowConsentModal(false)
  }

  // Handle corrections for unverified drugs
  const applySuggestedCorrection = (index, suggestedName) => {
    setMedications(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        brand_name: suggestedName,
        is_unverified: false,
        suggested_name: ""
      }
      return updated
    })
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Editorial magazine header */}
      <header className="mb-8 border-b pb-6 border-stone-200">
        <span className="text-xs uppercase tracking-wider font-semibold text-emerald-800">Phase 3 Feature</span>
        <h1 className="text-3xl md:text-4xl font-serif text-stone-900 mt-1 font-bold">Consultation Recorder & Transcriber</h1>
        <p className="text-stone-500 mt-2 max-w-xl text-sm md:text-base">
          Record conversations during clinic visits. Our model automatically parses medications, schedules follow-ups, and flags safety warnings.
        </p>
      </header>

      {/* Sync banner alerts */}
      {syncStatus.active && (
        <div 
          className={`mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm animate-[fadeIn_0.3s_ease-out]`}
          style={{
            backgroundColor: syncStatus.type === 'success' ? 'var(--color-alert-success-bg, #f0fdf4)' : syncStatus.type === 'error' ? 'var(--color-alert-danger-bg, #fef2f2)' : 'var(--color-alert-info-bg, #eff6ff)',
            borderColor: syncStatus.type === 'success' ? 'var(--color-alert-success-border, #bbf7d0)' : syncStatus.type === 'error' ? 'var(--color-alert-danger-border, #fecaca)' : 'var(--color-alert-info-border, #bfdbfe)',
            color: syncStatus.type === 'success' ? 'var(--color-alert-success, #16a34a)' : syncStatus.type === 'error' ? 'var(--color-alert-danger, #dc2626)' : 'var(--color-alert-info, #2563eb)'
          }}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{syncStatus.message}</span>
        </div>
      )}

      {/* Main recording control interface */}
      <section className="bg-stone-50 border border-stone-200 rounded-2xl p-6 mb-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-stone-850 mb-2">Patient Consultation Recorder</h2>
        <p className="text-xs text-stone-500 mb-6 max-w-md mx-auto">
          Verify physician consent before starting. Audio data is processed in-memory and deleted immediately after analysis.
        </p>

        {/* CSS waveform visualizer */}
        <div className="flex items-end justify-center gap-1.5 h-16 mb-6">
          {waveformBars.map((height, idx) => (
            <div
              key={idx}
              className={`w-1 bg-emerald-600 rounded-full transition-all duration-75`}
              style={{ 
                height: `${height}%`,
                opacity: isRecording ? 1 : 0.45,
                boxShadow: isRecording ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
              }}
            />
          ))}
        </div>

        {/* Recording Time */}
        <div className="text-2xl font-mono font-bold text-stone-800 mb-6">
          {formatTime(recordingTime)}
        </div>

        {/* Audio controls button group */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-center items-center gap-4">
            {!isRecording ? (
              <>
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-800 hover:bg-emerald-950 text-white font-medium rounded-full shadow transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Record Visit
                </button>

                <input
                  type="file"
                  id="audio-upload-input"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="audio-upload-input"
                  className="flex items-center gap-2 px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-full shadow border border-stone-300 cursor-pointer transition-all duration-200"
                >
                  <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Voice
                </label>
              </>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full shadow animate-pulse transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <rect x="6" y="6" width="12" height="12" rx="1.5" />
                </svg>
                Stop & Save
              </button>
            )}

            {audioBlob && !isRecording && (
              <button
                onClick={processAudio}
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-3 bg-stone-900 hover:bg-stone-950 disabled:bg-stone-400 text-white font-medium rounded-full shadow transition-all duration-200"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Process Visit
                  </>
                )}
              </button>
            )}
          </div>

          {/* Selected file feedback */}
          {audioBlob && !isRecording && (
            <div className="text-xs text-stone-600 bg-stone-100 border border-stone-200 rounded-lg px-3 py-1.5 font-medium animate-[fadeIn_0.2s_ease-out]">
              Selected Audio: <span className="text-emerald-800">{audioBlob.name || "consultation.wav"}</span>
            </div>
          )}
        </div>
      </section>

      {/* Main display results grid */}
      {(transcript || isProcessing) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-[fadeIn_0.4s_ease-out]">
          
          {/* Left panel: Raw Transcript text */}
          <div className="border border-stone-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col">
            <h3 className="text-md font-bold text-stone-800 mb-4 border-b pb-2 flex items-center justify-between">
              <span>Visit Audio Transcript</span>
              {confidence < 0.6 && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-normal">
                  ⚠️ Low Confidence
                </span>
              )}
            </h3>
            
            {isProcessing ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-stone-400 gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-t-emerald-800 border-stone-200 animate-spin" />
                <span className="text-sm">Whisper-v3 transcribing audio...</span>
              </div>
            ) : (
              <p className="text-stone-700 leading-relaxed whitespace-pre-line text-sm md:text-base italic font-serif">
                "{transcript}"
              </p>
            )}
          </div>

          {/* Right panel: Timeline Checklist cards */}
          <div className="flex flex-col gap-6">
            <div className="border border-stone-200 rounded-2xl p-6 bg-white shadow-sm">
              <h3 className="text-md font-bold text-stone-800 mb-4 border-b pb-2">Structured Care Plan</h3>
              
              {isProcessing ? (
                <div className="flex flex-col gap-4 py-6">
                  <div className="h-12 bg-stone-100 rounded-xl animate-pulse" />
                  <div className="h-12 bg-stone-100 rounded-xl animate-pulse" />
                  <div className="h-12 bg-stone-100 rounded-xl animate-pulse" />
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  
                  {/* Medications cards */}
                  <div>
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-emerald-800 mb-3 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      Prescribed Medications ({medications.length})
                    </h4>
                    
                    {medications.length === 0 ? (
                      <p className="text-stone-400 text-sm italic">No medications detected.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {medications.map((med, idx) => (
                          <div 
                            key={idx} 
                            className="p-3 border rounded-xl bg-stone-50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm"
                            style={{ borderColor: med.is_unverified ? '#fecaca' : '#e5e5e5' }}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-850">{med.brand_name}</span>
                                {med.dosage_strength && (
                                  <span className="text-xs bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded">
                                    {med.dosage_strength}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500 mt-1">
                                {med.generic_name && <span>Generic: {med.generic_name} · </span>}
                                {med.frequency && <span>{med.frequency}</span>}
                                {med.duration && <span> ({med.duration})</span>}
                              </div>
                              
                              {/* Spelling correction banner */}
                              {med.is_unverified && med.suggested_name && (
                                <div className="mt-2 text-xs bg-red-50 text-red-700 p-2 rounded-lg border border-red-100 flex items-center gap-2">
                                  <span>Unverified drug spelling. Did you mean <strong>{med.suggested_name}</strong>?</span>
                                  <button 
                                    onClick={() => applySuggestedCorrection(idx, med.suggested_name)}
                                    className="bg-red-700 text-white px-2 py-0.5 rounded hover:bg-red-800 text-[10px] font-bold"
                                  >
                                    Yes
                                  </button>
                                </div>
                              )}
                              
                              {med.is_unverified && !med.suggested_name && (
                                <div className="mt-1 text-[11px] text-amber-700 flex items-center gap-1 font-semibold">
                                  <span>⚠️ Not found in standard databases. Review carefully.</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Appointments cards */}
                  <div>
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-emerald-800 mb-3 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                      </svg>
                      Follow-up Appointments ({appointments.length})
                    </h4>
                    
                    {appointments.length === 0 ? (
                      <p className="text-stone-400 text-sm italic">No follow-ups detected.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {appointments.map((appt, idx) => (
                          <div key={idx} className="p-3 border border-stone-200 rounded-xl bg-stone-50 text-sm">
                            <div className="font-bold text-stone-850">{appt.title}</div>
                            <div className="text-xs text-stone-600 mt-1">
                              <strong>Date:</strong> {appt.date} {appt.time && <span>· <strong>Time:</strong> {appt.time}</span>}
                            </div>
                            {appt.notes && (
                              <div className="text-xs text-stone-500 mt-1 italic border-l-2 border-stone-300 pl-2">
                                "{appt.notes}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Warnings cards */}
                  {warnings.length > 0 && (
                    <div>
                      <h4 className="text-xs uppercase tracking-wider font-semibold text-amber-800 mb-3 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Clinical Warnings & Instructions
                      </h4>
                      <ul className="list-disc pl-5 text-sm text-stone-700 flex flex-col gap-1.5">
                        {warnings.map((warning, idx) => (
                          <li key={idx} className="font-medium text-amber-900 bg-amber-50 border border-amber-100 rounded-lg p-2">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Approve and sync button */}
                  <div className="mt-4 pt-4 border-t border-stone-200 flex justify-end gap-3">
                    <button
                      onClick={resetAll}
                      className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-lg border border-stone-300 text-sm transition-all duration-200 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Reset Consultation
                    </button>
                    <button
                      onClick={handleApproveAndImport}
                      className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-950 text-white font-semibold rounded-lg shadow-sm text-sm transition-all duration-200 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Approve & Import to Supabase
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>
          
        </div>
      )}

      {/* Non-dismissible HIPAA Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 shadow-xl animate-[scaleUp_0.25s_ease-out]">
            <div className="text-emerald-800 mb-4">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-stone-900 mb-2">Consent Required for Visit Recording</h3>
            <p className="text-stone-600 text-sm leading-relaxed mb-6">
              To capture and transcribe your consultation, Prahari requires microphone permissions. In compliance with clinical data protection guidelines:
              <br /><br />
              • You must obtain verbal consent from your physician before recording.
              <br />
              • Audio files are processed entirely in-memory and immediately destroyed.
              <br />
              • Clinical identifiers are filtered to protect patient confidentiality.
            </p>

            <div className="flex gap-4">
              <button
                onClick={handleConsentAccept}
                className="flex-1 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-950 text-white font-semibold rounded-lg text-sm transition-all duration-200"
              >
                I Consent & Have Doctor's Permission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
