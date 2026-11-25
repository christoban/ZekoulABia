'use client'
import { Calendar } from 'lucide-react'
import { catchSLb, catchSIn, type CatchupFormState, type TranslateFn } from './types'

interface Props {
  catchup: CatchupFormState
  catchupClasses: { id: string; name: string }[]
  teacherSubjects: { subject: { id: string; name: string } }[]
  onChange: (updater: (prev: CatchupFormState) => CatchupFormState) => void
  onClose: () => void
  onSubmit: () => void
  t: TranslateFn
}

export default function TimetableCatchupModal({
  catchup,
  catchupClasses,
  teacherSubjects,
  onChange,
  onClose,
  onSubmit,
  t,
}: Props) {
  if (!catchup.open) return null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-4 py-5 md:px-6 md:py-6" style={{ background: 'var(--surface)', borderRadius: 14, width: 440, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('timetable.catchup_title')}</div>
        <div style={catchSLb}>{t('timetable.catchup_class_label')}</div>
        <select style={catchSIn} value={catchup.classId} onChange={e => onChange(f => ({ ...f, classId: e.target.value }))}>
          <option value="">{t('timetable.catchup_class_placeholder')}</option>
          {catchupClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={catchSLb}>{t('timetable.catchup_date_label')}</div>
        <input style={catchSIn} type="date" value={catchup.proposedDate} onChange={e => onChange(f => ({ ...f, proposedDate: e.target.value }))} />
        <div style={catchSLb}>{t('timetable.catchup_subject_label')}</div>
        <select style={catchSIn} value={catchup.subjectId} onChange={e => onChange(f => ({ ...f, subjectId: e.target.value }))}>
          <option value="">{t('timetable.catchup_subject_placeholder')}</option>
          {teacherSubjects.map(ts => (
            <option key={ts.subject.id} value={ts.subject.id}>{ts.subject.name}</option>
          ))}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={catchSLb}>{t('timetable.catchup_start_label')}</div>
            <input style={catchSIn} type="time" value={catchup.proposedStartTime} onChange={e => onChange(f => ({ ...f, proposedStartTime: e.target.value }))} />
          </div>
          <div>
            <div style={catchSLb}>{t('timetable.catchup_end_label')}</div>
            <input style={catchSIn} type="time" value={catchup.proposedEndTime} onChange={e => onChange(f => ({ ...f, proposedEndTime: e.target.value }))} />
          </div>
        </div>
        <div style={catchSLb}>{t('timetable.catchup_reason_label')}</div>
        <textarea style={{ ...catchSIn, minHeight: 60, resize: 'vertical' }} value={catchup.reason} onChange={e => onChange(f => ({ ...f, reason: e.target.value }))} placeholder={t('timetable.catchup_reason_placeholder')} />
        {catchup.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{catchup.error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button style={{ flex: 1, padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={onClose}>{t('timetable.catchup_cancel')}</button>
          <button style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: catchup.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: catchup.loading ? 0.7 : 1 }} onClick={onSubmit} disabled={catchup.loading}>
            <Calendar size={13} strokeWidth={2} />{catchup.loading ? t('timetable.catchup_submit_loading') : t('timetable.catchup_submit')}
          </button>
        </div>
      </div>
    </div>
  )
}
