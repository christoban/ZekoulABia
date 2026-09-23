'use client'

/**
 * Réglages de sécurité — double authentification (Admin/Staff/Teacher).
 * Volontairement pas de bouton "désactiver" : seule une reconfiguration guardée
 * (mot de passe + code actuel) est proposée, conformément à la décision produit
 * (le MFA reste obligatoire une fois activé, jamais désactivable depuis ici).
 */
import { useState, useEffect } from 'react'
import { Shield, ShieldCheck, KeyRound, Loader2, AlertTriangle, Copy, Check } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

type Mode = 'reconfigure' | 'regen'
type Step = 'idle' | 'sensitive_auth' | 'qr_confirm' | 'show_codes'

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px',
}
const btn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', border: '1.5px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)',
}
const btnPrimary: React.CSSProperties = {
  ...btn, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none',
}
const input: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
  background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  marginBottom: 8, boxSizing: 'border-box',
}

export default function MfaSettings() {
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [password, setPassword] = useState('')
  const [currentCode, setCurrentCode] = useState('')
  const [newTotp, setNewTotp] = useState('')
  const [qrDataUri, setQrDataUri] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchApi('/api/v2/users/mfa/status').then(r => r.json()).then(d => {
      if (d.success) setMfaEnabled(d.data.mfaEnabled)
    }).catch(() => {})
  }, [])

  const reset = () => {
    setMode(null); setStep('idle'); setPassword(''); setCurrentCode(''); setNewTotp('')
    setQrDataUri(''); setManualKey(''); setError(null)
  }

  const start = (m: Mode) => { reset(); setMode(m); setStep('sensitive_auth') }

  const submitSensitiveAuth = async () => {
    setError(null)
    if (!password.trim()) { setError('Mot de passe requis'); return }
    setLoading(true)
    try {
      if (mode === 'regen') {
        const res = await fetchApi('/api/v2/users/mfa/regen-codes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, code: currentCode }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message)
        setRecoveryCodes(data.data.recoveryCodes)
        setStep('show_codes')
      } else {
        const res = await fetchApi('/api/v2/users/mfa/reconfigure/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, code: currentCode }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message)
        setQrDataUri(data.data.qrDataUri)
        setManualKey(data.data.manualKey)
        setStep('qr_confirm')
      }
    } catch (e: any) {
      setError(e.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const confirmReconfigure = async () => {
    setError(null)
    if (newTotp.trim().length !== 6) { setError('Code à 6 chiffres requis'); return }
    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/users/mfa/reconfigure/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode: newTotp.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setRecoveryCodes(data.data.recoveryCodes)
      setStep('show_codes')
    } catch (e: any) {
      setError(e.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <ShieldCheck size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Double authentification</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.5 }}>
        {mfaEnabled === null ? 'Chargement…' : mfaEnabled
          ? 'Activée sur ce compte — obligatoire pour ce rôle, ne peut pas être désactivée.'
          : 'Non configurée. Reconnectez-vous pour finaliser la configuration obligatoire.'}
      </div>

      {step === 'idle' && mfaEnabled && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => start('reconfigure')}><Shield size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Reconfigurer</button>
          <button style={btn} onClick={() => start('regen')}><KeyRound size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Régénérer mes codes de récupération</button>
        </div>
      )}

      {step === 'sensitive_auth' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
            Confirmez votre identité pour continuer
          </div>
          {error && <Alert msg={error} />}
          <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={input} />
          <input type="text" placeholder="Code TOTP actuel (ou code de récupération)" value={currentCode} onChange={e => setCurrentCode(e.target.value)} style={input} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={reset}>Annuler</button>
            <button style={btnPrimary} onClick={submitSensitiveAuth} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : 'Continuer'}
            </button>
          </div>
        </div>
      )}

      {step === 'qr_confirm' && (
        <div>
          {error && <Alert msg={error} />}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            {qrDataUri && <img src={qrDataUri} alt="QR MFA" style={{ width: 140, height: 140, borderRadius: 8, border: '1px solid var(--border)', padding: 5, background: 'white' }} />}
          </div>
          {manualKey && (
            <div style={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'center', background: 'var(--bg2)', borderRadius: 6, padding: '6px 10px', marginBottom: 10, wordBreak: 'break-all' }}>{manualKey}</div>
          )}
          <input type="text" maxLength={6} placeholder="Nouveau code à 6 chiffres" value={newTotp} onChange={e => setNewTotp(e.target.value.replace(/\D/g, ''))} style={{ ...input, textAlign: 'center', fontSize: 18, fontWeight: 800, letterSpacing: 3 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={reset}>Annuler</button>
            <button style={btnPrimary} onClick={confirmReconfigure} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : 'Activer le nouveau secret'}
            </button>
          </div>
        </div>
      )}

      {step === 'show_codes' && (
        <div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.6 }}>
            Notez ces nouveaux codes de récupération — ils ne seront plus jamais affichés. Les anciens codes ne fonctionnent plus.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12, background: 'var(--bg2)', borderRadius: 10, padding: 14 }}>
            {recoveryCodes.map(code => (
              <div key={code} style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px', textAlign: 'center' }}>{code}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={() => { navigator.clipboard?.writeText(recoveryCodes.join('\n')); setCopied(true) }}>
              {copied ? <Check size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> : <Copy size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
              {copied ? 'Copié' : 'Copier'}
            </button>
            <button style={btnPrimary} onClick={reset}>Terminé</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Alert({ msg }: { msg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 12 }}>
      <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {msg}
    </div>
  )
}
