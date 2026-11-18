'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import type {
  AttendanceRowState,
  DocFormState,
  EmployeeDetail,
  EmployeeItem,
  LeaveRequestItem,
  LeaveStatus,
  OnToast,
  RhDocType,
  RhTab,
} from './types'

function isNetworkError(error: unknown): boolean {
  const errMsg = error instanceof Error ? error.message : String(error)
  return (
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    errMsg.includes('fetch') ||
    errMsg.includes('Network')
  )
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export function useRhData(onToast: OnToast) {
  const t = useT('admin')
  const [tab, setTab] = useState<RhTab>('personnel')
  const [employees, setEmployees] = useState<EmployeeItem[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<EmployeeDetail | null>(null)
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [refreshingBalance, setRefreshingBalance] = useState(false)

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([])
  const [loadingLeaves, setLoadingLeaves] = useState(false)

  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [attendanceRows, setAttendanceRows] = useState<Record<string, AttendanceRowState>>({})
  const [attendanceSaved, setAttendanceSaved] = useState(false)

  const [docEmployeeId, setDocEmployeeId] = useState('')
  const [docType, setDocType] = useState<RhDocType>('attestation')
  const [docForm, setDocForm] = useState<DocFormState>({ motif: '', lieu: '', dateDebut: '', dateFin: '', signataire: '' })

  const currentEmployee = useMemo(
    () => employees.find(e => e.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  )

  const refreshLeaveBalance = async (employeeId: string) => {
    setRefreshingBalance(true)
    try {
      const r = await fetchApi(`/api/v2/hr/leave-balance/${employeeId}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok || !d.success || !d.data) throw new Error(d.message ?? t('rh.toast.errLoadFile'))
      setSelectedDetail(prev => (prev && prev.employee.id === employeeId ? { ...prev, leaveBalance: d.data } : prev))
      onToast(t('rh.refresh'), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('rh.toast.errLoadFile'), 'error')
    } finally {
      setRefreshingBalance(false)
    }
  }

  const loadEmployees = async () => {
    setLoadingEmployees(true)
    const cacheKey = 'admin:hr:employees'
    const cached = await getCachedData<EmployeeItem[]>(cacheKey).catch(() => null)
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      setEmployees(cached.data)
      if (!selectedEmployeeId && cached.data[0]) setSelectedEmployeeId(cached.data[0].id)
      setLoadingEmployees(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoadingEmployees(false)
      return
    }

    try {
      const r = await fetchApi('/api/v2/hr/employees', { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errLoadStaff'))
      const list = d.data ?? []
      setEmployees(list)
      putCachedData(cacheKey, list).catch(() => {})
      if (!selectedEmployeeId && list.length > 0) setSelectedEmployeeId(list[0].id)
    } catch (error) {
      if (!isNetworkError(error) && !cached?.data) {
        onToast(error instanceof Error ? error.message : t('rh.toast.errLoadStaff'), 'error')
      }
    } finally {
      setLoadingEmployees(false)
    }
  }

  const loadDetail = async (employeeId: string) => {
    setLoadingDetail(true)
    const cacheKey = `admin:hr:employee:${employeeId}`
    const cached = await getCachedData<EmployeeDetail>(cacheKey).catch(() => null)
    if (cached?.data) {
      setSelectedDetail(cached.data)
      setSelectedEmployeeId(employeeId)
      setDocEmployeeId(employeeId)
      setLoadingDetail(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoadingDetail(false)
      return
    }

    try {
      const r = await fetchApi(`/api/v2/hr/employees/${employeeId}`, { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errLoadFile'))
      setSelectedDetail(d.data)
      setSelectedEmployeeId(employeeId)
      setDocEmployeeId(employeeId)
      if (d.data) putCachedData(cacheKey, d.data).catch(() => {})
    } catch (error) {
      if (!isNetworkError(error) && !cached?.data) {
        onToast(error instanceof Error ? error.message : t('rh.toast.errLoadFile'), 'error')
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  const loadLeaves = async () => {
    setLoadingLeaves(true)
    const cacheKey = 'admin:hr:leave-requests'
    const cached = await getCachedData<LeaveRequestItem[]>(cacheKey).catch(() => null)
    if (cached?.data && Array.isArray(cached.data)) {
      setLeaveRequests(cached.data)
      setLoadingLeaves(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoadingLeaves(false)
      return
    }

    try {
      const r = await fetchApi('/api/v2/hr/leave-requests', { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errLeaves'))
      const list = d.data ?? []
      setLeaveRequests(list)
      putCachedData(cacheKey, list).catch(() => {})
    } catch (error) {
      if (!isNetworkError(error) && !cached?.data) {
        onToast(error instanceof Error ? error.message : t('rh.toast.errLeaves'), 'error')
      }
    } finally {
      setLoadingLeaves(false)
    }
  }

  useEffect(() => {
    if (tab === 'personnel' && employees.length === 0 && !loadingEmployees) loadEmployees()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedEmployeeId && !selectedDetail) loadDetail(selectedEmployeeId)
  }, [selectedEmployeeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'conges' && leaveRequests.length === 0 && !loadingLeaves) loadLeaves()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'leaveRequest') loadLeaves()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'pointage' || employees.length > 0 || loadingEmployees) return
    loadEmployees()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'documents' && employees.length === 0 && !loadingEmployees) loadEmployees()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedEmployeeId && employees[0]) {
      setSelectedEmployeeId(employees[0].id)
      setDocEmployeeId(employees[0].id)
    }
  }, [employees, selectedEmployeeId])

  useEffect(() => {
    if (!employees.length) return
    setAttendanceRows(prev => {
      const next = { ...prev }
      for (const emp of employees) {
        if (!next[emp.id]) next[emp.id] = { statut: 'PRESENT', note: '' }
      }
      return next
    })
  }, [employees])

  const saveEmployeeFile = async (employeeId: string, payload: Record<string, unknown>) => {
    const r = await fetchApi(`/api/v2/hr/employees/${employeeId}/file`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    if (!d.success) throw new Error(d.message ?? t('rh.toast.errFile'))
    onToast(t('rh.toast.fileSaved'), 'success')
    await loadDetail(employeeId)
    await loadEmployees()
  }

  const exportListeNominale = async () => {
    try {
      const r = await fetchApi('/api/v2/hr/export/liste-nominale-minesec', { credentials: 'include' })
      if (!r.ok) throw new Error(t('rh.toast.errPdf'))
      triggerBlobDownload(await r.blob(), 'liste-nominale-minesec.xlsx')
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errPdf'), 'error')
    }
  }

  const addCareerEvent = async (employeeId: string) => {
    const type = prompt(t('rh.prompt.eventType'))
    if (!type) return
    const date = prompt(t('rh.prompt.date'))
    if (!date) return
    const observation = prompt(t('rh.prompt.observation')) ?? ''
    try {
      const r = await fetchApi(`/api/v2/hr/employees/${employeeId}/career-events`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, date, observation }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errEvent'))
      onToast(t('rh.toast.eventAdded'), 'success')
      loadDetail(employeeId)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errEvent'), 'error')
    }
  }

  const downloadEmployeePdf = async (employeeId: string, kind: 'attestation' | 'certificat') => {
    const endpoint = kind === 'attestation' ? 'attestation-travail' : 'certificat-travail'
    const errKey = kind === 'attestation' ? 'rh.toast.errAttestation' : 'rh.toast.errCertificat'
    try {
      const r = await fetchApi(`/api/v2/hr/employees/${employeeId}/${endpoint}`, { credentials: 'include' })
      if (!r.ok) throw new Error(t(errKey))
      triggerBlobDownload(await r.blob(), `${kind}-${employeeId}.pdf`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errPdf'), 'error')
    }
  }

  const handleApproveLeave = async (leaveId: string, statut: Exclude<LeaveStatus, 'PENDING'>) => {
    try {
      const r = await fetchApi(`/api/v2/hr/leave-requests/${leaveId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errLeave'))
      onToast(statut === 'APPROVED' ? t('rh.toast.leaveApproved') : t('rh.toast.leaveRejected'), 'success')
      loadLeaves()
      if (selectedEmployeeId) loadDetail(selectedEmployeeId)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errLeave'), 'error')
    }
  }

  const saveAttendance = async () => {
    try {
      const attendances = employees.map(emp => ({
        userId: emp.id,
        statut: attendanceRows[emp.id]?.statut ?? 'PRESENT',
        note: attendanceRows[emp.id]?.note?.trim() || undefined,
      }))
      const r = await fetchApi('/api/v2/hr/attendance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: attendanceDate, attendances }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errAttendance'))
      setAttendanceSaved(true)
      onToast(t('rh.toast.attendanceSaved'), 'success')
      setTimeout(() => setAttendanceSaved(false), 1500)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errAttendance'), 'error')
    }
  }

  const generateDoc = async () => {
    if (!docEmployeeId) {
      onToast(t('rh.toast.selectEmployee'), 'error')
      return
    }
    try {
      let url = ''
      let method: 'GET' | 'POST' = 'GET'
      let body: string | undefined
      if (docType === 'attestation') {
        url = `/api/v2/hr/employees/${docEmployeeId}/attestation-travail`
      } else if (docType === 'certificat') {
        url = `/api/v2/hr/employees/${docEmployeeId}/certificat-travail`
      } else {
        url = '/api/v2/hr/mission-orders'
        method = 'POST'
        body = JSON.stringify({ userId: docEmployeeId, ...docForm })
      }

      const res = await fetchApi(url, {
        method,
        credentials: 'include',
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })

      if (docType === 'mission') {
        const d = await res.json()
        if (!d.success) throw new Error(d.message ?? t('rh.toast.errMission'))
        onToast(t('rh.toast.missionCreated'), 'success')
        if (d.data?.id) {
          const pdfRes = await fetchApi(`/api/v2/hr/mission-orders/${d.data.id}/pdf`, { credentials: 'include' })
          if (pdfRes.ok) triggerBlobDownload(await pdfRes.blob(), `mission-${docEmployeeId}.pdf`)
        }
        return
      }

      if (!res.ok) throw new Error(t('rh.toast.errPdfGen'))
      triggerBlobDownload(await res.blob(), `${docType}-${docEmployeeId}.pdf`)
      onToast(t('rh.toast.docDownloaded'), 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errDoc'), 'error')
    }
  }

  return {
    tab, setTab,
    employees, selectedEmployeeId, selectedDetail, loadingEmployees, loadingDetail, refreshingBalance, currentEmployee,
    loadDetail, refreshLeaveBalance, saveEmployeeFile, exportListeNominale, addCareerEvent, downloadEmployeePdf,
    leaveRequests, loadingLeaves, loadLeaves, handleApproveLeave,
    attendanceDate, setAttendanceDate, attendanceRows, setAttendanceRows, attendanceSaved, saveAttendance,
    docEmployeeId, setDocEmployeeId, docType, setDocType, docForm, setDocForm, generateDoc,
  }
}
