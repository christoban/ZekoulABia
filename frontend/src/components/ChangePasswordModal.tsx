'use client'
import { useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import PasswordStrengthBar, { getPasswordStrength } from './PasswordStrengthBar'
import { useT } from '@/lib/i18n'
import { CheckCircle2, EyeOff, Eye, AlertTriangle, X } from 'lucide-react'

interface Props {
  onClose: () => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function ChangePasswordModal({ onClose, onToast }: Props) {
  const t = useT('common')
  const [currentPwd,  setCurrentPwd]  = useState('')
  const [newPwd,      setNewPwd]      = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)

  const strength = getPasswordStrength(newPwd)
  const mismatch = confirmPwd.length > 0 && confirmPwd !== newPwd

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!currentPwd || !newPwd || !confirmPwd) { setError(t('password.errorRequired')); return }
    if (newPwd !== confirmPwd) { setError(t('password.errorMismatch')); return }
    if (strength < 5) { setError(t('password.errorStrength')); return }

    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/users/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd, confirmPassword: confirmPwd }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || t('password.errorChange')); return }
      setSuccess(true)
      onToast?.(t('password.successMsg'), 'success')
      setTimeout(() => onClose(), 1800)
    } catch {
      setError(t('password.errorNetwork'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={() => !loading && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 14, padding: '20px 24px', width: 420, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {t('password.changeTitle')}
          </div>
          <button type="button" onClick={onClose} disabled={loading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 16, lineHeight: 1.4 }}>
          {t('password.subtitle')}
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green)', marginBottom: 10 }}><CheckCircle2 size={40} strokeWidth={2} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>{t('password.successTitle')}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelSt}>{t('password.currentLabel')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ ...inputSt, paddingRight: 38 }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowCurrent(s => !s)} style={eyeSt}>
                  {showCurrent ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 6 }}>
              <label style={labelSt}>{t('password.newLabel')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ ...inputSt, paddingRight: 38 }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNew(s => !s)} style={eyeSt}>
                  {showNew ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
                </button>
              </div>
              {newPwd && <PasswordStrengthBar password={newPwd} />}
            </div>

            <div style={{ marginBottom: 16, marginTop: 10 }}>
              <label style={labelSt}>{t('password.confirmLabel')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ ...inputSt, paddingRight: 38, borderColor: mismatch ? 'var(--red)' : 'var(--border2)' }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)} style={eyeSt}>
                  {showConfirm ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
                </button>
              </div>
              {mismatch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--red)', marginTop: 3, fontWeight: 600 }}>
                  <AlertTriangle size={12} strokeWidth={2} /> {t('password.errorMismatch')}
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 7, padding: '7px 11px', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{ flex: '0 0 auto', minWidth: 85, padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                {t('password.buttonCancel')}
              </button>
              <button
                type="submit"
                disabled={loading || strength < 5 || mismatch}
                style={{ flex: 1, padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center', background: (loading || strength < 5 || mismatch) ? 'var(--text3)' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: (loading || strength < 5 || mismatch) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>
                {loading ? t('password.buttonSubmitting') : t('password.buttonSubmit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 4, letterSpacing: '0.3px', textTransform: 'uppercase' }
const inputSt: React.CSSProperties = { width: '100%', padding: '7px 11px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const eyeSt: React.CSSProperties = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', padding: 0 }
