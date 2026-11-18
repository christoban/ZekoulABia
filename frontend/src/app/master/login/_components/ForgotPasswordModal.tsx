'use client'

import { useState } from 'react'
import { CheckCircle2, ArrowLeft, EyeOff, Eye } from 'lucide-react'
import PasswordStrengthBar, { getPasswordStrength } from '@/components/PasswordStrengthBar'
import { Alert, Field, maskEmail, inputBaseStyle, handleFocus, handleBlur, type AlertState } from './LoginPrimitives'

const API_BASE = ''

interface Props {
  initialEmail: string
  onClose: () => void
  onResetSuccess: (resetEmail: string) => void
}

export default function ForgotPasswordModal({ initialEmail, onClose, onResetSuccess }: Props) {
  const [forgotStep, setForgotStep] = useState<1 | 2>(1)
  const [forgotEmail, setForgotEmail] = useState(initialEmail)
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotPwd, setForgotPwd] = useState('')
  const [forgotConfirm, setForgotConfirm] = useState('')
  const [showForgotPwd, setShowForgotPwd] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotAlert, setForgotAlert] = useState<AlertState | null>(null)
  const [forgotDone, setForgotDone] = useState(false)

  const handleForgotSend = async () => {
    setForgotAlert(null)
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) { setForgotAlert({ msg: 'Email invalide', type: 'error' }); return }
    setForgotLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/master/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Erreur')
      setForgotStep(2)
      setForgotAlert({ msg: 'Code envoyé à ' + maskEmail(forgotEmail), type: 'success' })
    } catch (err: unknown) { setForgotAlert({ msg: err instanceof Error ? err.message : 'Erreur', type: 'error' }) }
    finally { setForgotLoading(false) }
  }

  const handleForgotConfirm = async () => {
    setForgotAlert(null)
    if (!forgotOtp.trim() || forgotOtp.trim().length < 6) { setForgotAlert({ msg: 'Code OTP requis (6 chiffres)', type: 'error' }); return }
    if (getPasswordStrength(forgotPwd) < 5) { setForgotAlert({ msg: 'Le mot de passe ne respecte pas toutes les règles de sécurité', type: 'error' }); return }
    if (forgotPwd !== forgotConfirm) { setForgotAlert({ msg: 'Les mots de passe ne correspondent pas', type: 'error' }); return }
    setForgotLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/master/auth/forgot-password/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase(), otp: forgotOtp.trim(), newPassword: forgotPwd }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Erreur')
      setForgotDone(true)
      setForgotAlert({ msg: 'Mot de passe réinitialisé — vous pouvez vous connecter', type: 'success' })
      setTimeout(() => { onResetSuccess(forgotEmail.trim().toLowerCase()) }, 1800)
    } catch (err: unknown) { setForgotAlert({ msg: err instanceof Error ? err.message : 'Erreur', type: 'error' }) }
    finally { setForgotLoading(false) }
  }

  return (
    <div onClick={() => !forgotLoading && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: 420, maxWidth: '100%', padding: 24, boxShadow: '0 12px 36px rgba(0,0,0,0.14)' }}>
        {forgotDone ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success)', marginBottom: 12 }}><CheckCircle2 size={38} /></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Mot de passe réinitialisé !</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18 }}>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</div>
            <button onClick={onClose} style={{ width: '100%', minHeight: 44, padding: '10px', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 14, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
          </div>
        ) : forgotStep === 1 ? (
          <>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Mot de passe oublié ?</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.4, marginBottom: 16 }}>Entrez votre email. Un code de vérification vous sera envoyé (valide 15 min).</div>
            {forgotAlert && <Alert a={forgotAlert} />}
            <Field label="Email Master">
              <input type="email" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setForgotAlert(null) }} onFocus={handleFocus} onBlur={handleBlur} placeholder="admin@zekoulabia.cm" style={inputBaseStyle} />
            </Field>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={onClose} style={{ flex: 1, minHeight: 44, padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 14, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={handleForgotSend} disabled={forgotLoading} style={{ flex: 1, minHeight: 44, padding: '10px', background: forgotLoading ? 'var(--text3)' : 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 14, border: 'none', borderRadius: 10, cursor: forgotLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: forgotLoading ? 0.7 : 1 }}>{forgotLoading ? 'Envoi…' : 'Envoyer le code →'}</button>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setForgotStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14, padding: 0 }}><ArrowLeft size={16} /> Retour</button>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Réinitialiser le mot de passe</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Code envoyé à <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{maskEmail(forgotEmail)}</span></div>
            {forgotAlert && <Alert a={forgotAlert} />}
            <Field label="Code OTP (6 chiffres)">
              <input type="tel" maxLength={6} value={forgotOtp} onChange={e => { setForgotOtp(e.target.value.replace(/\D/g, '')); setForgotAlert(null) }} onFocus={handleFocus} onBlur={handleBlur} placeholder="123456" style={{ ...inputBaseStyle, textAlign: 'center', letterSpacing: 4, fontSize: 20, fontWeight: 900 }} />
            </Field>
            <Field label="Nouveau mot de passe">
              <div style={{ position: 'relative' }}>
                <input type={showForgotPwd ? 'text' : 'password'} value={forgotPwd} onChange={e => { setForgotPwd(e.target.value); setForgotAlert(null) }} onFocus={handleFocus} onBlur={handleBlur} placeholder="••••••••••••" style={{ ...inputBaseStyle, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowForgotPwd(s => !s)} aria-label={showForgotPwd ? "Masquer" : "Afficher"} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{showForgotPwd ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {forgotPwd && <PasswordStrengthBar password={forgotPwd} />}
            </Field>
            <Field label="Confirmer le mot de passe">
              <input type={showForgotPwd ? 'text' : 'password'} value={forgotConfirm} onChange={e => { setForgotConfirm(e.target.value); setForgotAlert(null) }} onFocus={handleFocus} onBlur={handleBlur} placeholder="••••••••••••" style={inputBaseStyle} />
            </Field>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={onClose} style={{ flex: 1, minHeight: 44, padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 14, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={handleForgotConfirm} disabled={forgotLoading} style={{ flex: 1, minHeight: 44, padding: '10px', background: forgotLoading ? 'var(--text3)' : 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 14, border: 'none', borderRadius: 10, cursor: forgotLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: forgotLoading ? 0.7 : 1 }}>{forgotLoading ? '…' : 'Réinitialiser →'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
