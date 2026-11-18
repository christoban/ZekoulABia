'use client'

import { useState } from 'react'
import { CheckCircle2, KeyRound, AlertTriangle } from 'lucide-react'
import { resetUserMfa } from '../../_api'

/**
 * Débloque un compte Admin/Staff/Teacher ayant perdu son authenticator ET ses codes de
 * récupération — geste sensible, gardé par mot de passe + MFA Master (requireMasterSensitiveAuth).
 */
export default function LogsMfaResetPanel() {
  const [subdomain, setSubdomain] = useState('')
  const [targetEmail, setTargetEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)',
    borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
    outline: 'none', boxSizing: 'border-box',
  }
  const btnRed: React.CSSProperties = {
    padding: '11px 22px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 10,
    fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  }

  const submit = async () => {
    setError(''); setDone(false)
    if (!subdomain.trim() || !targetEmail.trim() || !password.trim()) {
      setError('Sous-domaine, email du compte et votre mot de passe sont requis'); return
    }
    setLoading(true)
    try {
      await resetUserMfa(subdomain.trim().toLowerCase(), targetEmail.trim().toLowerCase(), password, totpCode)
      setDone(true)
      setPassword(''); setTotpCode('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la réinitialisation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border2)', overflow: 'hidden', marginTop: 24 }}>
      <div style={{ padding: '16px 22px', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <KeyRound size={22} color="#dc2626" />
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Débloquer le MFA d&apos;un compte</span>
      </div>
      <div style={{ padding: '16px 22px' }}>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
          À utiliser uniquement si un Admin/Staff/Enseignant a perdu l&apos;accès à son application d&apos;authentification
          ET à ses codes de récupération. Le compte devra reconfigurer entièrement son MFA (nouveau QR) à sa prochaine connexion.
        </p>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--red)', fontWeight: 600, marginBottom: 12 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--green-light)', border: '1px solid rgba(142,42,58,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 12 }}>
            <CheckCircle2 size={16} /> MFA réinitialisé — le compte devra le reconfigurer à sa prochaine connexion.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input placeholder="Sous-domaine de l'école" value={subdomain} onChange={e => setSubdomain(e.target.value)} style={inp} />
          <input placeholder="Email du compte bloqué" value={targetEmail} onChange={e => setTargetEmail(e.target.value)} style={inp} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <input type="password" placeholder="Votre mot de passe Master" value={password} onChange={e => setPassword(e.target.value)} style={inp} />
          <input placeholder="Votre code MFA (si activé)" value={totpCode} onChange={e => setTotpCode(e.target.value)} style={inp} />
        </div>
        <button type="button" onClick={submit} disabled={loading} style={{ ...btnRed, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Réinitialisation…' : 'Réinitialiser le MFA de ce compte'}
        </button>
      </div>
    </div>
  )
}
