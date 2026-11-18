'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import type {
  ClassItem,
  ClassSubjectItem,
  Department,
  DepartmentView,
  SubjectItem,
  SubjectsView,
  TeacherWithSubjects,
} from './types'

interface UseSubjectsDataParams {
  view: SubjectsView
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function useSubjectsData({ view, onToast }: UseSubjectsDataParams) {
  const t = useT('admin')

  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [classList, setClassList] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [classSubjects, setClassSubjects] = useState<ClassSubjectItem[]>([])
  const [loadingCV, setLoadingCV] = useState(false)
  const [classViewError, setClassViewError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [deletingSubjId, setDeletingSubjId] = useState<string | null>(null)

  const [departments, setDepartments] = useState<Department[]>([])
  const [deptLoading, setDeptLoading] = useState(false)
  const [deptError, setDeptError] = useState<string | null>(null)
  const [allTeachers, setAllTeachers] = useState<TeacherWithSubjects[]>([])

  const [teacherViewTeachers, setTeacherViewTeachers] = useState<TeacherWithSubjects[]>([])
  const [teacherViewLoading, setTeacherViewLoading] = useState(false)

  const fetchTeacherView = useCallback(async () => {
    setTeacherViewLoading(true)
    try {
      const cachedT = await getCachedData<TeacherWithSubjects[]>('admin:users:TEACHER').catch(() => null)
      if (cachedT?.data && Array.isArray(cachedT.data) && cachedT.data.length > 0) {
        setTeacherViewTeachers(cachedT.data)
        setTeacherViewLoading(false)
      } else {
        const cachedAll = await getCachedData<Array<TeacherWithSubjects & { role?: string }>>('admin:users:ALL').catch(() => null)
        if (cachedAll?.data && Array.isArray(cachedAll.data)) {
          const teachers = cachedAll.data.filter(u => u.role === 'TEACHER')
          if (teachers.length > 0) {
            setTeacherViewTeachers(teachers)
            setTeacherViewLoading(false)
          }
        }
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setTeacherViewLoading(false)
        return
      }

      const teacherRes = await fetchApi('/api/v2/users?role=TEACHER&limit=200', { credentials: 'include' })
      const tData = await teacherRes.json()
      if (teacherRes.ok && Array.isArray(tData.data)) {
        setTeacherViewTeachers(tData.data)
        putCachedData('admin:users:TEACHER', tData.data).catch(() => {})
      }
    } catch {
      /* silencieux en offline */
    } finally {
      setTeacherViewLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'par-enseignant') fetchTeacherView()
  }, [view, fetchTeacherView])

  const fetchSubjects = useCallback(async () => {
    const cacheKey = 'admin:subjects'
    const cached = await getCachedData<SubjectItem[]>(cacheKey).catch(() => null)
    if (cached?.data && Array.isArray(cached.data)) {
      setSubjects(cached.data)
      setLoading(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      if (!cached?.data) setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/subjects', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('subjects.error.load'))
      const list = data.data || []
      setSubjects(list)
      await putCachedData(cacheKey, list).catch(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNet = (typeof navigator !== 'undefined' && !navigator.onLine) || msg.includes('fetch') || msg.includes('Network')
      if (isNet) {
        if (!cached?.data) setSubjects([])
      } else if (!cached?.data) {
        setError(err instanceof Error ? err.message : 'Erreur')
      }
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchSubjects()
  }, [fetchSubjects])

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'subject') fetchSubjects()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchSubjects])

  const fetchDepartments = useCallback(async () => {
    const cachedDept = await getCachedData<Department[]>('admin:departments').catch(() => null)
    if (cachedDept?.data && Array.isArray(cachedDept.data)) {
      setDepartments(cachedDept.data)
      setDeptLoading(false)
    }
    const cachedT = await getCachedData<TeacherWithSubjects[]>('admin:users:TEACHER').catch(() => null)
    if (cachedT?.data && Array.isArray(cachedT.data)) {
      setAllTeachers(cachedT.data)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setDeptLoading(false)
      return
    }

    try {
      if (!cachedDept?.data) setDeptLoading(true)
      setDeptError(null)
      const [deptRes, subjRes, teacherRes] = await Promise.all([
        fetchApi('/api/v2/departments', { credentials: 'include' }),
        fetchApi('/api/v2/subjects', { credentials: 'include' }),
        fetchApi('/api/v2/users?role=TEACHER&limit=200', { credentials: 'include' }),
      ])
      const deptData = await deptRes.json()
      const subjData = await subjRes.json()
      const teacherData = await teacherRes.json()
      if (!deptRes.ok) throw new Error(deptData.message || 'Erreur')
      const dList = deptData.data || []
      setDepartments(dList)
      await putCachedData('admin:departments', dList).catch(() => {})
      if (teacherRes.ok && Array.isArray(teacherData.data)) {
        setAllTeachers(teacherData.data)
        putCachedData('admin:users:TEACHER', teacherData.data).catch(() => {})
      }
      if (subjRes.ok && subjData.data) setSubjects(subjData.data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNet = (typeof navigator !== 'undefined' && !navigator.onLine) || msg.includes('fetch') || msg.includes('Network')
      if (isNet) {
        if (!cachedDept?.data) setDepartments([])
      } else if (!cachedDept?.data) {
        setDeptError(err instanceof Error ? err.message : 'Erreur')
      }
    } finally {
      setDeptLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'departements') fetchDepartments()
  }, [view, fetchDepartments])

  useEffect(() => {
    if (view !== 'par-classe' || classList.length > 0) return
    getCachedData<ClassItem[]>('admin:classes').then(async c => {
      let list = c?.data
      if (!list || !Array.isArray(list) || list.length === 0) {
        const fallback = await getCachedData<ClassItem[]>('staff:classes').catch(() => null)
        list = fallback?.data
      }
      if (list && Array.isArray(list)) {
        setClassList(list.map(cls => ({ id: cls.id, name: cls.name, level: cls.level })))
      }
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          const mapped = (d.data as ClassItem[]).map(c => ({ id: c.id, name: c.name, level: c.level }))
          setClassList(mapped)
          putCachedData('admin:classes', d.data).catch(() => {})
        }
      })
      .catch(() => {})
  }, [view, classList.length])

  const handleSelectClass = async (cid: string) => {
    setSelectedClass(cid)
    setClassSubjects([])
    setClassViewError(null)
    if (!cid) return

    const classSubjKey = `admin:subjects:class:${cid}`
    const cachedClassSubj = await getCachedData<ClassSubjectItem[]>(classSubjKey).catch(() => null)
    if (cachedClassSubj?.data && Array.isArray(cachedClassSubj.data)) {
      setClassSubjects(cachedClassSubj.data)
      setLoadingCV(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoadingCV(false)
      return
    }

    setLoadingCV(true)
    try {
      const res = await fetchApi(`/api/v2/subjects?classId=${cid}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      const subList = d.data || []
      setClassSubjects(subList)
      await putCachedData(classSubjKey, subList).catch(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNet = (typeof navigator !== 'undefined' && !navigator.onLine) || msg.includes('fetch') || msg.includes('Network')
      if (isNet) {
        if (!cachedClassSubj?.data) setClassSubjects([])
      } else if (!cachedClassSubj?.data) {
        setClassViewError(err instanceof Error ? err.message : 'Erreur')
      }
    } finally {
      setLoadingCV(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const schoolRes = await fetchApi('/api/v2/school/me', { credentials: 'include' }).then(r => r.json())
      const schoolId = schoolRes.data?.id
      if (!schoolId) throw new Error('École introuvable')
      const res = await fetchApi(`/api/v2/schools/${schoolId}/sync-subjects`, { method: 'POST', credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(
        `Sync terminé : ${d.data.classesTraitees} classe(s) traitée(s), ` +
        `${d.data.subjectsCreated} matière(s) créée(s), ${d.data.coefficientsCreated} coefficient(s) ajouté(s)`,
        'success',
      )
      fetchSubjects()
      setSelectedClass('')
      setClassSubjects([])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur sync', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (sub: SubjectItem, onAfterTrigger: () => void) => {
    if (!(await confirmAction(t('subjects.delete_confirm').replace('{name}', sub.name)))) return
    setDeletingId(sub.id)
    onAfterTrigger()
    try {
      const res = await fetchApi(`/api/v2/subjects/${sub.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur')
      onToast(t('subjects.toast_deleted').replace('{name}', sub.name), 'success')
      fetchSubjects()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!(await confirmAction(t('subjects.class_view.delete_confirm').replace('{name}', subjectName)))) return
    setDeletingSubjId(subjectId)
    try {
      const res = await fetchApi(`/api/v2/classes/${selectedClass}/subjects/${subjectId}`, { method: 'DELETE', credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('subjects.class_view.toast_removed').replace('{name}', subjectName), 'success')
      handleSelectClass(selectedClass)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setDeletingSubjId(null)
    }
  }

  const handleUpdateCoefficient = async (subjectId: string, coeffStr: string): Promise<boolean> => {
    const val = parseFloat(coeffStr)
    if (isNaN(val) || val <= 0) {
      onToast('Coefficient invalide', 'error')
      return false
    }
    try {
      const res = await fetchApi(`/api/v2/classes/${selectedClass}/subjects`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, coefficient: val }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('subjects.class_view.coeff_updated'), 'success')
      handleSelectClass(selectedClass)
      return true
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
      return false
    }
  }

  const moveSubjectToDept = async (subjectId: string, subjectName: string, targetDeptId: string, targetDeptName: string) => {
    const sourceDept = departments.find(d => d.subjects.some(s => s.id === subjectId))
    const sourceDeptId = sourceDept?.id
    const prev = [...departments]
    setDepartments(deps => deps.map(d => ({
      ...d,
      subjects: targetDeptId !== '__unassigned__' && d.id === targetDeptId
        ? [...d.subjects, { id: subjectId, name: subjectName }]
        : d.id !== targetDeptId
          ? d.subjects.filter(s => s.id !== subjectId)
          : d.subjects,
    })))
    try {
      if (targetDeptId !== '__unassigned__') {
        const existingIds = departments.find(d => d.id === targetDeptId)?.subjects.map(s => s.id) ?? []
        const res = await fetchApi(`/api/v2/departments/${targetDeptId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectIds: [...existingIds, subjectId] }),
        })
        if (!res.ok) throw new Error('Erreur')
      }
      if (sourceDeptId && sourceDeptId !== '__unassigned__') {
        const remainingIds = sourceDept.subjects.filter(s => s.id !== subjectId).map(s => s.id)
        const res = await fetchApi(`/api/v2/departments/${sourceDeptId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectIds: remainingIds }),
        })
        if (!res.ok) throw new Error('Erreur')
      }
      onToast(t('subjects.departments.toast_moved').replace('{subject}', subjectName).replace('{target}', targetDeptName), 'success')
      fetchDepartments()
    } catch {
      setDepartments(prev)
      onToast(t('subjects.departments.toast_move_error'), 'error')
    }
  }

  const unassignedSubjectIds = new Set(departments.flatMap(d => d.subjects.map(s => s.id)))
  const unassignedSubjects = subjects.filter(s => !unassignedSubjectIds.has(s.id))
  const allDepartments: DepartmentView[] = [
    ...departments.filter(d => d.name !== 'Non classé' && d.name !== 'Others' && d.name !== 'Autres').sort((a, b) => a.name.localeCompare(b.name)),
    ...departments.filter(d => d.name === 'Non classé' || d.name === 'Others' || d.name === 'Autres'),
  ]
  if (unassignedSubjects.length > 0) {
    allDepartments.push({
      id: '__unassigned__',
      name: t('subjects.departments.unassigned'),
      color: 'var(--text3)',
      head: null,
      subjects: unassignedSubjects.map(s => ({ id: s.id, name: s.name })),
      _virtual: true,
    })
  }

  return {
    subjects,
    loading,
    error,
    deletingId,
    classList,
    selectedClass,
    classSubjects,
    loadingCV,
    classViewError,
    syncing,
    deletingSubjId,
    departments,
    allDepartments,
    deptLoading,
    deptError,
    allTeachers,
    teacherViewTeachers,
    teacherViewLoading,
    fetchSubjects,
    fetchDepartments,
    fetchTeacherView,
    handleSelectClass,
    handleSync,
    handleDelete,
    handleDeleteSubject,
    handleUpdateCoefficient,
    moveSubjectToDept,
  }
}
