'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PasswordStrengthBar, { getPasswordStrength } from '@/components/PasswordStrengthBar'
import { CheckCircle2, EyeOff, Eye, AlertTriangle, Loader2, KeyRound } from 'lucide-react'

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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,var(--bg2) 0%,#e8f5f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '40px 44px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
        {/* Logo / en-tête */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 8 }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: 48, height: 48 }} /></div>
          <div style={{ fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>ZekoulABia</div>
          <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>Réinitialisation du mot de passe</div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green)', marginBottom: 16 }}><CheckCircle2 size={56} strokeWidth={2} /></div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginBottom: 8 }}>Mot de passe réinitialisé !</div>
            <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6 }}>Vous allez être redirigé vers la page de connexion…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Nouveau mot de passe */}
            <div style={{ marginBottom: 6 }}>
              <label style={labelSt}>Nouveau mot de passe *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={!token}
                  style={{ ...inputSt, paddingRight: 44 }}
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" onClick={() => setShowNew(s => !s)} style={eyeSt}>
                  {showNew ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                </button>
              </div>
              {newPwd && <PasswordStrengthBar password={newPwd} />}
            </div>

            {/* Confirmation */}
            <div style={{ marginTop: 16, marginBottom: 24 }}>
              <label style={labelSt}>Confirmer le mot de passe *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={!token}
                  style={{ ...inputSt, paddingRight: 44, borderColor: mismatch ? 'var(--red)' : 'var(--border2)' }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)} style={eyeSt}>
                  {showConfirm ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                </button>
              </div>
              {mismatch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>
                  <AlertTriangle size={13} strokeWidth={2} /> Les mots de passe ne correspondent pas.
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, marginBottom: 20, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token || strength < 5 || mismatch}
              style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: (loading || !token || strength < 5 || mismatch) ? 'var(--text3)' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: (loading || !token || strength < 5 || mismatch) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Réinitialisation…</> : <><KeyRound size={16} strokeWidth={2} /> Réinitialiser mon mot de passe</>}
            </button>

            <div style={{ textAlign: 'center' }}>
              <a href={`/login${subdomain ? `?subdomain=${subdomain}` : ''}`}
                style={{ fontSize: 14, color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>
                ← Retour à la connexion
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

const labelSt: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }
const inputSt: React.CSSProperties = { width: '100%', padding: '12px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const eyeSt: React.CSSProperties = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', padding: 0 }
