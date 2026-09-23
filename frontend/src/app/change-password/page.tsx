'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordStrengthBar, { getPasswordStrength } from '@/components/PasswordStrengthBar'
import { Eye, EyeOff, KeyRound, AlertTriangle } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = getPasswordStrength(newPassword)
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (strength < 5) {
      setError('Le nouveau mot de passe ne respecte pas les règles de sécurité.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/v2/users/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message ?? 'Impossible de modifier le mot de passe.')
        return
      }
      const stored = localStorage.getItem('zekoulabia_user')
      const user = stored ? JSON.parse(stored) as { role?: string } : {}
      const destinations: Record<string, string> = {
        ADMIN: '/admin/dashboard',
        STAFF: '/staff/dashboard',
        TEACHER: '/teacher/dashboard',
        PARENT: '/parent/dashboard',
        STUDENT: '/student/dashboard',
      }
      router.replace(destinations[user.role ?? ''] ?? '/')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,var(--bg2) 0%,#e8f5f0 100%)', padding: 24 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', padding: '36px 40px', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--green-light, rgba(16,185,129,0.12))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', marginBottom: 12 }}>
            <KeyRound size={26} strokeWidth={2.2} />
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 6, fontSize: 24, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-spectral,Spectral,serif)' }}>Changement de mot de passe</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14, lineHeight: 1.5 }}>Votre mot de passe temporaire doit être remplacé avant de pouvoir continuer.</p>
        </div>

        {/* Mot de passe temporaire */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Mot de passe temporaire *</label>
          <div style={{ position: 'relative' }}>
            <input
              required
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              placeholder="••••••••••••"
              style={{ ...inputStyle, paddingRight: 44 }}
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowCurrent(s => !s)} style={eyeStyle} tabIndex={-1} aria-label={showCurrent ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {showCurrent ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
            </button>
          </div>
        </div>

        {/* Nouveau mot de passe */}
        <div style={{ marginBottom: 6 }}>
          <label style={labelStyle}>Nouveau mot de passe *</label>
          <div style={{ position: 'relative' }}>
            <input
              required
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              placeholder="••••••••••••"
              style={{ ...inputStyle, paddingRight: 44 }}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowNew(s => !s)} style={eyeStyle} tabIndex={-1} aria-label={showNew ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {showNew ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
            </button>
          </div>
          {newPassword && <PasswordStrengthBar password={newPassword} />}
        </div>

        {/* Confirmer le nouveau mot de passe */}
        <div style={{ marginTop: 18, marginBottom: 20 }}>
          <label style={labelStyle}>Confirmer le nouveau mot de passe *</label>
          <div style={{ position: 'relative' }}>
            <input
              required
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              placeholder="••••••••••••"
              style={{ ...inputStyle, paddingRight: 44, borderColor: mismatch ? 'var(--red)' : 'var(--border2)' }}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowConfirm(s => !s)} style={eyeStyle} tabIndex={-1} aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {showConfirm ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
            </button>
          </div>
          {mismatch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>
              <AlertTriangle size={13} strokeWidth={2} /> Les mots de passe ne correspondent pas.
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: 'var(--red-light, rgba(239,68,68,0.1))', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, marginBottom: 18 }}>
            {error}
          </div>
        )}

        <button disabled={loading || (newPassword.length > 0 && strength < 5) || mismatch} type="submit" style={{ ...buttonStyle, opacity: (loading || (newPassword.length > 0 && strength < 5) || mismatch) ? 0.6 : 1, cursor: (loading || (newPassword.length > 0 && strength < 5) || mismatch) ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Modification en cours...' : 'Modifier le mot de passe'}
        </button>
      </form>
    </main>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border2)', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', outline: 'none' }
const eyeStyle: React.CSSProperties = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', padding: 0 }
const buttonStyle: React.CSSProperties = { width: '100%', padding: '14px 16px', border: 0, borderRadius: 12, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', fontWeight: 800, fontSize: 15, transition: 'all 0.2s' }