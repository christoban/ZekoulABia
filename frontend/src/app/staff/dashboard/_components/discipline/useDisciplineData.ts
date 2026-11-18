'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import type { useSyncQueue } from '@/hooks/useSyncQueue'
import {
  type ConvokeFormState,
  type CouncilSession,
  type DisciplineRecord,
  EMPTY_CONVOKE_FORM,
  EMPTY_FORM,
  EMPTY_TENIR_FORM,
  type FormState,
  SEVERE_TYPES,
  type StudentResult,
  type TenirFormState,
} from './disciplineTypes'

interface UseDisciplineDataParams {
  isOnline: boolean
  addToQueue: ReturnType<typeof useSyncQueue>['addToQueue']
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  t: (key: string, params?: Record<string, string | number>) => string
}

async function searchStudentUsers(q: string): Promise<StudentResult[]> {
  if (q.trim().length < 2) return []
  try {
    const res = await fetchApi(`/api/v2/users?role=STUDENT&search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
    const data = await res.json()
    return data.data || []
  } catch {
    return []
  }
}

export function useDisciplineData({ isOnline, addToQueue, onToast, t }: UseDisciplineDataParams) {
  const [records, setRecords] = useState<DisciplineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [liftingId, setLiftingId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [view, setView] = useState<'sanctions' | 'council'>('sanctions')

  const [councilSessions, setCouncilSessions] = useState<CouncilSession[]>([])
  const [councilLoading, setCouncilLoading] = useState(true)
  const [convokeForm, setConvokeForm] = useState<ConvokeFormState>(EMPTY_CONVOKE_FORM)
  const [tenirForm, setTenirForm] = useState<TenirFormState>(EMPTY_TENIR_FORM)

  const fetchCouncilSessions = useCallback(async () => {
    const cached = await getCachedData<CouncilSession[]>('staff:discipline:council-sessions')
    if (cached?.data && Array.isArray(cached.data)) {
      setCouncilSessions(cached.data)
      setCouncilLoading(false)
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setCouncilLoading(false)
      return
    }
    setCouncilLoading(true)
    try {
      const res = await fetchApi('/api/v2/discipline-council', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      const list = data.data || []
      setCouncilSessions(list)
      await putCachedData('staff:discipline:council-sessions', list)
    } catch (err) {
      if (!cached) {
        onToast(err instanceof Error ? err.message : t('council.toasts.load_error'), 'error')
      }
    } finally {
      setCouncilLoading(false)
    }
  }, [onToast, t])

  useEffect(() => { if (view === 'council') fetchCouncilSessions() }, [view, fetchCouncilSessions])

  const searchConvokeStudents = async (q: string) => {
    const results = await searchStudentUsers(q)
    setConvokeForm(f => ({ ...f, studentResults: results }))
  }

  const submitConvoke = async () => {
    const { selectedStudent, motif, scheduledAt, composition } = convokeForm
    if (!selectedStudent) { setConvokeForm(f => ({ ...f, error: t('validation.student_required') })); return }
    if (!motif.trim() || !scheduledAt) { setConvokeForm(f => ({ ...f, error: t('council.validation.motif_date_required') })); return }
    if (Object.values(composition).some(v => !v.trim())) { setConvokeForm(f => ({ ...f, error: t('council.validation.composition_required') })); return }
    setConvokeForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/discipline-council/convoquer', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent.id, motif: motif.trim(), scheduledAt, composition }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('council.toasts.convoked', { student: `${selectedStudent.firstName} ${selectedStudent.lastName}` }), 'success')
      setConvokeForm(EMPTY_CONVOKE_FORM)
      fetchCouncilSessions()
    } catch (err) {
      setConvokeForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const submitTenir = async () => {
    const { sessionId, decision, pv, startDate, endDate } = tenirForm
    if (!pv.trim()) { setTenirForm(f => ({ ...f, error: t('council.validation.pv_required') })); return }
    setTenirForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/discipline-council/${sessionId}/tenir`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, pv: pv.trim(), startDate: startDate || undefined, endDate: endDate || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('council.toasts.held'), 'success')
      setTenirForm(EMPTY_TENIR_FORM)
      fetchCouncilSessions()
    } catch (err) {
      setTenirForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const downloadPV = async (sessionId: string) => {
    try {
      const r = await fetchApi(`/api/v2/discipline-council/${sessionId}/pv.pdf`, { credentials: 'include' })
      if (!r.ok) throw new Error(t('council.toasts.pv_error'))
      const blob = await r.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'pv-conseil-discipline.pdf'
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('council.toasts.pv_error'), 'error')
    }
  }

  const fetchRecords = useCallback(async () => {
    const cacheKey = `staff:discipline:${typeFilter || 'ALL'}:${statusFilter || 'ALL'}`
    const cached = await getCachedData<DisciplineRecord[]>(cacheKey)
    if (cached?.data && Array.isArray(cached.data)) {
      setRecords(cached.data)
      setLoading(false)
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetchApi(`/api/v2/discipline?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      const list = data.data || []
      setRecords(list)
      await putCachedData(cacheKey, list)
    } catch (err) {
      if (!cached?.data) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement')
      }
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'disciplineRecord') fetchRecords()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchRecords])

  const searchStudents = async (q: string) => {
    const results = await searchStudentUsers(q)
    setForm(f => ({ ...f, studentResults: results }))
  }

  const submitSanction = async () => {
    const { selectedStudent, type, reason, startDate, endDate } = form
    if (!selectedStudent) { setForm(f => ({ ...f, error: t('validation.student_required') })); return }
    if (!type || !reason.trim()) { setForm(f => ({ ...f, error: t('validation.type_reason_required') })); return }
    if (SEVERE_TYPES.includes(type)) { setForm(f => ({ ...f, error: t('validation.severe_requires_council') })); return }

    const payload = { studentId: selectedStudent.id, type, reason: reason.trim(), startDate: startDate || undefined, endDate: endDate || undefined }
    const studentName = `${selectedStudent.firstName} ${selectedStudent.lastName}`

    if (!isOnline) {
      await addToQueue({ type: 'DISCIPLINE_SANCTION', endpoint: '/api/v2/discipline', method: 'POST', payload })
      onToast(t('toasts.sanction_queued', { student: studentName }), 'success')
      setForm(EMPTY_FORM)
      return
    }

    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/discipline', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('toasts.sanction_saved', { student: studentName }), 'success')
      setForm(EMPTY_FORM)
      fetchRecords()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const liftSanction = async (recordId: string, studentName: string) => {
    if (!(await confirmAction(t('toasts.confirm_lift', { student: studentName })))) return

    if (!isOnline) {
      await addToQueue({ type: 'DISCIPLINE_SANCTION_LIFT', endpoint: `/api/v2/discipline/${recordId}/lift`, method: 'PATCH', payload: {} })
      onToast(t('toasts.sanction_lift_queued'), 'success')
      return
    }

    setLiftingId(recordId)
    try {
      const res = await fetchApi(`/api/v2/discipline/${recordId}/lift`, { method: 'PATCH', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('toasts.sanction_lifted'), 'success')
      fetchRecords()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setLiftingId(null)
    }
  }

  return {
    records, loading, error, form, setForm, liftingId,
    typeFilter, setTypeFilter, statusFilter, setStatusFilter,
    view, setView, councilSessions, councilLoading,
    convokeForm, setConvokeForm, tenirForm, setTenirForm,
    searchConvokeStudents, submitConvoke, submitTenir, downloadPV,
    fetchRecords, searchStudents, submitSanction, liftSanction,
  }
}
