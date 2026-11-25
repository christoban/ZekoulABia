'use client'

import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { Loader2 } from 'lucide-react'
import type { ClassItem, StaffPermission, StaffTitle, SubjectOption } from './types'
import { Field, PasswordOnceNotice, sErr, sIn, sInCls, sLb, sLbCls } from './UserSharedPrimitives'

interface UserCreateModalProps {
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  staffTitles: StaffTitle[]
}

const EMPTY_CREATE_USER = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'TEACHER' as 'TEACHER' | 'STUDENT' | 'PARENT' | 'STAFF',
  subjectIds: [] as string[],
  classeId: '',
  dateOfBirth: '',
  gender: '',
  staffTitle: '',
  staffPermissions: [] as StaffPermission[],
  loading: false,
  error: '',
}

export default function UserCreateModal({ onClose, onSuccess, onToast, staffTitles }: UserCreateModalProps) {
  const t = useT('admin')
  const [form, setForm] = useState(EMPTY_CREATE_USER)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [availClasses, setAvailClasses] = useState<ClassItem[]>([])
  const [availSubjects, setAvailSubjects] = useState<SubjectOption[]>([])

  useEffect(() => {
    let active = true
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }),
      fetchApi('/api/v2/subjects', { credentials: 'include' }),
    ]).then(async ([cRes, sRes]) => {
      if (!active) return
      if (cRes.ok) { const d = await cRes.json(); setAvailClasses(d.data || []) }
      if (sRes.ok) { const d = await sRes.json(); setAvailSubjects(d.data || []) }
    }).catch(() => { /* silencieux */ })
    return () => { active = false }
  }, [])

  const setField = (field: string, val: unknown) =>
    setForm(prev => ({ ...prev, [field]: val }))

  const selectedClassCycle = availClasses.find(c => c.id === form.classeId)?.cycle ?? null
  const isEleveMaternellePrimaire = form.role === 'STUDENT' && (selectedClassCycle === 'maternelle' || selectedClassCycle === 'primaire')

  const toggleSubjectId = (id: string) => {
    setForm(prev => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(id)
        ? prev.subjectIds.filter(x => x !== id)
        : [...prev.subjectIds, id],
    }))
  }

  const submitCreateUser = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setField('error', t('users.create_modal.errors.required'))
      return
    }
    setField('loading', true)
    setField('error', '')
    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role,
        password: 'ZekoulABia2025!',
      }
      if (!isEleveMaternellePrimaire) {
        if (form.email.trim()) body.email = form.email.trim()
        if (form.phone.trim()) body.phone = form.phone.trim()
      }
      if (form.role === 'TEACHER') {
        if (form.subjectIds.length > 0) body.subjectIds = form.subjectIds
      } else if (form.role === 'STUDENT') {
        if (form.classeId) body.classeId = form.classeId
        if (form.dateOfBirth) body.dateOfBirth = form.dateOfBirth
        if (form.gender) body.gender = form.gender
      } else if (form.role === 'STAFF') {
        if (form.staffTitle) body.staffTitle = form.staffTitle
        if (form.staffPermissions.length > 0) body.staffPermissions = form.staffPermissions
      }

      const res = await fetchApi('/api/v2/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { success?: boolean; message?: string; data?: { motDePasseTemporaire?: string } }
      if (!res.ok) throw new Error(data.message || 'Erreur')
      const motDePasseTemporaire = data.data?.motDePasseTemporaire
      if (motDePasseTemporaire) {
        setTempPassword(motDePasseTemporaire)
        return
      }
      onToast(t('users.create_modal.toast_success').replace('{name}', `${form.firstName} ${form.lastName}`), 'success')
      onSuccess()
      onClose()
    } catch (err) {
      setField('error', err instanceof Error ? err.message : 'Erreur')
    } finally {
      setField('loading', false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-5 md:px-7 md:py-6" style={{ background: 'var(--surface)', borderRadius: 16, width: 520, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="text-[16px] md:text-[18px] mb-[12px] md:mb-[16px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
          {t('users.create_modal.title')}
        </div>

        {tempPassword ? (
          <PasswordOnceNotice
            password={tempPassword}
            onClose={() => {
              onSuccess()
              onClose()
            }}
          />
        ) : (
          <>
            <div className="gap-[10px] md:gap-[12px]" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <Field label={t('users.create_modal.first_name_label')}>
                <input value={form.firstName} onChange={e => setField('firstName', e.target.value)} placeholder="Marie" className={sInCls} style={sIn} />
              </Field>
              <Field label={t('users.create_modal.last_name_label')}>
                <input value={form.lastName} onChange={e => setField('lastName', e.target.value)} placeholder="Ngono" className={sInCls} style={sIn} />
              </Field>
            </div>

            {!isEleveMaternellePrimaire && (
              <>
                <Field label={t('users.create_modal.email_label')}>
                  <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="marie@lycee.cm" className={sInCls} style={sIn} />
                </Field>
                <Field label={t('users.create_modal.phone_label')}>
                  <input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="691234567" className={sInCls} style={sIn} />
                </Field>
              </>
            )}

            <Field label={t('users.create_modal.role_label')}>
              <select value={form.role} onChange={e => setField('role', e.target.value)} className={sInCls} style={sIn}>
                <option value="TEACHER">{t('users.invite_modal.role_teacher')}</option>
                <option value="STUDENT">{t('users.invite_modal.role_student')}</option>
                <option value="PARENT">{t('users.invite_modal.role_parent')}</option>
                <option value="STAFF">{t('users.invite_modal.role_staff')}</option>
              </select>
            </Field>

            {form.role === 'TEACHER' && (
              <div>
                <div className={sLbCls} style={sLb}>{t('users.create_modal.subjects_label')}</div>
                <div style={{ border: '1.5px solid var(--border)', borderRadius: 9, maxHeight: 150, overflowY: 'auto', padding: 4 }}>
                  {availSubjects.length === 0 && <div style={{ padding: 10, color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>{t('users.i18n_ext.form.noSubjects')}</div>}
                  {availSubjects.map(sub => {
                    const checked = form.subjectIds.includes(sub.id)
                    return (
                      <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: checked ? 'var(--green-light)' : 'transparent' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSubjectId(sub.id)} style={{ accentColor: 'var(--green)', width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sub.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {form.role === 'STUDENT' && (
              <>
                <Field label={t('users.create_modal.class_label')}>
                  <select value={form.classeId} onChange={e => setField('classeId', e.target.value)} className={sInCls} style={sIn}>
                    <option value="">{t('users.i18n_ext.form.selectClass')}</option>
                    {availClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                {isEleveMaternellePrimaire && (
                  <div style={{ padding: '8px 12px', background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, color: 'var(--amber)', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>
                    {t('users.create_modal.maternellePrimaireNote')}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label={t('users.create_modal.dob_label')}>
                    <input type="date" value={form.dateOfBirth} onChange={e => setField('dateOfBirth', e.target.value)} className={sInCls} style={sIn} />
                  </Field>
                  <Field label={t('users.create_modal.gender_label')}>
                    <select value={form.gender} onChange={e => setField('gender', e.target.value)} className={sInCls} style={sIn}>
                      <option value="">—</option>
                      <option value="M">{t('users.i18n_ext.form.male')}</option>
                      <option value="F">{t('users.i18n_ext.form.female')}</option>
                    </select>
                  </Field>
                </div>
              </>
            )}

            {form.role === 'STAFF' && (
              <Field label={t('users.create_modal.staff_title_label')}>
                <select value={form.staffTitle} onChange={e => setField('staffTitle', e.target.value)} className={sInCls} style={sIn}>
                  <option value="">{t('users.i18n_ext.form.selectPost')}</option>
                  {staffTitles.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                </select>
              </Field>
            )}

            {form.error && <div style={sErr}>{form.error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button style={{ flex: 1, padding: '7.5px 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={onClose}>
                {t('users.i18n_ext.actions.cancel')}
              </button>
              <button style={{ flex: 1, padding: '7.5px 12px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: form.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: form.loading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={submitCreateUser} disabled={form.loading}>
                {form.loading ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : t('users.create_modal.btn_create')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
