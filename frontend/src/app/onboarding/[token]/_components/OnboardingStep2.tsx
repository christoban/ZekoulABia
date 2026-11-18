'use client'

import { Eye, EyeOff } from 'lucide-react'
import PasswordStrengthBar from '@/components/PasswordStrengthBar'
import { useT } from '@/lib/i18n'
import type { FormData } from '../_helpers/types'
import { Field, INPUT, SubmitBtn } from './OnboardingPrimitives'

interface Props {
  form: FormData
  set: (k: keyof FormData) => (v: string) => void
  showPwd: boolean
  setShowPwd: (fn: (prev: boolean) => boolean) => void
  showConfirm: boolean
  setShowConfirm: (fn: (prev: boolean) => boolean) => void
  onBack: () => void
  onNext: () => void
}

export default function OnboardingStep2({
  form,
  set,
  showPwd,
  setShowPwd,
  showConfirm,
  setShowConfirm,
  onBack,
  onNext,
}: Props) {
  const t = useT('onboarding')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <button
        type="button"
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}
      >
        {t('phase1.step2.back')}
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label={t('phase1.step2.firstName.label')} required>
          <input className="edu-field" value={form.adminPrenom} style={INPUT} onChange={(e) => set('adminPrenom')(e.target.value)} placeholder={t('phase1.step2.firstName.placeholder')} />
        </Field>
        <Field label={t('phase1.step2.lastName.label')} required>
          <input className="edu-field" value={form.adminNom} style={INPUT} onChange={(e) => set('adminNom')(e.target.value)} placeholder={t('phase1.step2.lastName.placeholder')} />
        </Field>
      </div>

      <Field label={t('phase1.step2.email.label')} required>
        <input className="edu-field" type="email" value={form.adminEmail} style={INPUT} onChange={(e) => set('adminEmail')(e.target.value)} placeholder={t('phase1.step2.email.placeholder')} />
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>{t('phase1.step2.email.hint')}</div>
      </Field>

      <Field label={t('phase1.step2.password.label')} required>
        <div style={{ position: 'relative' }}>
          <input
            className="edu-field"
            type={showPwd ? 'text' : 'password'}
            value={form.password}
            style={{ ...INPUT, paddingRight: 44 }}
            onChange={(e) => set('password')(e.target.value)}
            placeholder={t('phase1.step2.password.placeholder')}
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text3)' }}
          >
            {showPwd ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
          </button>
        </div>
        {form.password && <PasswordStrengthBar password={form.password} />}
      </Field>

      <Field label={t('phase1.step2.confirmPassword.label')} required>
        <div style={{ position: 'relative' }}>
          <input
            className="edu-field"
            type={showConfirm ? 'text' : 'password'}
            value={form.confirmPassword}
            style={{ ...INPUT, paddingRight: 44, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? 'var(--red)' : 'var(--border2)' }}
            onChange={(e) => set('confirmPassword')(e.target.value)}
            placeholder={t('phase1.step2.confirmPassword.placeholder')}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text3)' }}
          >
            {showConfirm ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
          </button>
        </div>
        {form.confirmPassword && form.confirmPassword !== form.password && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4, fontWeight: 700 }}>{t('phase1.step2.confirmPassword.mismatch')}</div>
        )}
      </Field>

      <SubmitBtn onClick={onNext}>{t('phase1.buttons.step2Submit')}</SubmitBtn>
    </div>
  )
}
