'use client'
import { useState, useEffect } from 'react'
import { Mail, ArrowLeft } from 'lucide-react'
import { inviteSchool, fetchMasterMfaStatus } from '../../_api'
import { Overlay, ModalWrap, ModalHeader, ModalFooter, Field, FieldInput, BtnPrimary } from './MasterModalPrimitives'

const PLAN_MAP: Record<string, string> = { deco: 'DISCOVERY', std: 'STANDARD', prem: 'PREMIUM' }

interface InviteSchoolModalProps {
  selectedPlan: 'deco' | 'std' | 'prem'
  onPlanChange: (p: 'deco' | 'std' | 'prem') => void
  loading: boolean
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onActionDone: () => void
}

export default function InviteSchoolModal({ selectedPlan, onPlanChange, loading, onClose, onToast, onActionDone }: InviteSchoolModalProps) {
  return (
    <Overlay onClose={onClose}>
      <ModalWrap>
        <ModalHeader title="Inviter un nouvel établissement" sub="Un lien d'activation valable 72h sera envoyé à l'administrateur" onClose={onClose} />
        <InviteForm
          selectedPlan={selectedPlan}
          onPlanChange={onPlanChange}
          loading={loading}
          onCancel={onClose}
          onDone={(msg) => { onToast(msg); onActionDone(); onClose() }}
          onError={(msg) => onToast(msg, 'error')}
        />
      </ModalWrap>
    </Overlay>
  )
}

function InviteForm({ selectedPlan, onPlanChange, loading, onCancel, onDone, onError }: {
  selectedPlan: 'deco' | 'std' | 'prem'
  onPlanChange: (p: 'deco' | 'std' | 'prem') => void
  loading: boolean
  onCancel: () => void
  onDone: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [step, setStep] = useState<'details' | 'confirm' | 'done'>('details')
  const [email, setEmail] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activationUrl, setActivationUrl] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  useEffect(() => {
    fetchMasterMfaStatus()
      .then(d => setMfaEnabled(d.mfaEnabled))
      .catch(() => setMfaEnabled(false))
  }, [])

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !schoolName) { onError('Email et nom de l\'école requis'); return }
    if (!email.includes('@')) { onError('Format email invalide'); return }
    setStep('confirm')
  }

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) { onError('Le mot de passe master est requis.'); return }
    if (mfaEnabled && !mfaCode.trim()) { onError('Le code MFA est requis.'); return }

    setSubmitting(true)
    try {
      const res = await inviteSchool({
        email,
        schoolName,
        plan: PLAN_MAP[selectedPlan],
        sensitiveAuth: { password: password.trim(), ...(mfaEnabled && { code: mfaCode.trim() }) },
      })
      if (res?.activationUrl) {
        setActivationUrl(res.activationUrl)
        setStep('done')
      } else {
        onDone(`Invitation envoyée à ${email}`)
      }
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Erreur lors de l\'invitation')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'done' && activationUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#065f46', marginBottom: 4 }}>
            Mode test actif — Invitation créée pour {schoolName}
          </div>
          <div style={{ fontSize: 12, color: '#047857' }}>
            Aucun email réel n’a été envoyé. Copiez directement le lien d’activation ci-dessous pour finaliser l’onboarding de l’école :
          </div>
          <div style={{ marginTop: 10, padding: '8px 10px', background: '#fff', border: '1px solid #a7f3d0', borderRadius: 8, fontSize: 11.5, fontFamily: 'monospace', wordBreak: 'break-all', color: '#1a1209' }}>
            {activationUrl}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(activationUrl)
                  setCopiedUrl(true)
                } catch { /* ignore */ }
              }}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#059669',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copiedUrl ? 'Lien copié !' : 'Copier le lien d’activation'}
            </button>
          </div>
        </div>
        <ModalFooter>
          <BtnPrimary onClick={() => onDone(`Invitation créée pour ${schoolName}`)}>
            Terminer
          </BtnPrimary>
        </ModalFooter>
      </div>
    )
  }

  if (step === 'details') {
    return (
      <form onSubmit={handleDetailsSubmit}>
        <Field label="Email de l'administrateur *" hint="L'administrateur recevra le lien d'invitation">
          <FieldInput type="email" placeholder="directeur@lyceedebafia.cm" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label="Nom de l'établissement *">
          <FieldInput placeholder="Lycée de Bafia" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
        </Field>
        <Field label="Plan tarifaire">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'deco' as const, name: 'Découverte', desc: 'Gratuit · 50 élèves max' },
              { id: 'std' as const, name: 'Standard', desc: '300 élèves · Toutes fonctions' },
              { id: 'prem' as const, name: 'Premium', desc: 'Illimité · IA + Mobile Money' },
            ].map(plan => (
              <div key={plan.id} onClick={() => onPlanChange(plan.id)} style={{
                flex: '1 1 120px', padding: 10, border: `1.5px solid ${selectedPlan === plan.id ? 'var(--primary)' : 'var(--border2)'}`,
                borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                background: selectedPlan === plan.id ? 'var(--green-light)' : 'var(--surface)',
                transition: 'all 0.15s'
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{plan.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{plan.desc}</div>
              </div>
            ))}
          </div>
        </Field>
        <ModalFooter>
          <button type="button" onClick={onCancel} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button type="submit" disabled={loading} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: loading ? '#6b7280' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 2px 8px rgba(142,42,58,0.18)' }}>
            Continuer →
          </button>
        </ModalFooter>
      </form>
    )
  }

  return (
    <form onSubmit={handleConfirmSubmit} autoComplete="off">
      {/* Honeypot */}
      <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <div style={{ background: 'var(--bg2)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Établissement</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{schoolName}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10, marginBottom: 4 }}>Email</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{email}</div>
      </div>

      <Field label="Mot de passe master *" hint="Confirmez votre identité pour envoyer l'invitation">
        <FieldInput type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" showToggle />
      </Field>

      {mfaEnabled && (
        <Field label="Code MFA *">
          <FieldInput type="tel" placeholder="123456" value={mfaCode} onChange={e => setMfaCode(e.target.value)} style={{ textAlign: 'center', fontSize: 14, fontWeight: 900, letterSpacing: 3 }} />
        </Field>
      )}

      <ModalFooter>
        <button type="button" onClick={() => setStep('details')} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={13} /> Retour</button>
        <button type="submit" disabled={submitting || loading} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: submitting || loading ? '#6b7280' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: submitting || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: submitting || loading ? 'none' : '0 2px 8px rgba(142,42,58,0.18)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {submitting ? '...' : <><Mail size={16} /> Envoyer l'invitation</>}
        </button>
      </ModalFooter>
    </form>
  )
}
