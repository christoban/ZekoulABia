'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, ShieldOff, KeyRound, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

const API_BASE = ''

export default function GroupMfaSettings() {
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [setupData, setSetupData] = useState<{ qrDataUri: string; manualKey: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/auth/mfa-status`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Impossible de charger le statut 2FA')
      setMfaEnabled(Boolean(data.data?.mfaEnabled))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement statut 2FA')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleStartSetup = async () => {
    setBusy(true)
    setError(null)
    setInfo(null)
    setRecoveryCodes(null)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/auth/mfa/setup`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Erreur initialisation 2FA')
      setSetupData({ qrDataUri: data.data.qrDataUri, manualKey: data.data.manualKey })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur configuration 2FA')
    } finally {
      setBusy(false)
    }
  }

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!totpCode.trim()) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/auth/mfa/enable`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode: totpCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Code TOTP invalide')
      setMfaEnabled(true)
      setSetupData(null)
      setTotpCode('')
      setRecoveryCodes(data.data?.recoveryCodes ?? null)
      setInfo('Double authentification activée. Conservez vos codes de secours en lieu sûr.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur activation 2FA')
    } finally {
      setBusy(false)
    }
  }

  const handleRegenCodes = async () => {
    if (!confirm('Régénérer de nouveaux codes de secours invalidera les anciens. Continuer ?')) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/auth/mfa/regen-codes`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Erreur régénération')
      setRecoveryCodes(data.data?.recoveryCodes ?? null)
      setInfo('Nouveaux codes de secours générés.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur régénération')
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async () => {
    if (!confirm('Voulez-vous vraiment désactiver la double authentification sur ce compte ?')) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/auth/mfa/disable`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Erreur désactivation')
      setMfaEnabled(false)
      setRecoveryCodes(null)
      setSetupData(null)
      setInfo('Double authentification désactivée.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur désactivation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5decf', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {mfaEnabled ? <ShieldCheck size={22} color="#16a34a" /> : <ShieldOff size={22} color="#b45309" />}
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1a1209' }}>Double authentification (2FA / TOTP)</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b5c45' }}>
              Protégez l&apos;accès propriétaire du groupe scolaire avec une application Authenticator.
            </p>
          </div>
        </div>
        {!loading && mfaEnabled !== null && (
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: mfaEnabled ? '#dcfce7' : '#fef3c7', color: mfaEnabled ? '#166534' : '#92400e' }}>
            {mfaEnabled ? '2FA activée' : '2FA non configurée'}
          </span>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {info && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> {info}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 8, color: '#6b5c45', fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Chargement du statut…
        </div>
      ) : mfaEnabled ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="button" onClick={handleRegenCodes} disabled={busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: '1.5px solid #d4c8b8', background: 'white', color: '#1a1209', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={15} /> Régénérer les codes de secours
          </button>
          <button type="button" onClick={handleDisable} disabled={busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <ShieldOff size={15} /> Désactiver le MFA
          </button>
        </div>
      ) : setupData ? (
        <form onSubmit={handleEnable} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: 16, background: '#faf8f4', borderRadius: 12, border: '1px solid #e5decf' }}>
            <img src={setupData.qrDataUri} alt="QR Code TOTP" style={{ width: 170, height: 170, margin: '0 auto 10px', display: 'block', borderRadius: 8 }} />
            <div style={{ fontSize: 11, color: '#6b5c45', fontWeight: 700, marginBottom: 4 }}>Clé manuelle</div>
            <code style={{ fontSize: 12, background: 'white', padding: '4px 8px', borderRadius: 6, border: '1px solid #e5decf', wordBreak: 'break-all' }}>{setupData.manualKey}</code>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>
              Entrez le code à 6 chiffres généré par votre application :
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="123456"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #d4c8b8', fontSize: 16, fontWeight: 700, letterSpacing: '0.15em', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy || totpCode.trim().length < 6}
                style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Vérification…' : 'Activer le MFA'}
              </button>
              <button type="button" onClick={() => { setSetupData(null); setTotpCode('') }}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #d4c8b8', background: 'white', color: '#6b5c45', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button type="button" onClick={handleStartSetup} disabled={busy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
          <KeyRound size={16} /> Configurer la double authentification (TOTP)
        </button>
      )}

      {recoveryCodes && recoveryCodes.length > 0 && (
        <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e', marginBottom: 8 }}>
            Codes de secours à usage unique — Copiez-les maintenant :
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {recoveryCodes.map((code) => (
              <code key={code} style={{ padding: '6px 10px', borderRadius: 6, background: 'white', border: '1px solid #fde68a', fontSize: 12.5, fontWeight: 700, textAlign: 'center', color: '#1a1209' }}>
                {code}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

