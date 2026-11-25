'use client'

/**
 * Page publique tuteur — Plan v2 §8 / §9 : le lien SMS
 * `{TRANSFER_CONSENT_BASE_URL}/student-transfers/consent/{requestId}?token={token}`
 * pointe ici. Sans authentification : challenge décrit via /consent/status (ne consomme
 * rien), décision via /consent (OTP 6 chiffres), révocation via /revoke tant que le
 * transfert n'est pas terminé. Aucune donnée sensible n'est affichée au-delà de l'état.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { CSSProperties } from 'react'
import { useT } from '@/lib/i18n'
import LanguageSwitch from '@/components/LanguageSwitch'
import { ShieldCheck, Loader2, Lock } from 'lucide-react'
import type { ConsentChallengeState } from '@/features/studentTransfer/transferApi'
import { etatConsentement, consentir, revoquer } from '@/features/studentTransfer/transferApi'

const CATS = ['IDENTITY', 'LOCKED_GRADES', 'VALIDATED_REPORT_CARDS', 'ATTENDANCE_SUMMARY', 'ORIENTATION_DECISIONS', 'GUARDIAN_CONTACT'] as const

export default function ConsentementTransfertPage() {
  const t = useT('studentTransfer')
  const params = useParams()
  const requestId = typeof params?.requestId === 'string' ? params.requestId : ''

  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [etat, setEtat] = useState<ConsentChallengeState | null>(null)
  const [expiresAt, setExpiresAt] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState<'ACCEPT' | 'REFUSE' | 'REVOKE' | null>(null)
  const [notice, setNotice] = useState('')
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async (): Promise<void> => {
    const tok = new URLSearchParams(window.location.search).get('token') ?? ''
    setToken(tok)
    if (!tok) { setErreur(t('tuteur.champs_manquants')); setLoading(false); return }
    if (!requestId) { setErreur(t('tuteur.lien_invalide')); setLoading(false); return }
    try {
      const r = await etatConsentement({ requestId, token: tok })
      if (!r) { setErreur(t('tuteur.lien_invalide')) } else { setEtat(r.status); setExpiresAt(r.expiresAt) }
    } catch { setErreur(t('tuteur.erreur_generique')) }
    setLoading(false)
  }, [requestId, t])

  useEffect(() => { void charger() }, [charger])

  const envoyer = async (decision: 'ACCEPT' | 'REFUSE') => {
    setBusy(decision); setErreur(''); setNotice('')
    try {
      await consentir({ requestId, token, otp: otp.trim(), decision })
      setEtat('DECIDED'); setNotice(t('tuteur.consentir_ok'))
    } catch (e) {
      const msg = String((e as Error).message || '')
      setErreur(/otp|code/i.test(msg) ? t('tuteur.otp_invalide') : /lien/i.test(msg) ? t('tuteur.lien_invalide') : msg || t('tuteur.erreur_generique'))
    } finally { setBusy(null) }
  }

  const retirer = async () => {
    setBusy('REVOKE'); setErreur(''); setNotice('')
    try {
      await revoquer({ requestId, token })
      setEtat('REVOKED'); setNotice(t('tuteur.revoquer_ok'))
    } catch { setErreur(t('tuteur.revoquer_erreur')) }
    finally { setBusy(null) }
  }

  const card: CSSProperties = {
    maxWidth: 560, width: 'calc(100% - 32px)', background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, padding: '28px 24px', boxShadow: '0 10px 40px rgba(58,36,25,0.10)', textAlign: 'left',
  }
  const input: CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg)', color: 'var(--text)', fontSize: 16, fontFamily: 'monospace', letterSpacing: 4, boxSizing: 'border-box',
  }
  const btn: CSSProperties = {
    padding: '12px 16px', borderRadius: 9, border: 'none', background: 'var(--primary, #2563eb)',
    color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', width: '100%',
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', position: 'relative', paddingTop: 70, paddingBottom: 40, fontFamily: 'var(--font-nunito), Nunito, sans-serif' }}>
      <div className="login-bg" />
      <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, zIndex: 10 }} />

      <header style={{ position: 'absolute', top: 5, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,var(--primary),var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(180,83,42,0.22)', overflow: 'hidden' }}>
            <img src="/logo.svg" alt="ZekoulABia" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>ZekoulABia</span>
        </div>
        <LanguageSwitch compact />
      </header>

      <main style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ShieldCheck size={18} color="var(--primary, #2563eb)" />
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{t('tuteur.titre')}</h1>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--text3)' }}>{t('tuteur.revoquer_texte')}</p>

          {loading && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)' }}><Loader2 className="animate-spin" size={20} /></div>}

          {!loading && erreur && (
            <div style={{ fontSize: 13, color: 'var(--red, #dc2626)', fontWeight: 600, padding: '8px 0' }}>{erreur}</div>
          )}
          {!loading && notice && (
            <div style={{ fontSize: 13, color: 'var(--green, #16a34a)', fontWeight: 600, padding: '8px 0' }}>{notice}</div>
          )}

          {!loading && token && etat && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {expiresAt && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('tuteur.expiration_dans', { date: new Date(expiresAt).toLocaleString() })}</div>}

              {etat === 'PENDING' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('categories.titre')}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{t('tuteur.categories_intro')} :</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.7 }}>
                    {CATS.map(cat => (
                      <li key={cat}>{t(`categories.${cat}`)}</li>
                    ))}
                  </ul>

                  <div style={{ marginTop: 6 }}>
                    <label htmlFor="otp-transfert" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                      <Lock size={12} style={{ verticalAlign: -1 }} /> {t('tuteur.otp_label')}
                    </label>
                    <input
                      id="otp-transfert"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder={t('tuteur.otp_placeholder')}
                      style={input}
                    />
                  </div>

                  <button onClick={() => { void envoyer('ACCEPT') }} disabled={busy !== null || otp.length !== 6} style={{ ...btn, background: 'var(--green, #16a34a)', marginTop: 4 }}>
                    {busy === 'ACCEPT' ? <Loader2 className="animate-spin" size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> : null}
                    {t('tuteur.accepter_bouton')}
                  </button>
                  <button onClick={() => { void envoyer('REFUSE') }} disabled={busy !== null || otp.length !== 6} style={{ ...btn, background: 'var(--red, #dc2626)' }}>
                    {t('tuteur.refuser_bouton')}
                  </button>

                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10, fontSize: 12, color: 'var(--text2)' }}>
                    {t('tuteur.revoquer_texte')}
                    <button onClick={() => { void retirer() }} disabled={busy !== null} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red, #dc2626)', fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', marginTop: 8, width: '100%' }}>
                      {busy === 'REVOKE' ? <Loader2 className="animate-spin" size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> : null}
                      {t('tuteur.revoquer_bouton')}
                    </button>
                  </div>
                </>
              )}

              {etat !== 'PENDING' && (
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', padding: '6px 0' }}>{t(`tuteur.statut.${etat}`)}</div>
              )}
              {etat === 'DECIDED' && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t('tuteur.revoquer_texte')}</div>
                  <button onClick={() => { void retirer() }} disabled={busy !== null} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red, #dc2626)', fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 8, cursor: busy ? 'wait' : 'pointer' }}>
                    {t('tuteur.revoquer_bouton')}
                  </button>
                </>
              )}
              {etat === 'PENDING' && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('tuteur.statut.PENDING')}</div>}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
