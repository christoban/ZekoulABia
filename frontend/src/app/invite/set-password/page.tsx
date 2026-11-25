'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, KeyRound } from 'lucide-react'
import LanguageSwitch from '@/components/LanguageSwitch'

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

      {/* Carte principale */}
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

        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
            <Loader2 size={36} style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13, color: 'var(--text3)', marginTop: 12, fontWeight: 600 }}>Validation de l'invitation…</span>
          </div>
        )}

        {status === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <XCircle size={48} style={{ color: 'var(--red)', marginBottom: 14 }} />
            <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: 20, margin: '0 0 8px', fontFamily: 'var(--font-spectral),Spectral,serif' }}>Lien invalide</h2>
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: '0 0 12px', lineHeight: 1.5 }}>{errorMsg}</p>
            <p style={{ color: 'var(--text3)', fontSize: 13, margin: 0 }}>Contactez votre administrateur pour obtenir un nouveau lien.</p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: 14 }} />
            <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: 20, margin: '0 0 8px', fontFamily: 'var(--font-spectral),Spectral,serif' }}>Mot de passe créé !</h2>
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
              Votre compte est prêt. Connectez-vous avec votre email et votre nouveau mot de passe.
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 10, minHeight: 48, padding: '12px 24px', fontSize: 15, fontWeight: 800, cursor: 'pointer', width: '100%', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
            >
              Aller à la connexion →
            </button>
          </div>
        )}

        {status === 'ready' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, margin: '0 0 4px', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
                Création de mot de passe
              </h1>
              <p style={{ color: 'var(--text3)', fontSize: 13, margin: 0, fontWeight: 600 }}>{invite?.schoolName}</p>
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
              <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                Bonjour {invite?.firstName} {invite?.lastName},
              </div>
              <div style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.4 }}>
                Créez votre mot de passe pour accéder à votre espace ZekoulABia.
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={invite?.email ?? ''}
                  readOnly
                  style={{ width: '100%', minHeight: 48, padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 16, color: 'var(--text3)', background: 'var(--bg2)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Mot de passe <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={handleFocus} onBlur={handleBlur}
                    placeholder="Au moins 8 caractères"
                    required
                    style={{ width: '100%', minHeight: 48, padding: '12px 44px 12px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 16, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "Masquer" : "Afficher"}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6, minWidth: 44, minHeight: 44 }}>
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Confirmer le mot de passe <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConf ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onFocus={handleFocus} onBlur={handleBlur}
                    placeholder="Répétez votre mot de passe"
                    required
                    style={{ width: '100%', minHeight: 48, padding: '12px 44px 12px 14px', borderRadius: 10, border: `1.5px solid ${confirm && confirm !== password ? 'var(--red)' : 'var(--border)'}`, fontSize: 16, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowConf(v => !v)} aria-label={showConf ? "Masquer" : "Afficher"}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6, minWidth: 44, minHeight: 44 }}>
                    {showConf ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirm && confirm !== password && (
                  <p style={{ color: 'var(--red)', fontSize: 12, margin: '6px 0 0', fontWeight: 600 }}>Les mots de passe ne correspondent pas</p>
                )}
              </div>

              {submitErr && (
                <div style={{ background: 'var(--red-light)', border: '1px solid rgba(217,72,31,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>
                  {submitErr}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{ width: '100%', minHeight: 48, padding: '12px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: submitting ? 'var(--text3)' : 'var(--primary)', color: 'white', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}
                onMouseEnter={e => !submitting && (e.currentTarget.style.background = 'var(--primary-hover)')}
                onMouseLeave={e => !submitting && (e.currentTarget.style.background = 'var(--primary)')}
              >
                {submitting ? <><Loader2 size={18} className="animate-spin" /> Création...</> : <><KeyRound size={18} strokeWidth={2} /> Créer mon mot de passe</>}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={36} style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  )
}
