'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, KeyRound } from 'lucide-react'

interface InviteData {
  email: string
  firstName: string
  lastName: string
  schoolName: string
  subdomain: string
}

function SetPasswordContent() {
  const params      = useSearchParams()
  const router      = useRouter()
  const token       = params.get('token') ?? ''

  const [invite,     setInvite]     = useState<InviteData | null>(null)
  const [status,     setStatus]     = useState<'loading' | 'ready' | 'invalid' | 'success'>('loading')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [showConf,   setShowConf]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr,  setSubmitErr]  = useState('')

  useEffect(() => {
    if (!token) { setStatus('invalid'); setErrorMsg('Lien invalide.'); return }
    fetch(`/api/v2/users/auth/invite/validate?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setInvite(data.data)
          setStatus('ready')
        } else {
          setStatus('invalid')
          setErrorMsg(data.message ?? 'Lien invalide ou expiré.')
        }
      })
      .catch(() => { setStatus('invalid'); setErrorMsg('Erreur réseau. Réessayez.') })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitErr('')
    if (password.length < 8) { setSubmitErr('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (password !== confirm) { setSubmitErr('Les mots de passe ne correspondent pas.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/v2/users/auth/invite/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword: confirm }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus('success')
      } else {
        setSubmitErr(data.message ?? 'Erreur inconnue.')
      }
    } catch {
      setSubmitErr('Erreur réseau. Réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Chargement ──
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f3ed' }}>
        <Loader2 size={36} style={{ color: 'var(--green)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Lien invalide ──
  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f3ed', padding: 24 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '48px 40px', maxWidth: 440, width: '100%', textAlign: 'center', border: '1.5px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <XCircle size={52} style={{ color: 'var(--red)', marginBottom: 16 }} />
          <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: 22, margin: '0 0 12px' }}>Lien invalide</h2>
          <p style={{ color: 'var(--text2)', fontSize: 15, margin: 0 }}>{errorMsg}</p>
          <p style={{ color: 'var(--text3)', fontSize: 14, marginTop: 16 }}>Contactez votre administrateur pour obtenir un nouveau lien.</p>
        </div>
      </div>
    )
  }

  // ── Succès ──
  if (status === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f3ed', padding: 24 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '48px 40px', maxWidth: 440, width: '100%', textAlign: 'center', border: '1.5px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <CheckCircle size={52} style={{ color: 'var(--green)', marginBottom: 16 }} />
          <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: 22, margin: '0 0 12px' }}>Mot de passe créé !</h2>
          <p style={{ color: 'var(--text2)', fontSize: 15, margin: '0 0 28px' }}>
            Votre compte est prêt. Connectez-vous avec votre email et votre nouveau mot de passe.
          </p>
          <button
            onClick={() => router.push('/login')}
            style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, fontWeight: 800, cursor: 'pointer', width: '100%' }}
          >
            Aller à la connexion →
          </button>
        </div>
      </div>
    )
  }

  // ── Formulaire ──
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f3ed', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '40px', maxWidth: 440, width: '100%', border: '1.5px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,var(--primary),var(--primary-hover))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", overflow: "hidden" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "65%", height: "65%", objectFit: "contain" }} /></div>
          <h1 style={{ color: 'var(--text)', fontWeight: 800, fontSize: 22, margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>ZekoulABia</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14, margin: 0 }}>{invite?.schoolName}</p>
        </div>

        <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18, margin: '0 0 6px' }}>
          Bonjour {invite?.firstName} {invite?.lastName},
        </h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
          Créez votre mot de passe pour accéder à votre espace sur ZekoulABia.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Email (lecture seule) */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={invite?.email ?? ''}
              readOnly
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 15, color: 'var(--text3)', background: '#f7f3ed', boxSizing: 'border-box' }}
            />
          </div>

          {/* Mot de passe */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
              Mot de passe <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Au moins 8 caractères"
                required
                style={{ width: '100%', padding: '10px 44px 10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 15, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box', outline: 'none' }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmer */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
              Confirmer le mot de passe <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConf ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Répétez votre mot de passe"
                required
                style={{ width: '100%', padding: '10px 44px 10px 14px', borderRadius: 10, border: `1.5px solid ${confirm && confirm !== password ? 'var(--red)' : 'var(--border)'}`, fontSize: 15, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box', outline: 'none' }}
              />
              <button type="button" onClick={() => setShowConf(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>
                {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirm && confirm !== password && (
              <p style={{ color: 'var(--red)', fontSize: 12, margin: '4px 0 0', fontWeight: 600 }}>Les mots de passe ne correspondent pas</p>
            )}
          </div>

          {submitErr && (
            <div style={{ background: 'var(--red-light)', border: '1.5px solid var(--red-light)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--red)', fontSize: 14, fontWeight: 600 }}>
              {submitErr}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: submitting ? 'var(--green-light)' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {submitting ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Création...</> : <><KeyRound size={16} strokeWidth={2} /> Créer mon mot de passe</>}
          </button>
        </form>

        <p style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
          ZekoulABia · Plateforme de gestion scolaire · Cameroun
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f3ed' }}>
        <Loader2 size={36} style={{ color: 'var(--green)' }} />
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  )
}
