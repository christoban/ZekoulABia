'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import LanguageSwitch from '@/components/LanguageSwitch'

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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px rgba(227, 176, 75, 0.2)'
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

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
        maxWidth: 480,
        width: 'calc(100% - 32px)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            ZEKOULABIA
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, fontWeight: 600 }}>
            {t('eleveAutoservice.pageTitle')}
          </p>
        </div>

        {state === 'loading' && (
          <p style={{ color: 'var(--text3)', textAlign: 'center', fontSize: 14 }}>{t('eleveAutoservice.loading')}</p>
        )}

        {(state === 'invalid' || state === 'expired' || state === 'used' || state === 'notPending') && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: 'var(--text2)' }}><AlertTriangle size={40} strokeWidth={2} /></div>
            <p style={{ color: 'var(--text2)', fontSize: 15 }}>
              {state === 'expired' ? t('eleveAutoservice.linkExpired')
                : state === 'used' ? t('eleveAutoservice.linkUsed')
                : state === 'notPending' ? t('eleveAutoservice.linkNotPending')
                : errorMessage || t('eleveAutoservice.invalidLink')}
            </p>
          </div>
        )}

        {state === 'submitted' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: 'var(--success)' }}><CheckCircle2 size={40} strokeWidth={2} /></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)', marginBottom: 8 }}>{t('eleveAutoservice.successTitle')}</div>
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>{t('eleveAutoservice.successMessage')}</p>
          </div>
        )}

        {state === 'valid' && dossier && (
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {t('eleveAutoservice.formTitle', { name: dossier.nomProvisoire })}
            </p>
            {dossier.classeSuggeree && (
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: dossier.sourceType === 'GROUPE_TRANSFERT' ? 8 : 20 }}>
                {t('eleveAutoservice.suggestedClass', { className: dossier.classeSuggeree.name })}
              </p>
            )}
            {dossier.sourceType === 'GROUPE_TRANSFERT' && (
              <p style={{ fontSize: 13, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 20 }}>
                {t('eleveAutoservice.transferContext')}
              </p>
            )}

            <Field label={t('eleveAutoservice.nomLabel')}>
              <input style={inputStyle} value={nom} onChange={e => setNom(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} />
            </Field>
            <Field label={t('eleveAutoservice.prenomLabel')}>
              <input style={inputStyle} value={prenom} onChange={e => setPrenom(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} />
            </Field>
            <Field label={t('eleveAutoservice.dateNaissanceLabel')}>
              <input style={inputStyle} placeholder={t('eleveAutoservice.dateNaissancePlaceholder')} value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} />
            </Field>
            <Field label={t('eleveAutoservice.genderLabel')}>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['M', 'F'] as const).map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    style={{ flex: 1, minHeight: 44, padding: '9px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', borderColor: gender === g ? 'var(--primary)' : 'var(--border)', background: gender === g ? 'var(--primary-light)' : 'var(--surface)', color: gender === g ? 'var(--primary)' : 'var(--text2)' }}>
                    {g === 'M' ? t('eleveAutoservice.genderM') : t('eleveAutoservice.genderF')}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('eleveAutoservice.originSchoolLabel')}>
              <input style={inputStyle} value={originSchool} onChange={e => setOriginSchool(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} />
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
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{submitError}</div>
            )}

            <button onClick={submit} disabled={submitting}
              style={{ width: '100%', minHeight: 48, padding: '12px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--primary)', color: '#fff', border: 'none', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1, transition: 'background 0.2s' }}
              onMouseEnter={e => !submitting && (e.currentTarget.style.background = 'var(--primary-hover)')}
              onMouseLeave={e => !submitting && (e.currentTarget.style.background = 'var(--primary)')}
            >
              {submitting ? t('eleveAutoservice.submitting') : t('eleveAutoservice.submitButton')}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

function DeviceToggle({ value, onChange, yesLabel, noLabel }: { value: '' | 'true' | 'false'; onChange: (v: '' | 'true' | 'false') => void; yesLabel: string; noLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {([['true', yesLabel], ['false', noLabel]] as const).map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          style={{ flex: 1, minHeight: 44, padding: '9px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', borderColor: value === v ? 'var(--primary)' : 'var(--border)', background: value === v ? 'var(--primary-light)' : 'var(--surface)', color: value === v ? 'var(--primary)' : 'var(--text2)' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '12px 14px', borderRadius: 10, fontSize: 16, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s'
}
