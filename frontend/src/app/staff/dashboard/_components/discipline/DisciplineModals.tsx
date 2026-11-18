'use client'
import type React from 'react'
import { Check, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  type Composition,
  type ConvokeFormState,
  EMPTY_COMPOSITION,
  type FormState,
  SEVERE_TYPES,
  type StudentResult,
  TYPE_STYLE,
  type TenirFormState,
  btnPrim,
  btnSec,
  inputSt,
  labelSt,
} from './disciplineTypes'

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200,
}

const modalBoxBase: React.CSSProperties = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201,
  background: 'var(--surface)', borderRadius: 16, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
}

function DisciplineStudentPicker({
  selectedStudent,
  studentSearch,
  studentResults,
  onClear,
  onSearchChange,
  onSelect,
  hoverable,
}: {
  selectedStudent: StudentResult | null
  studentSearch: string
  studentResults: StudentResult[]
  onClear: () => void
  onSearchChange: (value: string) => void
  onSelect: (student: StudentResult) => void
  hoverable?: boolean
}) {
  const t = useT('discipline')
  return (
    <div>
      <label style={labelSt}>{t('form_fields.student_label')}</label>
      {selectedStudent ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 8, border: '1px solid rgba(142,42,58,0.3)' }}>
          <span style={{ fontWeight: 700, color: 'var(--green)', flex: 1, display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <Check size={14} strokeWidth={2} /> {selectedStudent.firstName} {selectedStudent.lastName}
          </span>
          <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 14, display: 'inline-flex' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            value={studentSearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={t('form_fields.student_placeholder')}
            style={inputSt}
          />
          {studentResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
              {studentResults.map(s => (
                <div
                  key={s.id}
                  onClick={() => onSelect(s)}
                  style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--bg)' }}
                  onMouseEnter={hoverable ? e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' : undefined}
                  onMouseLeave={hoverable ? e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)' : undefined}
                >
                  {s.firstName} {s.lastName}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SanctionModal({
  form,
  setForm,
  needsDates,
  onSearchStudents,
  onSubmit,
  onClose,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  needsDates: boolean
  onSearchStudents: (q: string) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('discipline')
  return (
    <>
      <div onClick={onClose} style={overlayStyle} />
      <div className="px-5 py-5 md:px-7 md:py-6" style={{ ...modalBoxBase, width: 500 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif)', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{t('modal_title')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <DisciplineStudentPicker
            selectedStudent={form.selectedStudent}
            studentSearch={form.studentSearch}
            studentResults={form.studentResults}
            onClear={() => setForm(f => ({ ...f, selectedStudent: null, studentSearch: '', studentResults: [] }))}
            onSearchChange={val => { setForm(f => ({ ...f, studentSearch: val })); onSearchStudents(val) }}
            onSelect={s => setForm(f => ({ ...f, selectedStudent: s, studentSearch: '', studentResults: [] }))}
            hoverable
          />
          <div>
            <label style={labelSt}>{t('form_fields.type_label')}</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputSt}>
              {Object.keys(TYPE_STYLE).map(k => <option key={k} value={k}>{t(`sanction_types.${k}`)}</option>)}
            </select>
            {SEVERE_TYPES.includes(form.type) && (
              <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--purple-light)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--purple)' }}>
                {t('validation.severe_requires_council')}
              </div>
            )}
          </div>
          <div>
            <label style={labelSt}>{t('form_fields.reason_label')}</label>
            <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} placeholder={t('form_fields.reason_placeholder')} style={{ ...inputSt, resize: 'vertical' }} />
          </div>
          {needsDates && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelSt}>{t('form_fields.start_date_label')}</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>{t('form_fields.end_date_label')}</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={inputSt} />
              </div>
            </div>
          )}
          {form.error && (
            <div style={{ padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{form.error}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button style={btnSec} onClick={onClose}>{t('actions.cancel')}</button>
            <button style={btnPrim} onClick={onSubmit} disabled={form.loading}>{form.loading ? t('actions.saving') : t('actions.save')}</button>
          </div>
        </div>
      </div>
    </>
  )
}

export function ConvokeCouncilModal({
  form,
  setForm,
  onSearchStudents,
  onSubmit,
  onClose,
}: {
  form: ConvokeFormState
  setForm: React.Dispatch<React.SetStateAction<ConvokeFormState>>
  onSearchStudents: (q: string) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('discipline')
  return (
    <>
      <div onClick={onClose} style={overlayStyle} />
      <div className="px-5 py-5 md:px-7 md:py-6" style={{ ...modalBoxBase, width: 540 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif)', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('council.convoke_modal_title')}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>{t('council.convoke_modal_hint')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <DisciplineStudentPicker
            selectedStudent={form.selectedStudent}
            studentSearch={form.studentSearch}
            studentResults={form.studentResults}
            onClear={() => setForm(f => ({ ...f, selectedStudent: null, studentSearch: '', studentResults: [] }))}
            onSearchChange={val => { setForm(f => ({ ...f, studentSearch: val })); onSearchStudents(val) }}
            onSelect={s => setForm(f => ({ ...f, selectedStudent: s, studentSearch: '', studentResults: [] }))}
          />
          <div>
            <label style={labelSt}>{t('council.form_fields.motif_label')}</label>
            <textarea value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelSt}>{t('council.form_fields.scheduled_label')}</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} style={inputSt} />
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{t('council.form_fields.scheduled_hint')}</div>
          </div>
          <div>
            <label style={labelSt}>{t('council.form_fields.composition_label')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(Object.keys(EMPTY_COMPOSITION) as (keyof Composition)[]).map(role => (
                <input
                  key={role}
                  value={form.composition[role]}
                  onChange={e => setForm(f => ({ ...f, composition: { ...f.composition, [role]: e.target.value } }))}
                  placeholder={t(`council.composition_roles.${role}`)}
                  style={inputSt}
                />
              ))}
            </div>
          </div>
          {form.error && (
            <div style={{ padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{form.error}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button style={btnSec} onClick={onClose}>{t('actions.cancel')}</button>
            <button style={btnPrim} onClick={onSubmit} disabled={form.loading}>{form.loading ? t('actions.saving') : t('council.actions.convoke')}</button>
          </div>
        </div>
      </div>
    </>
  )
}

export function TenirCouncilModal({
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  form: TenirFormState
  setForm: React.Dispatch<React.SetStateAction<TenirFormState>>
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('discipline')
  return (
    <>
      <div onClick={onClose} style={overlayStyle} />
      <div className="px-5 py-5 md:px-7 md:py-6" style={{ ...modalBoxBase, width: 480 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif)', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{t('council.tenir_modal_title')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div>
            <label style={labelSt}>{t('council.form_fields.decision_label')}</label>
            <select value={form.decision} onChange={e => setForm(f => ({ ...f, decision: e.target.value }))} style={inputSt}>
              <option value="COUNCIL_DECISION">{t('sanction_types.COUNCIL_DECISION')}</option>
              <option value="PERMANENT_EXCLUSION">{t('sanction_types.PERMANENT_EXCLUSION')}</option>
            </select>
          </div>
          <div>
            <label style={labelSt}>{t('council.form_fields.pv_label')}</label>
            <textarea value={form.pv} onChange={e => setForm(f => ({ ...f, pv: e.target.value }))} rows={4} placeholder={t('council.form_fields.pv_placeholder')} style={{ ...inputSt, resize: 'vertical' }} />
          </div>
          {form.error && (
            <div style={{ padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{form.error}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button style={btnSec} onClick={onClose}>{t('actions.cancel')}</button>
            <button style={btnPrim} onClick={onSubmit} disabled={form.loading}>{form.loading ? t('actions.saving') : t('council.actions.hold')}</button>
          </div>
        </div>
      </div>
    </>
  )
}
