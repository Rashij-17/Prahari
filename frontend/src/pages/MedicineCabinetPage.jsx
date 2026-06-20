/**
 * MedicineCabinetPage.jsx — Module 1
 * ====================================
 * "My Medicine Cabinet" — Virtual drawer UI backed by IndexedDB.
 * Each medicine is rendered as a smooth-sliding drawer.
 * Add / Edit / Delete operations sync immediately to IndexedDB.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  addMedicine,
  getMedicines,
  updateMedicine,
  deleteMedicine,
} from '../services/medicineCabinetDB.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const uuid = () => crypto.randomUUID()

const today = () => new Date().toISOString().split('T')[0]

const isExpired = (dateStr) => dateStr && new Date(dateStr) < new Date()
const isExpiringSoon = (dateStr) => {
  if (!dateStr) return false
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 30
}

const EMPTY_FORM = {
  id: '',
  name: '',
  genericSalt: '',
  dosage: '',
  frequency: '',
  stockCount: '',
  expiryDate: '',
  notes: '',
}

const FREQUENCY_OPTIONS = ['OD', 'BD', 'TDS', 'QID', 'HS', 'SOS/PRN', 'STAT', 'Other']

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icon = {
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Chevron: ({ open }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 280ms ease' }} aria-hidden="true">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Edit: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  Pill: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
    </svg>
  ),
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Box: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Warning: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Empty: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="2"/>
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Drawer Component
// ---------------------------------------------------------------------------
function MedicineDrawer({ medicine, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const contentRef = useRef(null)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [open, medicine])

  const expired = isExpired(medicine.expiryDate)
  const expiringSoon = isExpiringSoon(medicine.expiryDate)
  const lowStock = medicine.stockCount !== '' && Number(medicine.stockCount) <= 7

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const statusColor = expired
    ? 'var(--color-critical)'
    : expiringSoon
    ? 'var(--color-amber)'
    : 'var(--color-safe)'

  return (
    <div
      style={{
        background: 'var(--color-white)',
        border: `1.5px solid ${open ? 'var(--cabinet-accent)' : 'var(--color-border)'}`,
        borderRadius: '14px',
        boxShadow: open ? '0 4px 20px rgba(99,102,241,0.10)' : 'var(--shadow-xs)',
        transition: 'border-color 250ms ease, box-shadow 250ms ease',
        overflow: 'hidden',
      }}
      role="listitem"
    >
      {/* Drawer Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${medicine.name}`}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.125rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Pill icon accent */}
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '9px',
          background: open ? 'var(--cabinet-accent)' : 'rgba(99,102,241,0.08)',
          color: open ? '#fff' : 'var(--cabinet-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 250ms ease, color 250ms ease',
        }}>
          <Icon.Pill />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' }}>
              {medicine.name}
            </span>
            {expired && (
              <span className="chip chip-critical" style={{ fontSize: '0.6rem' }}>Expired</span>
            )}
            {!expired && expiringSoon && (
              <span className="chip chip-moderate" style={{ fontSize: '0.6rem' }}>Exp. Soon</span>
            )}
            {lowStock && (
              <span className="chip chip-moderate" style={{ fontSize: '0.6rem' }}>Low Stock</span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
            {medicine.dosage} · {medicine.frequency}
          </div>
        </div>

        {/* Stock pill */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
          marginRight: '0.25rem',
        }}>
          <span style={{
            fontSize: '1.1rem',
            fontWeight: 800,
            color: lowStock ? 'var(--color-amber)' : 'var(--color-ink)',
            fontFamily: 'var(--font-display)',
            lineHeight: 1,
          }}>
            {medicine.stockCount ?? '—'}
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--color-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            tabs
          </span>
        </div>

        <div style={{ color: 'var(--color-faint)', flexShrink: 0 }}>
          <Icon.Chevron open={open} />
        </div>
      </button>

      {/* Animated Content Panel */}
      <div
        style={{
          maxHeight: open ? `${contentHeight + 200}px` : '0px',
          overflow: 'hidden',
          transition: 'max-height 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div ref={contentRef} style={{ padding: '0 1.125rem 1.125rem' }}>
          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--color-border)', marginBottom: '1rem' }} />

          {/* Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { icon: <Icon.Box />, label: 'Generic Salt', value: medicine.genericSalt || '—' },
              { icon: <Icon.Pill />, label: 'Dosage', value: medicine.dosage || '—' },
              { icon: null, label: 'Frequency', value: medicine.frequency || '—' },
              {
                icon: <Icon.Calendar />,
                label: 'Expiry',
                value: formatDate(medicine.expiryDate),
                color: statusColor,
              },
              { icon: <Icon.Box />, label: 'Stock Remaining', value: `${medicine.stockCount ?? '—'} tablets` },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{
                background: 'var(--color-cream)',
                borderRadius: '10px',
                padding: '0.625rem 0.875rem',
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-faint)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {icon}{label}
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: color || 'var(--color-ink)' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {medicine.notes && (
            <div style={{
              background: 'rgba(99,102,241,0.05)',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: '10px',
              padding: '0.75rem',
              fontSize: '0.85rem',
              color: 'var(--color-muted)',
              marginBottom: '1rem',
              lineHeight: 1.55,
            }}>
              <span style={{ fontWeight: 700, color: 'var(--cabinet-accent)', marginRight: '0.4rem' }}>Notes:</span>
              {medicine.notes}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => onEdit(medicine)}
              aria-label={`Edit ${medicine.name}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.45rem 0.875rem',
                borderRadius: '8px',
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-white)',
                color: 'var(--color-muted)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cabinet-accent)'; e.currentTarget.style.color = 'var(--cabinet-accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-muted)' }}
            >
              <Icon.Edit /> Edit
            </button>
            <button
              onClick={() => onDelete(medicine.id, medicine.name)}
              aria-label={`Delete ${medicine.name}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.45rem 0.875rem',
                borderRadius: '8px',
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-white)',
                color: 'var(--color-muted)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-critical)'; e.currentTarget.style.color = 'var(--color-critical)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-muted)' }}
            >
              <Icon.Trash /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit Modal
// ---------------------------------------------------------------------------
function MedicineModal({ isOpen, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const firstInputRef = useRef(null)

  useEffect(() => {
    setForm(initial || EMPTY_FORM)
    setErrors({})
    setSaving(false)
  }, [initial, isOpen])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Medicine name is required'
    if (!form.dosage.trim()) errs.dosage = 'Dosage is required'
    if (!form.frequency) errs.frequency = 'Frequency is required'
    if (form.stockCount !== '' && isNaN(Number(form.stockCount))) errs.stockCount = 'Must be a number'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    await onSave({
      ...form,
      id: form.id || uuid(),
      stockCount: form.stockCount === '' ? '' : Number(form.stockCount),
    })
    setSaving(false)
  }

  const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }

  if (!isOpen) return null

  const Field = ({ label, id, required, error, children }) => (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.35rem' }}>
        {label}{required && <span style={{ color: 'var(--color-critical)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: '0.75rem', color: 'var(--color-critical)', margin: '0.2rem 0 0' }}>{error}</p>}
    </div>
  )

  const inputStyle = (hasErr) => ({
    width: '100%',
    padding: '0.65rem 0.875rem',
    borderRadius: '9px',
    border: `1.5px solid ${hasErr ? 'var(--color-critical)' : 'var(--color-border)'}`,
    background: 'var(--color-white)',
    color: 'var(--color-ink)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 150ms ease',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={form.id ? 'Edit Medicine' : 'Add New Medicine'}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(26,23,20,0.55)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal Panel */}
      <div
        style={{
          position: 'relative',
          background: 'var(--color-white)',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-xl)',
          animation: 'modal-enter 220ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
          position: 'sticky', top: 0, background: 'var(--color-white)', zIndex: 1,
          borderRadius: '18px 18px 0 0',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
            {form.id ? 'Edit Medicine' : '＋ Add to Cabinet'}
          </h2>
          <button onClick={onClose} aria-label="Close modal" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'flex', padding: '0.25rem' }}>
            <Icon.Close />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="Medicine Name" id="med-name" required error={errors.name}>
            <input
              id="med-name" ref={firstInputRef} value={form.name} onChange={set('name')}
              placeholder="e.g. Metformin 500mg" style={inputStyle(errors.name)}
              onFocus={e => e.target.style.borderColor = 'var(--cabinet-accent)'}
              onBlur={e => e.target.style.borderColor = errors.name ? 'var(--color-critical)' : 'var(--color-border)'}
            />
          </Field>

          <Field label="Generic Salt" id="med-salt">
            <input
              id="med-salt" value={form.genericSalt} onChange={set('genericSalt')}
              placeholder="e.g. Metformin Hydrochloride" style={inputStyle(false)}
              onFocus={e => e.target.style.borderColor = 'var(--cabinet-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Field label="Dosage" id="med-dosage" required error={errors.dosage}>
              <input
                id="med-dosage" value={form.dosage} onChange={set('dosage')}
                placeholder="e.g. 500mg twice daily" style={inputStyle(errors.dosage)}
                onFocus={e => e.target.style.borderColor = 'var(--cabinet-accent)'}
                onBlur={e => e.target.style.borderColor = errors.dosage ? 'var(--color-critical)' : 'var(--color-border)'}
              />
            </Field>

            <Field label="Frequency" id="med-freq" required error={errors.frequency}>
              <select
                id="med-freq" value={form.frequency} onChange={set('frequency')}
                style={{ ...inputStyle(errors.frequency), cursor: 'pointer' }}
              >
                <option value="">Select...</option>
                {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Field label="Stock Count (tablets)" id="med-stock" error={errors.stockCount}>
              <input
                id="med-stock" type="number" min="0" value={form.stockCount} onChange={set('stockCount')}
                placeholder="e.g. 30" style={inputStyle(errors.stockCount)}
                onFocus={e => e.target.style.borderColor = 'var(--cabinet-accent)'}
                onBlur={e => e.target.style.borderColor = errors.stockCount ? 'var(--color-critical)' : 'var(--color-border)'}
              />
            </Field>

            <Field label="Expiry Date" id="med-expiry">
              <input
                id="med-expiry" type="date" value={form.expiryDate} onChange={set('expiryDate')}
                style={inputStyle(false)}
                onFocus={e => e.target.style.borderColor = 'var(--cabinet-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
              />
            </Field>
          </div>

          <Field label="Notes" id="med-notes">
            <textarea
              id="med-notes" value={form.notes} onChange={set('notes')}
              placeholder="Additional instructions, doctor's notes..." rows={3}
              style={{ ...inputStyle(false), resize: 'vertical', lineHeight: 1.55 }}
              onFocus={e => e.target.style.borderColor = 'var(--cabinet-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
            />
          </Field>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.5rem',
                borderRadius: '9px', border: 'none',
                background: 'var(--cabinet-accent)', color: '#fff',
                fontWeight: 600, fontSize: '0.9375rem', fontFamily: 'var(--font-sans)',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'opacity 150ms ease',
              }}
            >
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete Confirm Dialog
// ---------------------------------------------------------------------------
function DeleteConfirm({ name, onConfirm, onCancel }) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm deletion"
      style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div onClick={onCancel} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(26,23,20,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative',
        background: 'var(--color-white)', borderRadius: '16px', padding: '2rem',
        maxWidth: '380px', width: '100%',
        boxShadow: 'var(--shadow-xl)', animation: 'modal-enter 200ms ease forwards',
        textAlign: 'center',
      }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--color-critical-bg)', color: 'var(--color-critical)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <Icon.Trash />
        </div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Delete "{name}"?</h3>
        <p style={{ fontSize: '0.875rem', margin: '0 0 1.5rem' }}>This will permanently remove it from your cabinet. This action cannot be undone.</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={onCancel} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '0.6rem 1.25rem', borderRadius: '9px', border: 'none', background: 'var(--color-critical)', color: '#fff', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer', fontSize: '0.9375rem' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MedicineCabinetPage() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)  // null = new, obj = edit
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, name }
  const [searchQuery, setSearchQuery] = useState('')

  // Pre-fill name from URL (integration with Module 5)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const prefill = params.get('prefill')
    if (prefill) {
      setEditTarget({ ...EMPTY_FORM, name: decodeURIComponent(prefill) })
      setModalOpen(true)
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getMedicines()
      setMedicines(data)
    } catch (err) {
      setError(`Failed to load medicines: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleSave = async (med) => {
    try {
      if (med.id && medicines.find(m => m.id === med.id)) {
        await updateMedicine(med)
      } else {
        await addMedicine(med)
      }
      await loadAll()
      setModalOpen(false)
      setEditTarget(null)
    } catch (err) {
      setError(`Save failed: ${err.message}`)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteMedicine(deleteTarget.id)
      await loadAll()
    } catch (err) {
      setError(`Delete failed: ${err.message}`)
    } finally {
      setDeleteTarget(null)
    }
  }

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.genericSalt || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const expiredCount = medicines.filter(m => isExpired(m.expiryDate)).length
  const lowStockCount = medicines.filter(m => m.stockCount !== '' && Number(m.stockCount) <= 7).length

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: '6rem' }}>
      {/* CSS Custom Properties for cabinet accent (indigo/purple) */}
      <style>{`
        :root { --cabinet-accent: #6366f1; }
        .dark { --cabinet-accent: #818cf8; }
      `}</style>

      {/* Page Header */}
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🗄️</span> My Medicine Cabinet
        </h1>
        <p>Your personal medication organizer — all data stored securely on this device.</p>
      </div>

      {/* Stats Row */}
      {medicines.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Medicines', value: medicines.length, color: 'var(--cabinet-accent)' },
            { label: 'Expired', value: expiredCount, color: expiredCount > 0 ? 'var(--color-critical)' : 'var(--color-safe)' },
            { label: 'Low Stock', value: lowStockCount, color: lowStockCount > 0 ? 'var(--color-amber)' : 'var(--color-safe)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card" style={{ textAlign: 'center', padding: '0.875rem' }}>
              <div style={{ fontSize: '1.625rem', fontWeight: 800, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.25rem', fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {medicines.length > 0 && (
        <div className="search-wrapper" style={{ marginBottom: '1.25rem' }}>
          <input
            id="cabinet-search"
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by medicine or generic name…"
            aria-label="Search medicines"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-border)', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-critical)' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-pulse" style={{ height: '72px', borderRadius: '14px' }} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && medicines.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div style={{ color: 'var(--color-faint)', display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <Icon.Empty />
          </div>
          <h3 style={{ color: 'var(--color-ink)', fontSize: '1.125rem', marginBottom: '0.5rem' }}>Your cabinet is empty</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Add your first medicine to get started tracking your medications.
          </p>
          <button
            onClick={() => { setEditTarget(null); setModalOpen(true) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.7rem 1.5rem', borderRadius: '9px', border: 'none',
              background: 'var(--cabinet-accent)', color: '#fff',
              fontWeight: 600, fontSize: '0.9375rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Icon.Plus /> Add First Medicine
          </button>
        </div>
      )}

      {/* Drawer List */}
      {!loading && filtered.length > 0 && (
        <div role="list" aria-label="Medicine cabinet drawers" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {filtered.map(med => (
            <MedicineDrawer
              key={med.id}
              medicine={med}
              onEdit={(m) => { setEditTarget(m); setModalOpen(true) }}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
            />
          ))}
        </div>
      )}

      {/* No search results */}
      {!loading && medicines.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
          No medicines match "<strong>{searchQuery}</strong>"
        </div>
      )}

      {/* Floating Add Button */}
      {!loading && (
        <button
          id="cabinet-add-fab"
          onClick={() => { setEditTarget(null); setModalOpen(true) }}
          aria-label="Add new medicine"
          style={{
            position: 'fixed',
            bottom: 'calc(70px + env(safe-area-inset-bottom, 0px) + 1rem)',
            right: '1.25rem',
            zIndex: 90,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: 'none',
            background: 'var(--cabinet-accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(99,102,241,0.40)',
            cursor: 'pointer',
            transition: 'transform 200ms ease, box-shadow 200ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(99,102,241,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.40)' }}
        >
          <Icon.Plus />
        </button>
      )}

      {/* Modal */}
      <MedicineModal
        isOpen={modalOpen}
        initial={editTarget}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
      />

      {/* Delete Confirm */}
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
