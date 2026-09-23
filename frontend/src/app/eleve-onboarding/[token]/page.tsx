'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

type LoadState = 'loading' | 'invalid' | 'expired' | 'used' | 'notPending' | 'valid' | 'submitted'

interface DossierInfo {
  nomProvisoire: string
  classeSuggeree: { name: string; level: string | null } | null
  recipientType: 'ELEVE' | 'PARENT' | 'LES_DEUX'
  sourceType: 'IMPORT_MASSE' | 'AUTOSERVICE' | 'CONCOURS' | 'GROUPE_TRANSFERT'
  eleveADispositif: boolean | null
  parentADispositif: boolean | null
}

export default function EleveOnboardingPage() {
  const params = useParams()
  const token = String(params.token ?? '')
  const t = useT('onboarding')

  const [state, setState] = useState<LoadState>('loading')
  const [dossier, setDossier] = useState<DossierInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [gender, setGender] = useState<'M' | 'F' | ''>('')
  const [originSchool, setOriginSchool] = useState('')
  const [eleveADispositif, setEleveADispositif] = useState<'' | 'true' | 'false'>('')
  const [parentADispositif, setParentADispositif] = useState<'' | 'true' | 'false'>('')

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const res = await fetchApi(`/api/v2/eleve-onboarding/token/${token}`)
        const data = await res.json()
        if (data.success) {
          setDossier(data.data)
          setState('valid')
          return
        }
        if (res.status === 410) {
          setState(data.message?.toLowerCase().includes('expiré') ? 'expired' : 'used')
        } else if (res.status === 409) {
          setState('notPending')
        } else {
          setState('invalid')
        }
        setErrorMessage(data.message ?? '')
      } catch {
        setState('invalid')
      }
    })()
  }, [token])

  const submit = async () => {
    if (!nom.trim() || !prenom.trim()) {
      setSubmitError(t('eleveAutoservice.errorRequired'))
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/token/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom, prenom, dateNaissance: dateNaissance || undefined, gender: gender || undefined, originSchool: originSchool || undefined,
          eleveADispositif: eleveADispositif ? eleveADispositif === 'true' : undefined,
          parentADispositif: parentADispositif ? parentADispositif === 'true' : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) setState('submitted')
      else setSubmitError(data.message || t('eleveAutoservice.errorGeneric'))
    } catch {
      setSubmitError(t('eleveAutoservice.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg,#f6f8fb)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'Segoe UI,Arial,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f766e,#134e4a)', color: '#fff', padding: '20px 26px' }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>ZEKOULABIA</div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{t('eleveAutoservice.pageTitle')}</div>
        </div>

        <div style={{ padding: '28px 26px' }}>
          {state === 'loading' && (
            <p style={{ color: '#6b7280', textAlign: 'center' }}>{t('eleveAutoservice.loading')}</p>
          )}

          {(state === 'invalid' || state === 'expired' || state === 'used' || state === 'notPending') && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: '#374151' }}><AlertTriangle size={40} strokeWidth={2} /></div>
              <p style={{ color: '#374151', fontSize: 15 }}>
                {state === 'expired' ? t('eleveAutoservice.linkExpired')
                  : state === 'used' ? t('eleveAutoservice.linkUsed')
                  : state === 'notPending' ? t('eleveAutoservice.linkNotPending')
                  : errorMessage || t('eleveAutoservice.invalidLink')}
              </p>
            </div>
          )}

          {state === 'submitted' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: 'var(--green2)' }}><CheckCircle2 size={40} strokeWidth={2} /></div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--green2)', marginBottom: 8 }}>{t('eleveAutoservice.successTitle')}</div>
              <p style={{ color: '#374151', fontSize: 15 }}>{t('eleveAutoservice.successMessage')}</p>
            </div>
          )}

          {state === 'valid' && dossier && (
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                {t('eleveAutoservice.formTitle', { name: dossier.nomProvisoire })}
              </p>
              {dossier.classeSuggeree && (
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: dossier.sourceType === 'GROUPE_TRANSFERT' ? 8 : 20 }}>
                  {t('eleveAutoservice.suggestedClass', { className: dossier.classeSuggeree.name })}
                </p>
              )}
              {dossier.sourceType === 'GROUPE_TRANSFERT' && (
                <p style={{ fontSize: 13, color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '10px 12px', marginBottom: 20 }}>
                  {t('eleveAutoservice.transferContext')}
                </p>
              )}

              <Field label={t('eleveAutoservice.nomLabel')}>
                <input style={inputStyle} value={nom} onChange={e => setNom(e.target.value)} />
              </Field>
              <Field label={t('eleveAutoservice.prenomLabel')}>
                <input style={inputStyle} value={prenom} onChange={e => setPrenom(e.target.value)} />
              </Field>
              <Field label={t('eleveAutoservice.dateNaissanceLabel')}>
                <input style={inputStyle} placeholder={t('eleveAutoservice.dateNaissancePlaceholder')} value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} />
              </Field>
              <Field label={t('eleveAutoservice.genderLabel')}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['M', 'F'] as const).map(g => (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', borderColor: gender === g ? '#0f766e' : '#e5e7eb', background: gender === g ? '#f0fdfa' : '#fff', color: gender === g ? '#0f766e' : '#6b7280' }}>
                      {g === 'M' ? t('eleveAutoservice.genderM') : t('eleveAutoservice.genderF')}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('eleveAutoservice.originSchoolLabel')}>
                <input style={inputStyle} value={originSchool} onChange={e => setOriginSchool(e.target.value)} />
              </Field>

              {(dossier.recipientType === 'ELEVE' || dossier.recipientType === 'LES_DEUX') && dossier.eleveADispositif == null && (
                <Field label={t('eleveAutoservice.eleveADispositifLabel')}>
                  <DeviceToggle value={eleveADispositif} onChange={setEleveADispositif} yesLabel={t('eleveAutoservice.deviceYes')} noLabel={t('eleveAutoservice.deviceNo')} />
                </Field>
              )}
              {(dossier.recipientType === 'PARENT' || dossier.recipientType === 'LES_DEUX') && dossier.parentADispositif == null && (
                <Field label={t('eleveAutoservice.parentADispositifLabel')}>
                  <DeviceToggle value={parentADispositif} onChange={setParentADispositif} yesLabel={t('eleveAutoservice.deviceYes')} noLabel={t('eleveAutoservice.deviceNo')} />
                </Field>
              )}

              {submitError && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{submitError}</div>
              )}

              <button onClick={submit} disabled={submitting}
                style={{ width: '100%', padding: '13px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#0f766e,#134e4a)', color: '#fff', border: 'none', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? t('eleveAutoservice.submitting') : t('eleveAutoservice.submitButton')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function DeviceToggle({ value, onChange, yesLabel, noLabel }: { value: '' | 'true' | 'false'; onChange: (v: '' | 'true' | 'false') => void; yesLabel: string; noLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {([['true', yesLabel], ['false', noLabel]] as const).map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', borderColor: value === v ? '#0f766e' : '#e5e7eb', background: value === v ? '#f0fdfa' : '#fff', color: value === v ? '#0f766e' : '#6b7280' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 15, border: '1.5px solid #e5e7eb', boxSizing: 'border-box', outline: 'none',
}
