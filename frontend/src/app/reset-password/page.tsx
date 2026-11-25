'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PasswordStrengthBar, { getPasswordStrength } from '@/components/PasswordStrengthBar'
import { CheckCircle2, EyeOff, Eye, AlertTriangle, Loader2, KeyRound } from 'lucide-react'
import LanguageSwitch from '@/components/LanguageSwitch'

function ResetPasswordForm() {
  const params    = useSearchParams()
  const router    = useRouter()
  const token     = params.get('token') ?? ''
  const subdomain = params.get('subdomain') ?? ''

  const [newPwd,      setNewPwd]      = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)

  const strength = getPasswordStrength(newPwd)
  const mismatch = confirmPwd.length > 0 && confirmPwd !== newPwd

  useEffect(() => {
    if (!token) setError('Lien de réinitialisation invalide ou manquant.')
  }, [token])

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px rgba(227, 176, 75, 0.2)'
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) { setError('Lien invalide.'); return }
    if (!newPwd || !confirmPwd) { setError('Tous les champs sont requis.'); return }
    if (newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas.'); return }
    if (strength < 5) { setError('Le mot de passe ne respecte pas toutes les règles de sécurité.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/v2/users/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPwd, confirmPassword: confirmPwd }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Erreur lors de la réinitialisation.'); return }
      setSuccess(true)
      setTimeout(() => router.push(`/login${subdomain ? `?subdomain=${subdomain}` : ''}`), 2500)
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
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--primary-light)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <KeyRound size={26} strokeWidth={2} />
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 6, fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
            Réinitialisation du mot de passe
          </h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>
            Saisissez votre nouveau mot de passe pour sécuriser votre compte.
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success)', marginBottom: 16 }}><CheckCircle2 size={56} strokeWidth={2} /></div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', marginBottom: 8 }}>Mot de passe réinitialisé !</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>Vous allez être redirigé vers la page de connexion…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Nouveau mot de passe */}
            <div style={{ marginBottom: 8 }}>
              <label style={labelSt}>Nouveau mot de passe *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  onFocus={handleFocus} onBlur={handleBlur}
                  placeholder="••••••••••••"
                  disabled={!token}
                  style={{ ...inputSt, paddingRight: 44 }}
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" onClick={() => setShowNew(s => !s)} style={eyeSt} aria-label={showNew ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {showNew ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                </button>
              </div>
              {newPwd && <PasswordStrengthBar password={newPwd} />}
            </div>

            {/* Confirmation */}
            <div style={{ marginTop: 16, marginBottom: 20 }}>
              <label style={labelSt}>Confirmer le mot de passe *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  onFocus={handleFocus} onBlur={handleBlur}
                  placeholder="••••••••••••"
                  disabled={!token}
                  style={{ ...inputSt, paddingRight: 44, borderColor: mismatch ? 'var(--red)' : 'var(--border)' }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)} style={eyeSt} aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
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
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 18, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token || strength < 5 || mismatch}
              style={{
                width: '100%', minHeight: 48, padding: '12px', borderRadius: 10, fontSize: 15, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: (loading || !token || strength < 5 || mismatch) ? 'var(--text3)' : 'var(--primary)',
                color: 'white', border: 'none',
                cursor: (loading || !token || strength < 5 || mismatch) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', marginBottom: 16, transition: 'background 0.2s'
              }}
              onMouseEnter={e => (!loading && token && strength >= 5 && !mismatch) && (e.currentTarget.style.background = 'var(--primary-hover)')}
              onMouseLeave={e => (!loading && token && strength >= 5 && !mismatch) && (e.currentTarget.style.background = 'var(--primary)')}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Réinitialisation…</> : <><KeyRound size={18} strokeWidth={2} /> Réinitialiser mon mot de passe</>}
            </button>

            <div style={{ textAlign: 'center' }}>
              <a href={`/login${subdomain ? `?subdomain=${subdomain}` : ''}`}
                style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
                ← Retour à la connexion
              </a>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

const labelSt: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }
const inputSt: React.CSSProperties = { width: '100%', minHeight: 48, padding: '12px 14px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s' }
const eyeSt: React.CSSProperties = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', padding: 6, minWidth: 44, minHeight: 44 }
