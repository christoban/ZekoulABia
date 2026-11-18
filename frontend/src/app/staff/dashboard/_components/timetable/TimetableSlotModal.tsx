'use client'
import { AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { TimetableSlot } from '@/features/timetable/timetableShared'
import { TimetableSpinner } from './TimetablePrimitives'
import { type Assignment, FREE_VALUE, btnPrim, btnSec, inputSt, labelSt } from './timetableStaffTypes'

interface Props {
  modalSlot: TimetableSlot
  modalSubjectId: string
  modalTeacherId: string
  modalTeacherName: string
  modalIsLV2Slot: boolean
  setModalIsLV2Slot: (val: boolean) => void
  assignments: Assignment[]
  lv2SubjectIds: Set<string>
  saving: boolean
  conflictMsg: string | null
  onSubjectSelect: (subjectId: string) => void
  onClose: () => void
  onSave: () => void
  onClear: () => void
}

export default function TimetableSlotModal({
  modalSlot,
  modalSubjectId,
  modalTeacherId,
  modalTeacherName,
  modalIsLV2Slot,
  setModalIsLV2Slot,
  assignments,
  lv2SubjectIds,
  saving,
  conflictMsg,
  onSubjectSelect,
  onClose,
  onSave,
  onClear,
}: Props) {
  const t = useT('staff')

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="px-5 py-5 md:px-6 md:py-6" style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 18px 50px rgba(0,0,0,0.18)' }}>
        <div style={{ fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
          {t('timetable.fillSlotTitle')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
          {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][modalSlot.dayOfWeek]} · {modalSlot.startTime}–{modalSlot.endTime}
        </div>

        {conflictMsg && (
          <div style={{ background: 'var(--orange-light)', border: '1px solid var(--orange-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 13, fontSize: 12, color: 'var(--amber)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={13} strokeWidth={2} /> {conflictMsg}
          </div>
        )}

        <div style={{ marginBottom: 13 }}>
          <label style={labelSt}>{t('timetable.subjectLabel')}</label>
          <select value={modalSubjectId} onChange={e => onSubjectSelect(e.target.value)} style={inputSt}>
            <option value="">{t('timetable.selectSubjectPlaceholder')}</option>
            <option value={FREE_VALUE}>{t('timetable.freeTime')}</option>
            {assignments.map(a => (
              <option key={a.subjectId} value={a.subjectId}>
                {a.subjectName} {a.coefficient > 0 ? t('timetable.coefficientTag', { coeff: a.coefficient }) : ''}
                {a.currentTeacherId ? '' : ` — ${t('timetable.unassigned')}`}
              </option>
            ))}
          </select>
        </div>

        {lv2SubjectIds.has(modalSubjectId) && (
          <div style={{ marginBottom: 13 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', background: modalIsLV2Slot ? 'rgba(3,105,161,0.06)' : 'var(--bg)', border: `1px solid ${modalIsLV2Slot ? 'rgba(3,105,161,0.35)' : 'var(--border)'}`, borderRadius: 8, padding: '9px 11px' }}>
              <input
                type="checkbox"
                checked={modalIsLV2Slot}
                onChange={e => setModalIsLV2Slot(e.target.checked)}
                style={{ width: 15, height: 15, marginTop: 1, cursor: 'pointer', accentColor: 'var(--blue)', flexShrink: 0 }}
              />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                {t('timetable.lv2SlotLabel')}
                <span style={{ display: 'block', fontWeight: 400, color: 'var(--text3)', fontSize: 11.5, marginTop: 1 }}>
                  {t('timetable.lv2SlotDesc')}
                </span>
              </span>
            </label>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={labelSt}>{t('timetable.teacherLabel')} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{t('timetable.teacherSubLabel')}</span></label>
          <div style={{ ...inputSt, background: 'var(--bg)', color: modalTeacherId ? 'var(--text)' : 'var(--text3)', pointerEvents: 'none' as const }}>
            {modalTeacherId ? modalTeacherName : t('timetable.determinedByAssignments')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {modalSlot.subject && (
            <button style={{ ...btnSec, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)' }} onClick={onClear} disabled={saving}>
              {t('timetable.clear')}
            </button>
          )}
          <button style={btnSec} onClick={onClose} disabled={saving}>{t('timetable.cancel')}</button>
          <button style={btnPrim} onClick={onSave} disabled={saving || !modalSubjectId}>
            {saving ? <><TimetableSpinner /> {t('timetable.savingSlot')}</> : t('timetable.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
