'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordStrengthBar, { getPasswordStrength } from '@/components/PasswordStrengthBar'
import { Eye, EyeOff, KeyRound, AlertTriangle } from 'lucide-react'
import LanguageSwitch from '@/components/LanguageSwitch'

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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px rgba(227, 176, 75, 0.2)'
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

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
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      position: 'relative',
      overflowX: 'hidden',
      paddingTop: 80,
      paddingBottom: 40,
      fontFamily: 'var(--font-nunito), Nunito, sans-serif'
    }}>
      {/* Motif géométrique discret */}
      <div className="login-bg" />

      {/* Bande multicolore camerounaise */}
      <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />

      {/* En-tête commun */}
      <header style={{
        position: 'absolute', top: 5, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg,var(--primary),var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(180,83,42,0.22)', overflow: 'hidden'
          }}>
            <img src="/logo.svg" alt="ZekoulABia" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              ZekoulABia
            </span>
          </div>
        </div>
        <LanguageSwitch compact />
      </header>

      {/* Carte formulaire */}
      <main style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 440,
        width: 'calc(100% - 32px)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)',
      }}>
        <form onSubmit={submit}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--primary-light)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <KeyRound size={26} strokeWidth={2} />
            </div>
            <h1 style={{ marginTop: 0, marginBottom: 6, fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
              Changement de mot de passe
            </h1>
            <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>
              Votre mot de passe temporaire doit être remplacé avant de pouvoir continuer.
            </p>
          </div>

          {/* Mot de passe temporaire */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Mot de passe temporaire *</label>
            <div style={{ position: 'relative' }}>
              <input
                required
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                onFocus={handleFocus} onBlur={handleBlur}
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
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Nouveau mot de passe *</label>
            <div style={{ position: 'relative' }}>
              <input
                required
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                onFocus={handleFocus} onBlur={handleBlur}
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
          <div style={{ marginTop: 16, marginBottom: 20 }}>
            <label style={labelStyle}>Confirmer le nouveau mot de passe *</label>
            <div style={{ position: 'relative' }}>
              <input
                required
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                onFocus={handleFocus} onBlur={handleBlur}
                placeholder="••••••••••••"
                style={{ ...inputStyle, paddingRight: 44, borderColor: mismatch ? 'var(--red)' : 'var(--border)' }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirm(s => !s)} style={eyeStyle} tabIndex={-1} aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                {showConfirm ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </div>
            {mismatch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--red)', marginTop: 6, fontWeight: 600 }}>
                <AlertTriangle size={14} strokeWidth={2} /> Les mots de passe ne correspondent pas.
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
              {error}
            </div>
          )}

          <button disabled={loading || (newPassword.length > 0 && strength < 5) || mismatch} type="submit"
            style={{
              width: '100%', minHeight: 48, padding: '12px 16px', border: 0, borderRadius: 10,
              background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 15, transition: 'background 0.2s',
              opacity: (loading || (newPassword.length > 0 && strength < 5) || mismatch) ? 0.6 : 1,
              cursor: (loading || (newPassword.length > 0 && strength < 5) || mismatch) ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={e => (!loading && strength >= 5 && !mismatch) && (e.currentTarget.style.background = 'var(--primary-hover)')}
            onMouseLeave={e => (!loading && strength >= 5 && !mismatch) && (e.currentTarget.style.background = 'var(--primary)')}
          >
            {loading ? 'Modification en cours...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </main>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }
const inputStyle: React.CSSProperties = { width: '100%', minHeight: 48, boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s' }
const eyeStyle: React.CSSProperties = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', padding: 6, minWidth: 44, minHeight: 44 }