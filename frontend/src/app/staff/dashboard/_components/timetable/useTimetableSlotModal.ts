'use client'
import { useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import type { TimetableData as Timetable, TimetableSlot } from '@/features/timetable/timetableShared'
import { type Assignment, FREE_VALUE, lireReponseJson } from './timetableStaffTypes'

interface UseTimetableSlotModalParams {
  timetable: Timetable | null
  setTimetable: React.Dispatch<React.SetStateAction<Timetable | null>>
  assignments: Assignment[]
  lv2SubjectIds: Set<string>
  fetchTimetable: (cid?: string) => Promise<void>
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export function useTimetableSlotModal({
  timetable,
  setTimetable,
  assignments,
  lv2SubjectIds,
  fetchTimetable,
  onToast,
  t,
}: UseTimetableSlotModalParams) {
  const [modalSlot, setModalSlot] = useState<TimetableSlot | null>(null)
  const [modalSubjectId, setModalSubjectId] = useState('')
  const [modalTeacherId, setModalTeacherId] = useState('')
  const [modalTeacherName, setModalTeacherName] = useState('')
  const [modalIsLV2Slot, setModalIsLV2Slot] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflictMsg, setConflictMsg] = useState<string | null>(null)

  const openModal = (slot: TimetableSlot) => {
    setModalSlot(slot)
    setModalSubjectId(slot.kind === 'FREE' ? FREE_VALUE : slot.subject?.id ?? '')
    setModalTeacherId(slot.teacher?.id ?? '')
    setModalTeacherName(slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '')
    setModalIsLV2Slot(slot.isLV2Slot ?? false) // reflète la valeur actuelle à l'édition
    setConflictMsg(null)
  }

  const openEmptyModal = (slot: TimetableSlot) => {
    setModalSlot(slot)
    setModalSubjectId('')
    setModalTeacherId('')
    setModalTeacherName('')
    setModalIsLV2Slot(false)
    setConflictMsg(null)
  }

  const handleSubjectSelect = (subjectId: string) => {
    setModalSubjectId(subjectId)
    setConflictMsg(null)
    setModalIsLV2Slot(subjectId !== FREE_VALUE && lv2SubjectIds.has(subjectId))
    if (!subjectId || subjectId === FREE_VALUE) {
      setModalTeacherId('')
      setModalTeacherName('')
      return
    }
    const aff = assignments.find(a => a.subjectId === subjectId)
    setModalTeacherId(aff?.currentTeacherId ?? '')
    setModalTeacherName(aff?.currentTeacherName ?? (aff?.currentTeacherId ? t('timetable.assignedTeacher') : t('timetable.unassigned')))
  }

  const handleSaveSlot = async () => {
    if (!modalSlot || !timetable) return
    setSaving(true)
    setConflictMsg(null)
    try {
      // Vérification conflit avant envoi
      if (modalTeacherId) {
        const excludeSlotId = modalSlot.id ? `&excludeSlotId=${encodeURIComponent(modalSlot.id)}` : ''
        const chkRes = await fetchApi(
          `/api/v2/timetables/check-conflict?teacherId=${modalTeacherId}&dayOfWeek=${modalSlot.dayOfWeek}&startTime=${encodeURIComponent(modalSlot.startTime)}${excludeSlotId}`,
          { credentials: 'include' }
        )
        const chkData = await lireReponseJson<{
          data?: { hasConflict?: boolean; conflictClass?: string }
        }>(chkRes)
        if (chkData.data?.hasConflict) {
          setConflictMsg(t('timetable.conflictPrefix', { conflictClass: chkData.data.conflictClass ?? '' }))
          setSaving(false)
          return
        }
      }

      const isNewSlot = !modalSlot.id
      const res = await fetchApi(
        isNewSlot
          ? `/api/v2/timetables/${timetable.id}/slots`
          : `/api/v2/timetables/${timetable.id}/slots/${modalSlot.id}`,
        {
          method: isNewSlot ? 'POST' : 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayOfWeek: modalSlot.dayOfWeek,
            startTime: modalSlot.startTime,
            endTime: modalSlot.endTime,
            subjectId: modalSubjectId === FREE_VALUE ? null : modalSubjectId || null,
            teacherId: modalTeacherId || null,
            kind: modalSubjectId === FREE_VALUE ? 'FREE' : 'CLASS',
            isLV2Slot: lv2SubjectIds.has(modalSubjectId) ? modalIsLV2Slot : false,
          }),
        }
      )
      const data = await lireReponseJson<{
        data?: Partial<TimetableSlot>
        message?: string
        code?: string
      }>(res)
      if (!res.ok) {
        if (data.code === 'CONFLIT_HORAIRE') { setConflictMsg(data.message ?? 'Erreur'); return }
        if (data.code === 'VOLUME_AP_DEPASSE') { setConflictMsg(data.message ?? 'Erreur'); return }
        throw new Error(data.message || 'Erreur sauvegarde')
      }

      if (isNewSlot) {
        setModalSlot(null)
        await fetchTimetable()
        onToast(t('timetable.slotUpdated'), 'success')
        return
      }

      setTimetable(prev => prev ? {
        ...prev,
        slots: prev.slots.map(s => s.id === modalSlot.id ? { ...s, ...data.data } : s),
      } : prev)

      setModalSlot(null)
      onToast(t('timetable.slotUpdated'), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClearSlot = async () => {
    if (!modalSlot) return
    setSaving(true)
    try {
      if (!modalSlot.id) {
        const res = await fetchApi(`/api/v2/timetables/${timetable?.id}/slots`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayOfWeek: modalSlot.dayOfWeek,
            startTime: modalSlot.startTime,
            endTime: modalSlot.endTime,
            kind: modalSubjectId === FREE_VALUE ? 'FREE' : 'CLASS',
            subjectId: modalSubjectId === FREE_VALUE ? null : modalSubjectId || null,
            teacherId: modalTeacherId || null,
            isLV2Slot: lv2SubjectIds.has(modalSubjectId) ? modalIsLV2Slot : false,
          }),
        })
        const data = await lireReponseJson<{
          data?: Partial<TimetableSlot>
          message?: string
          code?: string
        }>(res)
        if (!res.ok) {
          if (data.code === 'CONFLIT_HORAIRE') { setConflictMsg(data.message ?? 'Erreur'); return }
          if (data.code === 'VOLUME_AP_DEPASSE') { setConflictMsg(data.message ?? 'Erreur'); return }
          throw new Error(data.message || 'Erreur sauvegarde')
        }
        setModalSlot(null)
        await fetchTimetable()
        onToast(t('timetable.slotUpdated'), 'success')
        return
      }

      const res = await fetchApi(`/api/v2/timetables/slots/${modalSlot.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setTimetable(prev => prev ? {
        ...prev,
        slots: prev.slots.filter(s => s.id !== modalSlot.id),
      } : prev)
      setModalSlot(null)
      onToast('Créneau vidé', 'info')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(false)
    }
  }

  return {
    modalSlot,
    setModalSlot,
    modalSubjectId,
    modalTeacherId,
    modalTeacherName,
    modalIsLV2Slot,
    setModalIsLV2Slot,
    saving,
    conflictMsg,
    openModal,
    openEmptyModal,
    handleSubjectSelect,
    handleSaveSlot,
    handleClearSlot,
  }
}
