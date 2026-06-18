import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { encryptText, decryptText } from '../services/crypto'
import {
  getUserProfile,
  updateUserProfile,
  getCaregivers,
  addOrUpdateCaregiver,
  deleteCaregiver,
  registerPushSubscription
} from '../services/api'

export default function SentinelSettingsPage() {
  const { user, token } = useAuth()
  const encryptionSeed = user?.id || 'demo-fallback-seed'

  // User Profile State (Encrypted)
  const [allergies, setAllergies] = useState([])
  const [allergyInput, setAllergyInput] = useState('')
  const [labs, setLabs] = useState([])
  const [labKey, setLabKey] = useState('')
  const [labVal, setLabVal] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileStatus, setProfileStatus] = useState({ active: false, message: '', type: '' })

  // Caregivers State (Encrypted)
  const [caregivers, setCaregivers] = useState([])
  const [cgName, setCgName] = useState('')
  const [cgPhone, setCgPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [cgEmail, setCgEmail] = useState('')
  const [cgNotify, setCgNotify] = useState('all')
  const [cgLoading, setCgLoading] = useState(false)
  const [cgStatus, setCgStatus] = useState({ active: false, message: '', type: '' })

  // Medication Cabinet State
  const [meds, setMeds] = useState([])
  const [medsLoading, setMedsLoading] = useState(false)
  const [medsStatus, setMedsStatus] = useState({ active: false, message: '', type: '' })

  // Sentinel Configurations
  const [sentinelEnabled, setSentinelEnabled] = useState(
    localStorage.getItem('prahari_sentinel_enabled') === 'true'
  )
  const [demoMode, setDemoMode] = useState(
    localStorage.getItem('prahari_sentinel_demo_mode') === 'true'
  )
  const [pushStatus, setPushStatus] = useState({ active: false, message: '', type: '' })

  // -------------------------------------------------------------
  // Data Loading & Decryption
  // -------------------------------------------------------------

  const loadData = async () => {
    setProfileLoading(true)
    setCgLoading(true)
    setMedsLoading(true)

    try {
      // 1. Load Profile
      const prof = await getUserProfile(token).catch(() => ({ allergies: '', lab_results: '' }))
      if (prof.allergies) {
        const decAllergiesStr = await decryptText(prof.allergies, encryptionSeed)
        try {
          setAllergies(JSON.parse(decAllergiesStr))
        } catch {
          setAllergies([])
        }
      }
      if (prof.lab_results) {
        const decLabsStr = await decryptText(prof.lab_results, encryptionSeed)
        try {
          setLabs(JSON.parse(decLabsStr))
        } catch {
          setLabs([])
        }
      }

      // 2. Load Caregivers
      const cgList = await getCaregivers(token).catch(() => [])
      const decCgList = []
      for (const cg of cgList) {
        const decName = await decryptText(cg.name, encryptionSeed)
        const decPhone = await decryptText(cg.phone, encryptionSeed)
        const decEmail = await decryptText(cg.email, encryptionSeed)
        const decNotify = await decryptText(cg.notification_type, encryptionSeed)
        decCgList.push({
          id: cg.id,
          name: decName,
          phone: decPhone,
          email: decEmail,
          notification_type: decNotify
        })
      }
      setCaregivers(decCgList)

      // 3. Load Medications (Cabinet)
      // Call direct fetch to match Medications/Transcribe page cabinet schema
      const res = await fetch('http://localhost:8000/medication/cabinet', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const cabinet = await res.json()
        const decCabinet = []
        for (const item of cabinet) {
          const decBrand = await decryptText(item.brand_name, encryptionSeed)
          const decGeneric = await decryptText(item.generic_name || '', encryptionSeed)
          decCabinet.push({
            id: item.id,
            brand_name: decBrand,
            generic_name: decGeneric,
            reminder_time: item.reminder_time || '',
            is_high_priority: item.is_high_priority || false,
            // Keep encrypted fields for syncing updates
            rawBrand: item.brand_name,
            rawGeneric: item.generic_name,
            dosage_strength: item.dosage_strength,
            frequency: item.frequency,
            instructions: item.instructions
          })
        }
        setMeds(decCabinet)
      }
    } catch (err) {
      console.error('Failed to load sentinel settings details:', err)
    } finally {
      setProfileLoading(false)
      setCgLoading(false)
      setMedsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // -------------------------------------------------------------
  // Profile Handlers (Allergies & Labs)
  // -------------------------------------------------------------

  const handleSaveProfile = async (updatedAllergies, updatedLabs) => {
    setProfileStatus({ active: true, message: 'Encrypting and saving profile...', type: 'info' })
    try {
      const encAllergies = await encryptText(JSON.stringify(updatedAllergies), encryptionSeed, false)
      const encLabs = await encryptText(JSON.stringify(updatedLabs), encryptionSeed, false)
      
      await updateUserProfile(token, encAllergies, encLabs)
      setProfileStatus({ active: true, message: 'Profile updated and encrypted successfully.', type: 'success' })
    } catch (err) {
      setProfileStatus({ active: true, message: `Update failed: ${err.message}`, type: 'error' })
    }
  }

  const handleAddAllergy = () => {
    if (!allergyInput.trim()) return
    const newAllergies = [...allergies, allergyInput.trim()]
    setAllergies(newAllergies)
    setAllergyInput('')
    handleSaveProfile(newAllergies, labs)
  }

  const handleRemoveAllergy = (index) => {
    const newAllergies = allergies.filter((_, i) => i !== index)
    setAllergies(newAllergies)
    handleSaveProfile(newAllergies, labs)
  }

  const handleAddLab = () => {
    if (!labKey.trim() || !labVal.trim()) return
    const newLabs = [...labs, { key: labKey.trim(), value: labVal.trim() }]
    setLabs(newLabs)
    setLabKey('')
    setLabVal('')
    handleSaveProfile(allergies, newLabs)
  }

  const handleRemoveLab = (index) => {
    const newLabs = labs.filter((_, i) => i !== index)
    setLabs(newLabs)
    handleSaveProfile(allergies, newLabs)
  }

  // -------------------------------------------------------------
  // Caregiver Circle Handlers
  // -------------------------------------------------------------

  const handleAddCaregiver = async (e) => {
    e.preventDefault()
    if (!cgName.trim()) return

    setCgLoading(true)
    setCgStatus({ active: true, message: 'Encrypting and syncing caregiver...', type: 'info' })

    try {
      const encName = await encryptText(cgName.trim(), encryptionSeed, true)
      
      let rawPhone = cgPhone.trim()
      let fullPhone = rawPhone
      if (rawPhone && !rawPhone.startsWith('+')) {
        if (rawPhone.startsWith('0')) {
          rawPhone = rawPhone.substring(1)
        }
        fullPhone = `${countryCode}${rawPhone}`
      }
      
      const encPhone = await encryptText(fullPhone, encryptionSeed, false)
      const encEmail = await encryptText(cgEmail.trim(), encryptionSeed, false)
      const encNotify = await encryptText(cgNotify, encryptionSeed, false)

      await addOrUpdateCaregiver(token, {
        name: encName,
        phone: encPhone,
        email: encEmail,
        notification_type: encNotify
      })

      setCgName('')
      setCgPhone('')
      setCgEmail('')
      setCgStatus({ active: true, message: 'Caregiver added successfully.', type: 'success' })
      loadData()
    } catch (err) {
      setCgStatus({ active: true, message: `Failed: ${err.message}`, type: 'error' })
    } finally {
      setCgLoading(false)
    }
  }

  const handleDeleteCaregiver = async (id) => {
    if (!confirm('Are you sure you want to remove this caregiver?')) return
    setCgLoading(true)
    try {
      await deleteCaregiver(token, id)
      setCgStatus({ active: true, message: 'Caregiver deleted.', type: 'success' })
      loadData()
    } catch (err) {
      setCgStatus({ active: true, message: `Failed to delete: ${err.message}`, type: 'error' })
      setCgLoading(false)
    }
  }

  // -------------------------------------------------------------
  // Cabinet Reminders Handler
  // -------------------------------------------------------------

  const handleUpdateMedReminder = async (index, fields) => {
    const updatedMeds = [...meds]
    updatedMeds[index] = { ...updatedMeds[index], ...fields }
    setMeds(updatedMeds)

    const med = updatedMeds[index]
    setMedsStatus({ active: true, message: 'Updating cabinet reminder...', type: 'info' })
    try {
      await fetch('http://localhost:8000/medication/cabinet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: med.id,
          brand_name: med.rawBrand,
          generic_name: med.rawGeneric,
          dosage_strength: med.dosage_strength,
          frequency: med.frequency,
          instructions: med.instructions,
          reminder_time: med.reminder_time,
          is_high_priority: med.is_high_priority
        })
      })
      setMedsStatus({ active: true, message: 'Reminder updated successfully.', type: 'success' })
    } catch (err) {
      setMedsStatus({ active: true, message: `Update failed: ${err.message}`, type: 'error' })
    }
  }

  // -------------------------------------------------------------
  // Sentinel Options Handlers
  // -------------------------------------------------------------

  const handleToggleSentinel = (e) => {
    const checked = e.target.checked
    setSentinelEnabled(checked)
    localStorage.setItem('prahari_sentinel_enabled', checked ? 'true' : 'false')
  }

  const handleToggleDemoMode = (e) => {
    const checked = e.target.checked
    setDemoMode(checked)
    localStorage.setItem('prahari_sentinel_demo_mode', checked ? 'true' : 'false')
  }

  // -------------------------------------------------------------
  // Web Push Subscription Helper
  // -------------------------------------------------------------

  const subscribeWebPush = async () => {
    setPushStatus({ active: true, message: 'Requesting permission...', type: 'info' })
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push messaging is not supported in this browser.')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission denied.')
      }

      // VAPID keys setup: we fetch public key from config (or generate a mock)
      // Since public key might be empty in dev, we fallback or require it
      const pubKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BF7kR5F7iVfG9lGZJk7t_q9pU2P7hZ7t_q9pU2P7hZ7t_q9pU2P7hZ7t_q9pU2P7hZ7t_q9pU2P7hZ7t_q9pU2A=='
      
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pubKey)
      })

      // Send subscription object to backend
      const subJSON = subscription.toJSON()
      await registerPushSubscription(token, {
        endpoint: subJSON.endpoint,
        keys_p256dh: subJSON.keys.p256dh,
        keys_auth: subJSON.keys.auth
      })

      setPushStatus({ active: true, message: 'App notifications enabled successfully!', type: 'success' })
    } catch (err) {
      setPushStatus({ active: true, message: `Failed to enable push: ${err.message}`, type: 'error' })
    }
  }

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'var(--font-sans)', color: 'var(--color-slate-dark)' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-forest)', margin: 0 }}>
          🛡️ Guardian Sentinel & Profile Settings
        </h1>
        <p style={{ color: 'var(--color-slate-light)', marginTop: '0.25rem' }}>
          Configure emergency caregivers, medical risk factors, E2EE profile, and inactivity alarm alerts.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* Row 1: Sentinel Configuration & Alarms */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr md:1fr', gap: '2rem' }}>
          {/* Card 1: Sentinel Mode */}
          <div style={{
            background: 'var(--color-cream-light)',
            border: '1.5px solid var(--color-mint-border)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-forest)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🚨 Alert Inactivity Watcher
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sentinelEnabled}
                  onChange={handleToggleSentinel}
                  style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--color-forest)' }}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Enable Guardian Sentinel</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)' }}>
                    Monitor device motion and trigger alarms if medication check-offs are missed.
                  </span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={handleToggleDemoMode}
                  style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--color-forest)' }}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Demo / Fast Testing Mode</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-light)' }}>
                    Speeds up the inactivity alarm threshold from 2 hours to 15 seconds.
                  </span>
                </div>
              </label>

              <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px dashed var(--color-mint-border)' }}>
                <button
                  onClick={subscribeWebPush}
                  style={{
                    backgroundColor: 'var(--color-forest)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  🔔 Enable Caregiver App Notifications
                </button>
                {pushStatus.active && (
                  <p style={{
                    fontSize: '0.8rem',
                    marginTop: '0.5rem',
                    color: pushStatus.type === 'success' ? 'var(--color-alert-safe)' : 'var(--color-alert-critical)'
                  }}>
                    {pushStatus.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Caregiver Circle */}
          <div style={{
            background: 'var(--color-cream-light)',
            border: '1.5px solid var(--color-mint-border)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-forest)', margin: '0 0 1rem 0' }}>
              👥 Caregiver Circle (Encrypted)
            </h2>

            <form onSubmit={handleAddCaregiver} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="Caregiver Name"
                value={cgName}
                onChange={(e) => setCgName(e.target.value)}
                required
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--color-mint-border)', fontSize: '0.9rem' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    style={{
                      padding: '0.5rem 0.25rem',
                      borderRadius: '8px',
                      border: '1.5px solid var(--color-mint-border)',
                      fontSize: '0.85rem',
                      backgroundColor: 'white',
                      color: 'var(--color-charcoal)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+65">🇸🇬 +65</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+971">🇦🇪 +971</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={cgPhone}
                    onChange={(e) => setCgPhone(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '0',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1.5px solid var(--color-mint-border)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={cgEmail}
                  onChange={(e) => setCgEmail(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--color-mint-border)', fontSize: '0.9rem' }}
                />
              </div>
              <button
                type="submit"
                disabled={cgLoading}
                style={{
                  backgroundColor: 'var(--color-forest)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Add Member
              </button>
            </form>

            {cgStatus.active && (
              <p style={{
                fontSize: '0.8rem',
                marginBottom: '1rem',
                color: cgStatus.type === 'success' ? 'var(--color-alert-safe)' : 'var(--color-forest)'
              }}>
                {cgStatus.message}
              </p>
            )}

            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.5rem' }}>Active Circle</h3>
              {cgLoading && <p style={{ fontSize: '0.85rem' }}>Loading circle...</p>}
              {!cgLoading && caregivers.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-light)' }}>No caregivers registered.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {caregivers.map((cg) => (
                  <div key={cg.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255,255,255,0.6)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-mint-border)',
                    fontSize: '0.85rem'
                  }}>
                    <div>
                      <strong>{cg.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-slate-light)' }}>
                        {cg.phone} | {cg.email}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteCaregiver(cg.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-alert-critical)',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Medication Reminders */}
        <div style={{
          background: 'var(--color-cream-light)',
          border: '1.5px solid var(--color-mint-border)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-forest)', margin: '0 0 1rem 0' }}>
            ⏰ Pill Reminders & Alarm Schedules
          </h2>
          {medsLoading && <p style={{ fontSize: '0.85rem' }}>Loading medications...</p>}
          {!medsLoading && meds.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-light)' }}>Your Medicine Cabinet is empty. Scan medicines to schedule alerts.</p>
          )}

          {medsStatus.active && (
            <p style={{
              fontSize: '0.8rem',
              marginBottom: '1rem',
              color: medsStatus.type === 'success' ? 'var(--color-alert-safe)' : 'var(--color-forest)'
            }}>
              {medsStatus.message}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
            {meds.map((med, index) => (
              <div key={med.id} style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.6)',
                borderRadius: '12px',
                border: '1px solid var(--color-mint-border)',
                gap: '1rem'
              }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>{med.brand_name}</strong>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-slate-light)' }}>
                    Generic: {med.generic_name || 'Not specified'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={med.is_high_priority}
                      onChange={(e) => handleUpdateMedReminder(index, { is_high_priority: e.target.checked })}
                      style={{ accentColor: 'var(--color-forest)' }}
                    />
                    🚨 High Priority
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem' }}>Reminder Time:</span>
                    <input
                      type="time"
                      value={med.reminder_time}
                      onChange={(e) => handleUpdateMedReminder(index, { reminder_time: e.target.value })}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--color-mint-border)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Allergies & Lab Results */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr md:1fr', gap: '2rem' }}>
          {/* Card 1: Allergies */}
          <div style={{
            background: 'var(--color-cream-light)',
            border: '1.5px solid var(--color-mint-border)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-forest)', margin: '0 0 1rem 0' }}>
              🚫 Drug Allergies (Encrypted)
            </h2>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="e.g. Penicillin"
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--color-mint-border)', fontSize: '0.9rem' }}
              />
              <button
                onClick={handleAddAllergy}
                style={{
                  backgroundColor: 'var(--color-forest)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Add Tag
              </button>
            </div>

            {profileLoading && <p style={{ fontSize: '0.85rem' }}>Loading profile...</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {!profileLoading && allergies.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-light)' }}>No allergy records. Add tags to enable safety scans.</p>
              )}
              {allergies.map((a, i) => (
                <span key={i} style={{
                  backgroundColor: 'rgba(194,75,60,0.15)',
                  border: '1px solid rgba(194,75,60,0.3)',
                  color: 'var(--color-alert-critical)',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  {a}
                  <button
                    onClick={() => handleRemoveAllergy(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-alert-critical)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      padding: 0
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Card 2: Lab Results & Conditions */}
          <div style={{
            background: 'var(--color-cream-light)',
            border: '1.5px solid var(--color-mint-border)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-forest)', margin: '0 0 1rem 0' }}>
              🔬 Health Conditions & Labs (Encrypted)
            </h2>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="Metric (e.g. Creatinine)"
                value={labKey}
                onChange={(e) => setLabKey(e.target.value)}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--color-mint-border)', fontSize: '0.9rem' }}
              />
              <input
                type="text"
                placeholder="Value (e.g. High)"
                value={labVal}
                onChange={(e) => setLabVal(e.target.value)}
                style={{ width: '30%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--color-mint-border)', fontSize: '0.9rem' }}
              />
              <button
                onClick={handleAddLab}
                style={{
                  backgroundColor: 'var(--color-forest)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {!profileLoading && labs.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-light)' }}>No active health conditions or lab results.</p>
              )}
              {labs.map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-mint-border)',
                  fontSize: '0.85rem'
                }}>
                  <div>
                    <span style={{ fontWeight: '700' }}>{item.key}</span>: <span style={{ color: 'var(--color-forest)', fontWeight: '600' }}>{item.value}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveLab(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-alert-critical)',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
