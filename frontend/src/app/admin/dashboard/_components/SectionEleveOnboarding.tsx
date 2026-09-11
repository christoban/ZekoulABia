'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface ClasseItem { id: string; name: string }

interface Settings {
  selfServiceEnabled: boolean
  responsableRole: 'ADMIN' | 'STAFF'
}

interface Dossier {
  id: string
  nomProvisoire: string
  status: string
  sourceType: string
  recipientType: string
  classId: string | null
  classe: { name: string } | null
  matchScore: number | null
  contactEmail: string | null
  contactTelephone: string | null
  createdAt: string
}

type DispositifReponse = '' | 'true' | 'false'

const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: 'var(--bg2)', color: 'var(--text2)' },
  LINK_SENT: { bg: 'var(--blue-light)', color: 'var(--blue)' },
  SUBMITTED: { bg: 'var(--blue-light)', color: 'var(--blue)' },
  PENDING_VALIDATION: { bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
  VALIDATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
  ACTIVATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
  EXPIRED: { bg: 'var(--bg2)', color: 'var(--text3)' },
}

const btnPri = { padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' as const }
const btnSec = { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' as const }
const btnDanger = { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--red)', background: 'var(--surface)', color: 'var(--red)', fontWeight: 700, fontSize: 12, cursor: 'pointer' as const }
const btnSmall = { padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' as const }
const inputStyle = { padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, width: '100%', boxSizing: 'border-box' as const }

export default function SectionEleveOnboarding({ onToast }: Props) {
  const t = useT('admin')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [classes, setClasses] = useState<ClasseItem[]>([])
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    nomProvisoire: '', classId: '', contactEmail: '', contactTelephone: '',
    parentContactEmail: '', parentContactTelephone: '',
    recipientType: 'ELEVE' as 'ELEVE' | 'PARENT' | 'LES_DEUX',
    eleveADispositif: '' as DispositifReponse, parentADispositif: '' as DispositifReponse,
    aucunContactDisponible: false,
  })
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  const [validateTarget, setValidateTarget] = useState<Dossier | null>(null)
  const [validateClassId, setValidateClassId] = useState('')
  const [validateError, setValidateError] = useState('')
  const [validating, setValidating] = useState(false)

  const [rejectTarget, setRejectTarget] = useState<Dossier | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, cRes, dRes] = await Promise.all([
        fetchApi('/api/v2/eleve-onboarding/settings', { credentials: 'include' }),
        fetchApi('/api/v2/classes', { credentials: 'include' }),
        fetchApi(`/api/v2/eleve-onboarding${statusFilter ? `?status=${statusFilter}` : ''}`, { credentials: 'include' }),
      ])
      const sData = await sRes.json()
      const cData = await cRes.json()
      const dData = await dRes.json()
      if (sData.success) setSettings(sData.data)
      if (cData.success !== false) setClasses(cData.data || [])
      if (dData.success) setDossiers(dData.data || [])
    } catch { onToast(t('eleveOnboarding.errorGeneric'), 'error') } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const toggleSelfService = async () => {
    if (!settings) return
    const next = !settings.selfServiceEnabled
    setSettings(s => s ? { ...s, selfServiceEnabled: next } : s)
    try {
      const res = await fetchApi('/api/v2/eleve-onboarding/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ selfServiceEnabled: next }),
      })
      const data = await res.json()
      if (data.success) onToast(t('eleveOnboarding.settingsSaved'), 'success')
      else onToast(data.message || t('eleveOnboarding.errorGeneric'), 'error')
    } catch { onToast(t('eleveOnboarding.errorGeneric'), 'error') }
  }

  const changeResponsableRole = async (role: 'ADMIN' | 'STAFF') => {
    setSettings(s => s ? { ...s, responsableRole: role } : s)
    try {
      await fetchApi('/api/v2/eleve-onboarding/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ responsableRole: role }),
      })
      onToast(t('eleveOnboarding.settingsSaved'), 'success')
    } catch { onToast(t('eleveOnboarding.errorGeneric'), 'error') }
  }

  const submitCreate = async () => {
    if (!createForm.nomProvisoire.trim()) { setCreateError(t('eleveOnboarding.createErrorNom')); return }
    const aucunContact = !createForm.contactEmail.trim() && !createForm.contactTelephone.trim()
      && !createForm.parentContactEmail.trim() && !createForm.parentContactTelephone.trim()
    if (aucunContact && !createForm.aucunContactDisponible) { setCreateError(t('eleveOnboarding.createErrorContact')); return }
    setCreating(true); setCreateError('')
    try {
      const res = await fetchApi('/api/v2/eleve-onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          nomProvisoire: createForm.nomProvisoire,
          classId: createForm.classId || undefined,
          contactEmail: createForm.contactEmail || undefined,
          contactTelephone: createForm.contactTelephone || undefined,
          parentContactEmail: createForm.parentContactEmail || undefined,
          parentContactTelephone: createForm.parentContactTelephone || undefined,
          recipientType: createForm.recipientType,
          sourceType: 'AUTOSERVICE',
          eleveADispositif: createForm.eleveADispositif ? createForm.eleveADispositif === 'true' : undefined,
          parentADispositif: createForm.parentADispositif ? createForm.parentADispositif === 'true' : undefined,
          aucunContactDisponible: createForm.aucunContactDisponible || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('eleveOnboarding.createSuccess'), 'success')
        setCreateOpen(false)
        setCreateForm({
          nomProvisoire: '', classId: '', contactEmail: '', contactTelephone: '',
          parentContactEmail: '', parentContactTelephone: '', recipientType: 'ELEVE',
          eleveADispositif: '', parentADispositif: '', aucunContactDisponible: false,
        })
        fetchAll()
      } else setCreateError(data.message || t('eleveOnboarding.errorGeneric'))
    } catch { setCreateError(t('eleveOnboarding.errorGeneric')) } finally { setCreating(false) }
  }

  const exportPdf = async (d: Dossier) => {
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/${d.id}/pdf`, { credentials: 'include' })
      if (!res.ok) { onToast(t('eleveOnboarding.pdfError'), 'error'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `onboarding-${d.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { onToast(t('eleveOnboarding.pdfError'), 'error') }
  }

  const openValidate = (d: Dossier) => { setValidateTarget(d); setValidateClassId(d.classId ?? ''); setValidateError('') }

  const submitValidate = async () => {
    if (!validateTarget) return
    if (!validateClassId) { setValidateError(t('eleveOnboarding.validateErrorClasse')); return }
    setValidating(true); setValidateError('')
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/${validateTarget.id}/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ classId: validateClassId }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('eleveOnboarding.validateSuccess'), 'success')
        setValidateTarget(null)
        fetchAll()
      } else setValidateError(data.message || t('eleveOnboarding.errorGeneric'))
    } catch { setValidateError(t('eleveOnboarding.errorGeneric')) } finally { setValidating(false) }
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) return
    setRejecting(true)
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/${rejectTarget.id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ rejectionReason: rejectReason }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('eleveOnboarding.rejectSuccess'), 'success')
        setRejectTarget(null); setRejectReason('')
        fetchAll()
      } else onToast(data.message || t('eleveOnboarding.errorGeneric'), 'error')
    } catch { onToast(t('eleveOnboarding.errorGeneric'), 'error') } finally { setRejecting(false) }
  }

  const resendLink = async (d: Dossier) => {
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/${d.id}/resend-link`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) { onToast(t('eleveOnboarding.resendSuccess'), 'success'); fetchAll() }
      else onToast(data.message || t('eleveOnboarding.errorGeneric'), 'error')
    } catch { onToast(t('eleveOnboarding.errorGeneric'), 'error') }
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 13 }}>
        <div>
          <h2 className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('eleveOnboarding.title')}</h2>
          <p className="text-[13px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 4 }}>{t('eleveOnboarding.subtitle')}</p>
        </div>
        <button onClick={() => setCreateOpen(true)} style={{ ...btnPri, borderRadius: 10, padding: '9px 11px', fontSize: 12 }}>{t('eleveOnboarding.createBtn')}</button>
      </div>

      {settings && (
        <div className="flex-col md:flex-row gap-[12px] md:gap-4 rounded-[8px] md:rounded-[8px] px-[14px] py-[12px] md:px-3.5 md:py-2.5 mb-[16px] md:mb-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[var(--border)]" style={{ display: 'flex', alignItems: 'stretch', background: 'var(--surface)' }}>
          <div onClick={toggleSelfService} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}>
            <span className="text-[12.5px] md:text-[12px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('eleveOnboarding.settingsToggle')}</span>
            <div style={{ width: 40, height: 22, borderRadius: 11, background: settings.selfServiceEnabled ? 'var(--green)' : 'var(--border2)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 3, left: settings.selfServiceEnabled ? 22 : 3, transition: 'left 0.2s' }} />
            </div>
          </div>
          <label className="text-[12.5px] md:text-[12px] gap-[8px] md:gap-[10px]" style={{ display: 'flex', alignItems: 'center', color: 'var(--text2)' }}>
            {t('eleveOnboarding.settingsResponsable')}
            <select value={settings.responsableRole} onChange={e => changeResponsableRole(e.target.value as 'ADMIN' | 'STAFF')}
              className="text-[12.5px] md:text-[12px] px-[8px] md:px-[10px] py-[5px] md:py-[6px] rounded-[8px] md:rounded-[8px]"
              style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
              <option value="ADMIN">ADMIN</option>
              <option value="STAFF">STAFF</option>
            </select>
          </label>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-[8px] md:rounded-[8px] px-[12px] md:px-[14px] py-[9px] md:py-[8px] text-[12.5px] md:text-[13px] font-semibold md:font-normal border-0 md:border md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none"
          style={{ background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="">{t('eleveOnboarding.filterAll')}</option>
          {['DRAFT', 'LINK_SENT', 'SUBMITTED', 'PENDING_VALIDATION', 'VALIDATED', 'ACTIVATED', 'REJECTED', 'EXPIRED'].map(s => (
            <option key={s} value={s}>{t(`eleveOnboarding.status_${s}`)}</option>
          ))}
        </select>
      </div>

      <div className="rounded-none md:rounded-[8px] border-0 md:border md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="text-[13.5px] md:text-[13px] py-[30px] md:py-[40px]" style={{ textAlign: 'center', color: 'var(--text3)' }}>{t('common.loading') || '...'}</div>
        ) : dossiers.length === 0 ? (
          <div className="text-[13.5px] md:text-[13px] py-[30px] md:py-[40px]" style={{ textAlign: 'center', color: 'var(--text3)' }}>{t('eleveOnboarding.listEmpty')}</div>
        ) : (
          <>
          <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
            {dossiers.map(d => (
              <div key={d.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 15 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.nomProvisoire}</div>
                {d.matchScore !== null && (
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 3 }}>{t('eleveOnboarding.matchWarning', { score: String(d.matchScore) })}</div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, ...(STATUT_COLORS[d.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }) }}>
                    {t(`eleveOnboarding.status_${d.status}`)}
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'var(--bg2)', color: 'var(--text2)' }}>
                    {t(`eleveOnboarding.source_${d.sourceType}`)}
                  </span>
                  {d.classe?.name && (
                    <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'var(--bg2)', color: 'var(--text2)' }}>{d.classe.name}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>{new Date(d.createdAt).toLocaleDateString()}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bg2)' }}>
                  {d.status === 'PENDING_VALIDATION' && (
                    <>
                      <button onClick={() => openValidate(d)} style={btnSmall}>{t('eleveOnboarding.validateBtn')}</button>
                      <button onClick={() => setRejectTarget(d)} style={btnDanger}>{t('eleveOnboarding.rejectBtn')}</button>
                    </>
                  )}
                  {(d.status === 'LINK_SENT' || d.status === 'EXPIRED') && (
                    <button onClick={() => resendLink(d)} style={{ ...btnSec, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>{t('eleveOnboarding.resendBtn')}</button>
                  )}
                  <button onClick={() => exportPdf(d)} style={{ ...btnSec, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>{t('eleveOnboarding.pdfBtn')}</button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>{[t('eleveOnboarding.colName'), t('eleveOnboarding.colStatus'), t('eleveOnboarding.colSource'), t('eleveOnboarding.colClasse'), t('eleveOnboarding.colCreated'), t('eleveOnboarding.colActions')].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', textTransform: 'uppercase' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {dossiers.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '12px 12px', fontSize: 12, color: 'var(--text)' }}>
                      {d.nomProvisoire}
                      {d.matchScore !== null && (
                        <div style={{ fontSize: 11, color: '#b45309', marginTop: 3 }}>{t('eleveOnboarding.matchWarning', { score: String(d.matchScore) })}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, ...(STATUT_COLORS[d.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }) }}>
                        {t(`eleveOnboarding.status_${d.status}`)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: 13, color: 'var(--text2)' }}>{t(`eleveOnboarding.source_${d.sourceType}`)}</td>
                    <td style={{ padding: '12px 12px', fontSize: 13, color: 'var(--text2)' }}>{d.classe?.name ?? '—'}</td>
                    <td style={{ padding: '12px 12px', fontSize: 13, color: 'var(--text3)' }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 12px', display: 'flex', gap: 8 }}>
                      {d.status === 'PENDING_VALIDATION' && (
                        <>
                          <button onClick={() => openValidate(d)} style={btnSmall}>{t('eleveOnboarding.validateBtn')}</button>
                          <button onClick={() => setRejectTarget(d)} style={btnDanger}>{t('eleveOnboarding.rejectBtn')}</button>
                        </>
                      )}
                      {(d.status === 'LINK_SENT' || d.status === 'EXPIRED') && (
                        <button onClick={() => resendLink(d)} style={btnSec}>{t('eleveOnboarding.resendBtn')}</button>
                      )}
                      <button onClick={() => exportPdf(d)} style={btnSec}>{t('eleveOnboarding.pdfBtn')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {createOpen && (
        <div onClick={() => !creating && setCreateOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} className="p-5 md:p-5" style={{ background: 'var(--surface)', borderRadius: 10, width: 420, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="text-[13px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 13 }}>{t('eleveOnboarding.createModalTitle')}</h3>

            <FieldLabel>{t('eleveOnboarding.fieldNomProvisoire')}</FieldLabel>
            <input style={inputStyle} value={createForm.nomProvisoire} onChange={e => setCreateForm(f => ({ ...f, nomProvisoire: e.target.value }))} />

            <FieldLabel>{t('eleveOnboarding.fieldClasse')}</FieldLabel>
            <select style={inputStyle} value={createForm.classId} onChange={e => setCreateForm(f => ({ ...f, classId: e.target.value }))}>
              <option value="">{t('eleveOnboarding.fieldClasseNone')}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <FieldLabel>{t('eleveOnboarding.fieldContactEmail')}</FieldLabel>
            <input style={inputStyle} type="email" value={createForm.contactEmail} onChange={e => setCreateForm(f => ({ ...f, contactEmail: e.target.value }))} disabled={createForm.aucunContactDisponible} />

            <FieldLabel>{t('eleveOnboarding.fieldContactTelephone')}</FieldLabel>
            <input style={inputStyle} value={createForm.contactTelephone} onChange={e => setCreateForm(f => ({ ...f, contactTelephone: e.target.value }))} disabled={createForm.aucunContactDisponible} />

            <FieldLabel>{t('eleveOnboarding.fieldRecipient')}</FieldLabel>
            <select style={inputStyle} value={createForm.recipientType} onChange={e => setCreateForm(f => ({ ...f, recipientType: e.target.value as any }))}>
              <option value="ELEVE">{t('eleveOnboarding.recipientEleve')}</option>
              <option value="PARENT">{t('eleveOnboarding.recipientParent')}</option>
              <option value="LES_DEUX">{t('eleveOnboarding.recipientBoth')}</option>
            </select>

            {createForm.recipientType === 'LES_DEUX' && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text3)', margin: '10px 0 0' }}>{t('eleveOnboarding.parentContactHint')}</div>
                <FieldLabel>{t('eleveOnboarding.fieldParentContactEmail')}</FieldLabel>
                <input style={inputStyle} type="email" value={createForm.parentContactEmail} onChange={e => setCreateForm(f => ({ ...f, parentContactEmail: e.target.value }))} disabled={createForm.aucunContactDisponible} />

                <FieldLabel>{t('eleveOnboarding.fieldParentContactTelephone')}</FieldLabel>
                <input style={inputStyle} value={createForm.parentContactTelephone} onChange={e => setCreateForm(f => ({ ...f, parentContactTelephone: e.target.value }))} disabled={createForm.aucunContactDisponible} />
              </>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', margin: '14px 0 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={createForm.aucunContactDisponible} onChange={e => setCreateForm(f => ({ ...f, aucunContactDisponible: e.target.checked }))} />
              {t('eleveOnboarding.aucunContactDisponibleLabel')}
            </label>

            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: '18px 0 2px' }}>{t('eleveOnboarding.digitalCapacityTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{t('eleveOnboarding.digitalCapacityHint')}</div>

            <FieldLabel>{t('eleveOnboarding.fieldEleveADispositif')}</FieldLabel>
            <select style={inputStyle} value={createForm.eleveADispositif} onChange={e => setCreateForm(f => ({ ...f, eleveADispositif: e.target.value as DispositifReponse }))}>
              <option value="">{t('eleveOnboarding.deviceUnknown')}</option>
              <option value="true">{t('eleveOnboarding.deviceYes')}</option>
              <option value="false">{t('eleveOnboarding.deviceNo')}</option>
            </select>

            <FieldLabel>{t('eleveOnboarding.fieldParentADispositif')}</FieldLabel>
            <select style={inputStyle} value={createForm.parentADispositif} onChange={e => setCreateForm(f => ({ ...f, parentADispositif: e.target.value as DispositifReponse }))}>
              <option value="">{t('eleveOnboarding.deviceUnknown')}</option>
              <option value="true">{t('eleveOnboarding.deviceYes')}</option>
              <option value="false">{t('eleveOnboarding.deviceNo')}</option>
            </select>

            {createError && <div style={{ background: 'var(--red-light,#fef2f2)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 14 }}>{createError}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setCreateOpen(false)} disabled={creating} style={{ ...btnSec, flex: 1 }}>{t('eleveOnboarding.cancel')}</button>
              <button onClick={submitCreate} disabled={creating} style={{ ...btnPri, flex: 2 }}>{creating ? '...' : t('eleveOnboarding.createSubmit')}</button>
            </div>
          </div>
        </div>
      )}

      {validateTarget && (
        <div onClick={() => !validating && setValidateTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} className="p-5 md:p-5" style={{ background: 'var(--surface)', borderRadius: 10, width: 420, maxWidth: '92vw' }}>
            <h3 className="text-[13px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{t('eleveOnboarding.validateModalTitle')}</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{validateTarget.nomProvisoire}</p>

            <FieldLabel>{t('eleveOnboarding.validateClasseLabel')}</FieldLabel>
            <select style={inputStyle} value={validateClassId} onChange={e => setValidateClassId(e.target.value)}>
              <option value="">{t('eleveOnboarding.fieldClasseNone')}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {validateError && <div style={{ background: 'var(--red-light,#fef2f2)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 14 }}>{validateError}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setValidateTarget(null)} disabled={validating} style={{ ...btnSec, flex: 1 }}>{t('eleveOnboarding.cancel')}</button>
              <button onClick={submitValidate} disabled={validating} style={{ ...btnPri, flex: 2 }}>{validating ? '...' : t('eleveOnboarding.validateSubmit')}</button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div onClick={() => !rejecting && setRejectTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} className="p-5 md:p-5" style={{ background: 'var(--surface)', borderRadius: 10, width: 420, maxWidth: '92vw' }}>
            <h3 className="text-[13px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{t('eleveOnboarding.rejectModalTitle')}</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{rejectTarget.nomProvisoire}</p>

            <FieldLabel>{t('eleveOnboarding.rejectReasonLabel')}</FieldLabel>
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setRejectTarget(null)} disabled={rejecting} style={{ ...btnSec, flex: 1 }}>{t('eleveOnboarding.cancel')}</button>
              <button onClick={submitReject} disabled={rejecting || !rejectReason.trim()} style={{ ...btnPri, flex: 2, background: 'var(--red)' }}>{rejecting ? '...' : t('eleveOnboarding.rejectSubmit')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text2)', margin: '12px 0 6px' }}>{children}</div>
}
