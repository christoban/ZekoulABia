'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { COEFF_LEVELS, COEFF_SERIES, type SubjectItem, type Teacher } from './types'
import { btnPrim, btnSec2, ModalOverlay, sError, sInput, sInputCls, sLabel, sLabelCls, sModalTitle, sModalTitleCls, tdStyle, thStyle } from './subjectsUi'

interface ToastFn {
  (msg: string, type?: 'success' | 'error' | 'info'): void
}

export function SubjectCreateModal({ onClose, onCreated, onToast }: { onClose: () => void; onCreated: () => void; onToast: ToastFn }) {
  const t = useT('admin')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [coefficient, setCoefficient] = useState('1')
  const [hoursPerWeek, setHoursPerWeek] = useState('2')
  const [subjectType, setSubjectType] = useState('THEORETICAL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitCreate = async () => {
    if (!name.trim()) { setError(t('subjects.create_modal.name_required')); return }
    setLoading(true); setError('')
    try {
      const res = await fetchApi('/api/v2/subjects', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), code: code.trim() || undefined, coefficient: parseFloat(coefficient) || 1, hoursPerWeek: parseInt(hoursPerWeek) || 2, type: subjectType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('subjects.create_modal.toast_created').replace('{name}', name), 'success')
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.create_modal.title')}</div>
      <div className={sLabelCls} style={sLabel}>Nom *</div>
      <input className={sInputCls} style={sInput} placeholder="Ex: Mathématiques, Français…" value={name} onChange={e => setName(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><div className={sLabelCls} style={sLabel}>Code</div><input className={sInputCls} style={sInput} placeholder="Ex: MATH, FR" value={code} onChange={e => setCode(e.target.value)} /></div>
        <div><div className={sLabelCls} style={sLabel}>Coefficient</div><input className={sInputCls} style={sInput} type="number" min="0.5" step="0.5" value={coefficient} onChange={e => setCoefficient(e.target.value)} /></div>
        <div><div className={sLabelCls} style={sLabel}>Heures / semaine</div><input className={sInputCls} style={sInput} type="number" min="1" value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)} /></div>
        <div>
          <div className={sLabelCls} style={sLabel}>Type</div>
          <select className={sInputCls} style={sInput} value={subjectType} onChange={e => setSubjectType(e.target.value)}>
            <option value="THEORETICAL">{t('subjects.type_labels.THEORETICAL')}</option>
            <option value="PRACTICAL">{t('subjects.type_labels.PRACTICAL')}</option>
            <option value="MIXED">{t('subjects.type_labels.MIXED')}</option>
          </select>
        </div>
      </div>
      {error && <div style={sError}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose}>{t('subjects.create_modal.btn_cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: loading ? 0.7 : 1 }} onClick={submitCreate} disabled={loading}>{loading ? t('subjects.departments.create_modal.creating') : t('subjects.create_modal.btn_create')}</button>
      </div>
    </ModalOverlay>
  )
}

export function SubjectEditModal({ subject, onClose, onUpdated, onToast }: { subject: SubjectItem; onClose: () => void; onUpdated: () => void; onToast: ToastFn }) {
  const t = useT('admin')
  const [name, setName] = useState(subject.name)
  const [code, setCode] = useState(subject.code ?? '')
  const [coefficient, setCoefficient] = useState(String(subject.coefficient))
  const [hoursPerWeek, setHoursPerWeek] = useState(String(subject.hoursPerWeek))
  const [subjectType, setSubjectType] = useState(subject.subjectType)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitMod = async () => {
    if (!name.trim()) { setError(t('subjects.edit_modal.name_required')); return }
    setLoading(true); setError('')
    try {
      const res = await fetchApi(`/api/v2/subjects/${subject.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), code: code.trim() || undefined, coefficient: parseFloat(coefficient) || 1, hoursPerWeek: parseInt(hoursPerWeek) || 2, type: subjectType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('subjects.edit_modal.toast_updated'), 'success')
      onUpdated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.edit_modal.title')}</div>
      <div className={sLabelCls} style={sLabel}>Nom *</div>
      <input className={sInputCls} style={sInput} value={name} onChange={e => setName(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><div className={sLabelCls} style={sLabel}>Code</div><input className={sInputCls} style={sInput} value={code} onChange={e => setCode(e.target.value)} /></div>
        <div><div className={sLabelCls} style={sLabel}>Coefficient</div><input className={sInputCls} style={sInput} type="number" min="0.5" step="0.5" value={coefficient} onChange={e => setCoefficient(e.target.value)} /></div>
        <div><div className={sLabelCls} style={sLabel}>Heures / semaine</div><input className={sInputCls} style={sInput} type="number" min="1" value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)} /></div>
        <div>
          <div className={sLabelCls} style={sLabel}>Type</div>
          <select className={sInputCls} style={sInput} value={subjectType} onChange={e => setSubjectType(e.target.value)}>
            <option value="THEORETICAL">{t('subjects.type_labels.THEORETICAL')}</option>
            <option value="PRACTICAL">{t('subjects.type_labels.PRACTICAL')}</option>
            <option value="MIXED">{t('subjects.type_labels.MIXED')}</option>
          </select>
        </div>
      </div>
      {error && <div style={sError}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose}>{t('subjects.edit_modal.btn_cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: loading ? 0.7 : 1 }} onClick={submitMod} disabled={loading}>{loading ? t('subjects.coeff_modal.saving') : t('subjects.edit_modal.btn_save')}</button>
      </div>
    </ModalOverlay>
  )
}

export function SubjectCoeffModal({ subject, onClose, onToast }: { subject: SubjectItem; onClose: () => void; onToast: ToastFn }) {
  const t = useT('admin')
  const [coeffValues, setCoeffValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const lvl of COEFF_LEVELS) {
      for (const serie of COEFF_SERIES) init[`${lvl}_${serie}`] = ''
    }
    return init
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitCoeff = async () => {
    const coefficients: { classLevel: string; serieCode: string; coefficient: number }[] = []
    for (const lvl of COEFF_LEVELS) {
      for (const serie of COEFF_SERIES) {
        const val = coeffValues[`${lvl}_${serie}`]
        if (val && parseFloat(val) > 0) coefficients.push({ classLevel: lvl, serieCode: serie, coefficient: parseFloat(val) })
      }
    }
    if (coefficients.length === 0) { setError(t('subjects.coeff_modal.error_empty')); return }
    setLoading(true); setError('')
    try {
      const res = await fetchApi(`/api/v2/subjects/${subject.id}/coefficients`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coefficients }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('subjects.coeff_modal.toast_saved').replace('{name}', subject.name), 'success')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.coeff_modal.title')}</div>
      <div className="text-xs font-medium" style={{ color: 'var(--text2)', marginBottom: 14 }}>{subject.name}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}>{t('subjects.coeff_modal.level_header')}</th>
              {COEFF_SERIES.map(s => <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 70 }}>{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {COEFF_LEVELS.map(lvl => (
              <tr key={lvl} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{lvl}</td>
                {COEFF_SERIES.map(serie => (
                  <td key={serie} style={{ ...tdStyle, textAlign: 'center', padding: '8px 6px' }}>
                    <input type="number" min="0" step="0.5" value={coeffValues[`${lvl}_${serie}`] ?? ''} onChange={e => setCoeffValues(v => ({ ...v, [`${lvl}_${serie}`]: e.target.value }))} placeholder="—" style={{ width: 64, padding: '6px 8px', borderRadius: 8, fontSize: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'center', outline: 'none' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div style={sError}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose}>{t('subjects.coeff_modal.btn_cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: loading ? 0.7 : 1 }} onClick={submitCoeff} disabled={loading}>{loading ? t('subjects.coeff_modal.saving') : t('subjects.coeff_modal.btn_save')}</button>
      </div>
    </ModalOverlay>
  )
}

export function SubjectClassAddModal({
  selectedClass,
  selectedClassName,
  subjects,
  classSubjectIds,
  onClose,
  onAdded,
  onToast,
}: {
  selectedClass: string
  selectedClassName?: string
  subjects: SubjectItem[]
  classSubjectIds: Set<string>
  onClose: () => void
  onAdded: () => void
  onToast: ToastFn
}) {
  const t = useT('admin')
  const [addSubjectId, setAddSubjectId] = useState('')
  const [addCoefficient, setAddCoefficient] = useState('')
  const [addClassOnly, setAddClassOnly] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const handleAddSubject = async () => {
    if (!addSubjectId || !addCoefficient) { setAddError(t('subjects.class_view.add_modal.error_required')); return }
    setAddLoading(true); setAddError('')
    try {
      const res = await fetchApi(`/api/v2/classes/${selectedClass}/subjects`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: addSubjectId, coefficient: parseFloat(addCoefficient), classOnly: addClassOnly }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(addClassOnly ? t('subjects.class_view.add_modal.toast_class_only') : t('subjects.class_view.add_modal.toast_all_level'), 'success')
      onAdded()
      onClose()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.class_view.add_modal.title')}</div>
      <div className="text-xs font-medium" style={{ color: 'var(--text2)', marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: t('subjects.class_view.add_modal.to_label').replace('{name}', selectedClassName ?? '') }} />
      <div className={sLabelCls} style={sLabel}>{t('subjects.class_view.add_modal.subject_label')}</div>
      <select value={addSubjectId} onChange={e => setAddSubjectId(e.target.value)} className={sInputCls} style={sInput}>
        <option value="">{t('subjects.class_view.add_modal.subject_placeholder')}</option>
        {subjects.filter(s => !classSubjectIds.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>)}
      </select>
      <div className={sLabelCls} style={sLabel}>{t('subjects.class_view.add_modal.coeff_label')}</div>
      <input type="number" min="0.5" step="0.5" value={addCoefficient} onChange={e => setAddCoefficient(e.target.value)} className={sInputCls} style={sInput} placeholder={t('subjects.class_view.add_modal.coeff_placeholder')} />

      <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 10, padding: 3, gap: 2, marginBottom: 4, marginTop: 4 }}>
        <button type="button" onClick={() => setAddClassOnly(false)} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: !addClassOnly ? 'var(--surface)' : 'transparent', color: !addClassOnly ? 'var(--text)' : 'var(--text3)', boxShadow: !addClassOnly ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
          {t('subjects.class_view.add_modal.scope_all')}
        </button>
        <button type="button" onClick={() => setAddClassOnly(true)} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: addClassOnly ? 'var(--surface)' : 'transparent', color: addClassOnly ? 'var(--purple)' : 'var(--text3)', boxShadow: addClassOnly ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
          {t('subjects.class_view.add_modal.scope_only')}
        </button>
      </div>
      {!addClassOnly && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{t('subjects.class_view.add_modal.toast_all_level')}</div>}

      {addError && <div style={sError}>{addError}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose}>{t('subjects.class_view.add_modal.btn_cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: addLoading ? 0.7 : 1 }} onClick={handleAddSubject} disabled={addLoading}>{addLoading ? t('subjects.class_view.add_modal.adding') : t('subjects.class_view.add_modal.btn_add')}</button>
      </div>
    </ModalOverlay>
  )
}

export function SubjectAssignTeacherModal({ subject, onClose, onAssigned, onToast }: { subject: SubjectItem; onClose: () => void; onAssigned: () => void; onToast: ToastFn }) {
  const t = useT('admin')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selected, setSelected] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchApi('/api/v2/users?role=TEACHER&limit=100', { credentials: 'include' })
      .then(async res => {
        const data = await res.json()
        if (active && res.ok) setTeachers(data.data || [])
      })
      .catch(() => { /* silencieux */ })
    return () => { active = false }
  }, [])

  const filteredTeachers = teacherSearch
    ? teachers.filter(item => `${item.firstName} ${item.lastName}`.toLowerCase().includes(teacherSearch.toLowerCase()))
    : teachers

  const submitAssign = async () => {
    if (!selected) { setError(t('subjects.assign_modal.error_required')); return }
    setLoading(true); setError('')
    try {
      const res = await fetchApi(`/api/v2/subjects/teachers/${selected.id}/assign`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: subject.id, action: 'ASSIGNER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('subjects.assign_modal.toast_success').replace('{name}', subject.name), 'success')
      onAssigned()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.assign_modal.title')}</div>
      <div className="text-xs font-medium" style={{ color: 'var(--text2)', marginBottom: 14 }}>{subject.name}</div>
      <div className={sLabelCls} style={sLabel}>{t('subjects.assign_modal.search_placeholder')}</div>
      <input className={sInputCls} style={sInput} placeholder={t('subjects.assign_modal.search_placeholder')} value={teacherSearch} onChange={e => { setTeacherSearch(e.target.value); setSelected(null) }} />
      {selected && (
        <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} strokeWidth={2} /> {selected.firstName} {selected.lastName}
        </div>
      )}
      {!selected && (
        <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
          {filteredTeachers.length === 0
            ? <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>{t('subjects.assign_modal.no_teacher')}</div>
            : filteredTeachers.map(item => (
              <div key={item.id} onClick={() => { setSelected(item); setTeacherSearch(`${item.firstName} ${item.lastName}`) }} style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--bg2)', color: 'var(--text)' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                {item.firstName} {item.lastName}
              </div>
            ))}
        </div>
      )}
      {error && <div style={sError}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose}>{t('subjects.assign_modal.btn_cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: loading ? 0.7 : 1 }} onClick={submitAssign} disabled={loading}>{loading ? t('subjects.assign_modal.assigning') : t('subjects.assign_modal.btn_assign')}</button>
      </div>
    </ModalOverlay>
  )
}
