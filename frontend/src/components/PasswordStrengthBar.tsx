'use client'

import { useT } from '@/lib/i18n'
import { Check, Circle } from 'lucide-react'

export interface PasswordRule {
  label: string
  ok: boolean
}

export function getPasswordRules(password: string, t?: (key: string) => string): PasswordRule[] {
  const l = (key: string, fallback: string) => t ? t(key) : fallback
  return [
    { label: l('password.rulesMinLength', '12 caractères minimum'), ok: password.length >= 12 },
    { label: l('password.rulesUppercase', 'Une lettre majuscule (A-Z)'), ok: /[A-Z]/.test(password) },
    { label: l('password.rulesLowercase', 'Une lettre minuscule (a-z)'), ok: /[a-z]/.test(password) },
    { label: l('password.rulesDigit', 'Un chiffre (0-9)'), ok: /[0-9]/.test(password) },
    { label: l('password.rulesSpecial', 'Un caractère spécial (@$!%*?&#^()_+=.-)'), ok: /[@$!%*?&#^()_+=.\-]/.test(password) },
  ]
}

export function getPasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!password) return 0
  const rules = getPasswordRules(password)
  return rules.filter(r => r.ok).length as 0 | 1 | 2 | 3 | 4 | 5
}

const STRENGTH_COLORS = ['', 'var(--red)', 'var(--orange)', 'var(--amber)', 'var(--green)', 'var(--green2)']

interface Props {
  password: string
  style?: React.CSSProperties
}

export default function PasswordStrengthBar({ password, style }: Props) {
  const t = useT('common')
  if (!password) return null

  const STRENGTH_LABELS = ['', t('password.strengthVeryWeak'), t('password.strengthWeak'), t('password.strengthMedium'), t('password.strengthStrong'), t('password.strengthVeryStrong')]

  const score  = getPasswordStrength(password)
  const rules  = getPasswordRules(password, t)
  const color  = STRENGTH_COLORS[score]!
  const label  = STRENGTH_LABELS[score]!

  return (
    <div style={{ marginTop: 8, ...style }}>
      {/* Barre */}
      <div style={{ display: 'flex', gap: 3.5, marginBottom: 5 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            flex: 1, height: 3.5, borderRadius: 3,
            background: i <= score ? color : 'var(--border)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {/* Label force */}
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}>
          {label}
        </div>
      )}

      {/* Règles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rules.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ display: 'flex', color: r.ok ? 'var(--green)' : 'var(--text3)' }}>{r.ok ? <Check size={11.5} strokeWidth={2.5} /> : <Circle size={11.5} strokeWidth={2} />}</span>
            <span style={{ color: r.ok ? 'var(--text)' : 'var(--text3)', fontWeight: r.ok ? 600 : 400 }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
