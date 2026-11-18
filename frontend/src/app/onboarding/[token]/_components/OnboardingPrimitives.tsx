'use client'

import { AlertTriangle, CheckCircle2, Info, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MAX_STEPPER, previewClassNames } from '../_helpers/constants'

export const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  background: 'var(--surface)',
  border: '1.5px solid var(--border2)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 17,
  fontFamily: 'inherit',
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'all 0.2s',
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
        {label}
        {required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export function Alert({ msg, type }: { msg: string; type: 'error' | 'success' | 'info' }) {
  const styles = {
    error: { bg: 'var(--red-light)', border: 'rgba(220,38,38,0.25)', color: 'var(--red)', icon: AlertTriangle },
    success: { bg: 'var(--green-light)', border: 'rgba(142,42,58,0.25)', color: 'var(--green)', icon: CheckCircle2 },
    info: { bg: 'var(--blue-light)', border: 'rgba(37,99,235,0.25)', color: 'var(--blue)', icon: Info },
  }[type]
  const Icon = styles.icon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: styles.bg, border: `1.5px solid ${styles.border}`, borderRadius: 10, marginBottom: 14, fontSize: 14, fontWeight: 700, color: styles.color }}>
      <Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span>{msg}</span>
    </div>
  )
}

export function RadioCards({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; icon: LucideIcon }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length <= 3 ? options.length : 2}, 1fr)`, gap: 8 }}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '10px 8px',
              border: `2px solid ${active ? 'var(--primary)' : 'var(--border2)'}`,
              borderRadius: 10,
              background: active ? 'rgba(180,83,42,0.07)' : 'white',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ display: 'flex', color: active ? 'var(--green2)' : 'var(--text2)' }}>
              <o.icon size={22} strokeWidth={2} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--green2)' : 'var(--text2)', textAlign: 'center', lineHeight: 1.2 }}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function SubmitBtn({
  loading,
  disabled,
  onClick,
  children,
  loadingText,
}: {
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  loadingText?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        width: '100%',
        padding: '14px',
        background: loading || disabled ? '#a8d5c2' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
        color: 'white',
        fontSize: 18,
        fontWeight: 800,
        border: 'none',
        borderRadius: 10,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        boxShadow: loading || disabled ? 'none' : '0 4px 16px rgba(142,42,58,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
        transition: 'all 0.2s',
      }}
    >
      {loading ? (
        <>
          <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />{' '}
          {loadingText || 'Traitement en cours…'}
        </>
      ) : (
        children
      )}
    </button>
  )
}

export function CheckboxGroup({
  options,
  values,
  onChange,
  note,
}: {
  options: { value: string; label: string }[]
  values: string[]
  onChange: (v: string[]) => void
  note?: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => {
          const checked = values.includes(o.value)
          return (
            <label
              key={o.value}
              onClick={() => onChange(checked ? values.filter((v) => v !== o.value) : [...values, o.value])}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                border: `2px solid ${checked ? 'var(--primary)' : 'var(--border2)'}`,
                borderRadius: 8,
                background: checked ? 'rgba(180,83,42,0.07)' : 'white',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                color: checked ? 'var(--green2)' : 'var(--text2)',
                transition: 'all 0.15s',
                userSelect: 'none',
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? 'var(--primary)' : 'var(--border2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: checked ? 'var(--green)' : 'transparent', flexShrink: 0 }}>
                {checked && <Check size={12} strokeWidth={3} style={{ color: 'white' }} />}
              </span>
              {o.label}
            </label>
          )
        })}
      </div>
      {note && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontWeight: 600, lineHeight: 1.5 }}>{note}</div>}
    </div>
  )
}

export function StepperBtns({ value, onChange, max = MAX_STEPPER }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `2px solid ${value === n ? 'var(--primary)' : 'var(--border2)'}`,
            background: value === n ? 'var(--green)' : 'white',
            color: value === n ? 'white' : 'var(--text2)',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.12s',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export function ClassPreview({ levels, convention, emptyLabel }: { levels: { level: string; count: number }[]; convention: string; emptyLabel?: string }) {
  const lines = levels
    .filter((l) => l.count > 0)
    .map((l) => `${l.level} : ${previewClassNames(l.level, l.count, convention).join(' · ')}`)

  if (lines.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>{emptyLabel || 'Aucune classe configurée'}</div>
  }

  return (
    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, fontWeight: 600 }}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  )
}
