'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import {
  AlertTriangle, BookOpen, Loader2, Trash2, X, Search, GraduationCap, MoreHorizontal,
  Users, Pencil, BarChart3, FolderOpen, Presentation, Check, RefreshCw, type LucideIcon,
} from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string; level: string | null }
interface ClassSubjectItem {
  id: string; subjectId: string; name: string; code: string | null
  coefficient: number; serieCode: string | null; classOnly: boolean
}

interface SubjectItem {
  id: string; name: string; code: string | null; coefficient: number
  hoursPerWeek: number; subjectType: string
  teacherSubjects: { teacherProfile: { user: { id: string; firstName: string; lastName: string } } }[]
}

interface Teacher { id: string; firstName: string; lastName: string }

interface TeacherWithSubjects extends Teacher {
  teacherProfile?: {
    supervisedSubjectIds?: string[]
    teacherSubjects?: { subjectId: string; subject: { name: string } }[]
  }
  subjects?: { id: string; name: string }[]
}

interface Department {
  id: string; name: string; color: string
  head: { id: string; firstName: string; lastName: string } | null
  subjects: { id: string; name: string; avgCoeff?: number }[]
}

const COEFF_SERIES = ['A4', 'A', 'C', 'D', 'TI']
const COEFF_LEVELS = ['2nde', '1ère', 'Tle']

const AVATAR_PALETTE = ['var(--green)', 'var(--blue)', 'var(--amber)', 'var(--purple)', '#db2777', 'var(--teal)']
function avatarColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

const EMPTY_CREATE = { name: '', code: '', coefficient: '1', hoursPerWeek: '2', subjectType: 'THEORETICAL', loading: false, error: '' }
const EMPTY_MOD    = { open: false, subjectId: '', name: '', code: '', coefficient: '', hoursPerWeek: '', subjectType: '', loading: false, error: '' }
const EMPTY_ASSIGN = { open: false, subjectId: '', subjectName: '', teacherSearch: '', teachers: [] as Teacher[], selected: null as Teacher | null, loading: false, error: '' }
const EMPTY_COEFF = { open: false, subjectId: '', subjectName: '', loading: false, error: '' }

export default function SectionSubjects({ onToast }: Props) {
  const t = useT('admin')
  const [subjects, setSubjects]         = useState<SubjectItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [openDD, setOpenDD]             = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [createOpen, setCreateOpen]     = useState(false)
  const [form, setForm]                 = useState(EMPTY_CREATE)
  const [modForm, setModForm]           = useState(EMPTY_MOD)
  const [assignForm, setAssignForm]     = useState(EMPTY_ASSIGN)
  const [coeffForm, setCoeffForm]       = useState(EMPTY_COEFF)
  const [coeffValues, setCoeffValues]   = useState<Record<string, string>>({})
  const [deletingId, setDeletingId]     = useState<string | null>(null)

  // ── Vue par Classe ────────────────────────────────────────────────────────
  const [view, setView]                 = useState<'catalogue' | 'par-classe' | 'departements' | 'par-enseignant'>('catalogue')
  const [classList, setClassList]       = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [classSubjects, setClassSubjects] = useState<ClassSubjectItem[]>([])
  const [loadingCV, setLoadingCV]       = useState(false)
  const [classViewError, setClassViewError] = useState<string | null>(null)
  const [syncing, setSyncing]           = useState(false)

  // ── Ajout / Suppression / Édition par classe ──────────────────────────────
  const [addSubjectOpen, setAddSubjectOpen] = useState(false)
  const [addSubjectId, setAddSubjectId]     = useState('')
  const [addCoefficient, setAddCoefficient] = useState('')
  const [addClassOnly, setAddClassOnly]     = useState(false)
  const [addLoading, setAddLoading]         = useState(false)
  const [addError, setAddError]             = useState('')
  const [deletingSubjId, setDeletingSubjId] = useState<string | null>(null)
  const [editingCoeffId, setEditingCoeffId] = useState<string | null>(null)
  const [editingCoeffValue, setEditingCoeffValue] = useState('')

  // ── Départements ───────────────────────────────────────────────────────────
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptLoading, setDeptLoading] = useState(false)
  const [deptError, setDeptError] = useState<string | null>(null)
  const [deptSearch, setDeptSearch] = useState('')
  const [openDeptMenu, setOpenDeptMenu] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [allTeachers, setAllTeachers] = useState<TeacherWithSubjects[]>([])
  const [deptEditForm, setDeptEditForm] = useState<{ open: boolean; id: string; name: string; color: string; headId: string; teacherSearch: string; teachers: TeacherWithSubjects[]; loading: boolean; error: string }>({ open: false, id: '', name: '', color: 'var(--text3)', headId: '', teacherSearch: '', teachers: [], loading: false, error: '' })
  const [deptCreateForm, setDeptCreateForm] = useState<{ open: boolean; name: string; color: string; loading: boolean; error: string }>({ open: false, name: '', color: 'var(--text3)', loading: false, error: '' })

  // ── Vue par Enseignant ──────────────────────────────────────────────────────
  const [teacherViewTeachers, setTeacherViewTeachers] = useState<TeacherWithSubjects[]>([])
  const [teacherViewSearch, setTeacherViewSearch] = useState('')
  const [teacherViewLoading, setTeacherViewLoading] = useState(false)
  const [teacherViewAdding, setTeacherViewAdding] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const fetchTeacherView = useCallback(async () => {
    setTeacherViewLoading(true)
    try {
      const [teacherRes] = await Promise.all([
        fetchApi('/api/v2/users?role=TEACHER&limit=200', { credentials: 'include' }),
      ])
      const tData = await teacherRes.json()
      if (teacherRes.ok) setTeacherViewTeachers(tData.data || [])
    } catch { /* silencieux */ }
    finally { setTeacherViewLoading(false) }
  }, [])

  useEffect(() => { if (view === 'par-enseignant') fetchTeacherView() }, [view, fetchTeacherView])

  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/subjects', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('subjects.error.load'))
      setSubjects(data.data || [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSubjects() }, [fetchSubjects])

  // Rafraîchissement temps réel quand l'assistant IA agit sur les matières.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'subject') fetchSubjects()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchSubjects])

  const fetchDepartments = useCallback(async () => {
    try {
      setDeptLoading(true); setDeptError(null)
      const [deptRes, subjRes, teacherRes] = await Promise.all([
        fetchApi('/api/v2/departments', { credentials: 'include' }),
        fetchApi('/api/v2/subjects', { credentials: 'include' }),
        fetchApi('/api/v2/users?role=TEACHER&limit=200', { credentials: 'include' }),
      ])
      const deptData = await deptRes.json()
      const subjData = await subjRes.json()
      const teacherData = await teacherRes.json()
      if (!deptRes.ok) throw new Error(deptData.message || 'Erreur')
      setDepartments(deptData.data || [])
      if (teacherRes.ok) setAllTeachers(teacherData.data || [])
      // subjects cached in state are used by "Non classé" computation
      if (subjRes.ok && subjData.data) setSubjects(subjData.data)
    } catch (err) { setDeptError(err instanceof Error ? err.message : 'Erreur') }
    finally { setDeptLoading(false) }
  }, [])

  useEffect(() => { if (view === 'departements') fetchDepartments() }, [view, fetchDepartments])

  // Charger les classes quand on bascule en vue par classe
  useEffect(() => {
    if (view !== 'par-classe' || classList.length > 0) return
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setClassList(d.data.map((c: any) => ({ id: c.id, name: c.name, level: c.level }))) })
      .catch(() => {})
  }, [view, classList.length])

  const handleSelectClass = async (cid: string) => {
    setSelectedClass(cid)
    setClassSubjects([])
    setClassViewError(null)
    if (!cid) return
    setLoadingCV(true)
    try {
      const res = await fetchApi(`/api/v2/subjects?classId=${cid}`, { credentials: 'include' })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      setClassSubjects(d.data || [])
    } catch (err) {
      setClassViewError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoadingCV(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const schoolRes = await fetchApi('/api/v2/school/me', { credentials: 'include' }).then(r => r.json())
      const schoolId  = schoolRes.data?.id
      if (!schoolId) throw new Error('École introuvable')
      const res = await fetchApi(`/api/v2/schools/${schoolId}/sync-subjects`, {
        method: 'POST', credentials: 'include',
      })
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

  // ── Ajouter une matière à la classe ──────────────────────────────────────
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
      setAddSubjectOpen(false); setAddSubjectId(''); setAddCoefficient(''); setAddClassOnly(false)
      handleSelectClass(selectedClass)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Erreur')
    } finally { setAddLoading(false) }
  }

  // ── Supprimer une matière de la classe ────────────────────────────────────
  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!window.confirm(t('subjects.class_view.delete_confirm').replace('{name}', subjectName))) return
    setDeletingSubjId(subjectId)
    try {
      const res = await fetchApi(`/api/v2/classes/${selectedClass}/subjects/${subjectId}`, {
        method: 'DELETE', credentials: 'include',
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('subjects.class_view.toast_removed').replace('{name}', subjectName), 'success')
      handleSelectClass(selectedClass)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setDeletingSubjId(null) }
  }

  // ── Modifier le coefficient inline ────────────────────────────────────────
  const handleUpdateCoefficient = async (subjectId: string) => {
    const val = parseFloat(editingCoeffValue)
    if (isNaN(val) || val <= 0) { onToast('Coefficient invalide', 'error'); return }
    try {
      const res = await fetchApi(`/api/v2/classes/${selectedClass}/subjects`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, coefficient: val }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('subjects.class_view.coeff_updated'), 'success')
      setEditingCoeffId(null)
      handleSelectClass(selectedClass)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    }
  }

  // ── Sujets déjà dans la classe (pour filtre dropdown ajout) ───────────────
  const classSubjectIds = new Set(classSubjects.map(s => s.subjectId))

  const filtered = subjects.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code?.toLowerCase().includes(search.toLowerCase()))
  )

  // ── Créer ─────────────────────────────────────────────────────────────────
  const submitCreate = async () => {
      if (!form.name.trim()) { setForm(f => ({ ...f, error: t('subjects.create_modal.name_required') })); return }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/subjects', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          coefficient: parseFloat(form.coefficient) || 1,
          hoursPerWeek: parseInt(form.hoursPerWeek) || 2,
          type: form.subjectType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('subjects.create_modal.toast_created').replace('{name}', form.name), 'success')
      setCreateOpen(false); setForm(EMPTY_CREATE); fetchSubjects()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Modifier ──────────────────────────────────────────────────────────────
  const openMod = (sub: SubjectItem) => {
    setOpenDD(null)
    setModForm({ open: true, subjectId: sub.id, name: sub.name, code: sub.code ?? '', coefficient: String(sub.coefficient), hoursPerWeek: String(sub.hoursPerWeek), subjectType: sub.subjectType, loading: false, error: '' })
  }

  const submitMod = async () => {
    if (!modForm.name.trim()) { setModForm(f => ({ ...f, error: t('subjects.edit_modal.name_required') })); return }
    setModForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/subjects/${modForm.subjectId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modForm.name.trim(),
          code: modForm.code.trim() || undefined,
          coefficient: parseFloat(modForm.coefficient) || 1,
          hoursPerWeek: parseInt(modForm.hoursPerWeek) || 2,
          type: modForm.subjectType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('subjects.edit_modal.toast_updated'), 'success')
      setModForm(EMPTY_MOD); fetchSubjects()
    } catch (err) {
      setModForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Supprimer ────────────────────────────────────────────────────────────
  const handleDelete = async (sub: SubjectItem) => {
    if (!window.confirm(t('subjects.delete_confirm').replace('{name}', sub.name))) return
    setDeletingId(sub.id)
    setOpenDD(null)
    try {
      const res = await fetchApi(`/api/v2/subjects/${sub.id}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur')
      onToast(t('subjects.toast_deleted').replace('{name}', sub.name), 'success')
      fetchSubjects()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Assigner enseignant ───────────────────────────────────────────────────
  const openAssign = async (sub: SubjectItem) => {
    setOpenDD(null)
    setAssignForm({ open: true, subjectId: sub.id, subjectName: sub.name, teacherSearch: '', teachers: [], selected: null, loading: false, error: '' })
    try {
      const res = await fetchApi('/api/v2/users?role=TEACHER&limit=100', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setAssignForm(f => ({ ...f, teachers: data.data || [] }))
    } catch { /* silencieux */ }
  }

  const openCoeff = (sub: SubjectItem) => {
    setOpenDD(null)
    const values: Record<string, string> = {}
    for (const lvl of COEFF_LEVELS) {
      for (const serie of COEFF_SERIES) {
        values[`${lvl}_${serie}`] = ''
      }
    }
    setCoeffValues(values)
    setCoeffForm({ open: true, subjectId: sub.id, subjectName: sub.name, loading: false, error: '' })
  }

  const submitCoeff = async () => {
    const coefficients: { classLevel: string; serieCode: string; coefficient: number }[] = []
    for (const lvl of COEFF_LEVELS) {
      for (const serie of COEFF_SERIES) {
        const val = coeffValues[`${lvl}_${serie}`]
        if (val && parseFloat(val) > 0) {
          coefficients.push({ classLevel: lvl, serieCode: serie, coefficient: parseFloat(val) })
        }
      }
    }
    if (coefficients.length === 0) {
      setCoeffForm(f => ({ ...f, error: t('subjects.coeff_modal.error_empty') })); return
    }
    setCoeffForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/subjects/${coeffForm.subjectId}/coefficients`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coefficients }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('subjects.coeff_modal.toast_saved').replace('{name}', coeffForm.subjectName), 'success')
      setCoeffForm(EMPTY_COEFF)
    } catch (err) {
      setCoeffForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const submitAssign = async () => {
    if (!assignForm.selected) { setAssignForm(f => ({ ...f, error: t('subjects.assign_modal.error_required') })); return }
    setAssignForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/subjects/teachers/${assignForm.selected.id}/assign`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: assignForm.subjectId, action: 'ASSIGNER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('subjects.assign_modal.toast_success').replace('{name}', assignForm.subjectName), 'success')
      setAssignForm(EMPTY_ASSIGN); fetchSubjects()
    } catch (err) {
      setAssignForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── "Non classé" virtuel ──────────────────────────────────────────────────
  const unassignedSubjectIds = new Set(departments.flatMap(d => d.subjects.map(s => s.id)))
  const unassignedSubjects = subjects.filter(s => !unassignedSubjectIds.has(s.id))
  const allDepartments: (Department & { _virtual?: boolean })[] = [
    ...departments.filter(d => d.name !== 'Non classé' && d.name !== 'Others' && d.name !== 'Autres').sort((a, b) => a.name.localeCompare(b.name)),
    ...departments.filter(d => d.name === 'Non classé' || d.name === 'Others' || d.name === 'Autres'),
  ]
  if (unassignedSubjects.length > 0) {
    allDepartments.push({
      id: '__unassigned__', name: t('subjects.departments.unassigned'), color: 'var(--text3)',
      head: null, subjects: unassignedSubjects.map(s => ({ id: s.id, name: s.name })),
      _virtual: true,
    })
  }

  const depsWithoutAp = allDepartments.filter(d => !d.head && d.name !== 'Non classé')

  // ── Départements : déplacer une matière via PATCH subject ──────────────────
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
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectIds: [...existingIds, subjectId] }),
        })
        if (!res.ok) throw new Error('Erreur')
      }
      if (sourceDeptId && sourceDeptId !== '__unassigned__') {
        const remainingIds = sourceDept.subjects.filter(s => s.id !== subjectId).map(s => s.id)
        const res = await fetchApi(`/api/v2/departments/${sourceDeptId}`, {
          method: 'PATCH', credentials: 'include',
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

  // ── Départements : Drag & Drop ──────────────────────────────────────────────
  const handleDragEnd = (event: any) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const subjectId = active.id as string
    const targetDeptId = over.id as string
    const subjectName = subjects.find(s => s.id === subjectId)?.name ?? subjectId
    const targetDept = allDepartments.find(d => d.id === targetDeptId)
    if (!targetDept) return
    moveSubjectToDept(subjectId, subjectName, targetDeptId, targetDept.name)
  }

  // ── Départements : Créer ───────────────────────────────────────────────────
  const submitCreateDept = async () => {
    if (!deptCreateForm.name.trim()) { setDeptCreateForm(f => ({ ...f, error: t('subjects.departments.create_modal.name_required') })); return }
    setDeptCreateForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/departments', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deptCreateForm.name.trim(), color: deptCreateForm.color }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setDeptCreateForm({ open: false, name: '', color: 'var(--text3)', loading: false, error: '' })
      fetchDepartments()
    } catch (err) {
      setDeptCreateForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Départements : Ouvrir édition ──────────────────────────────────────────
  const openEditDept = async (dept: Department) => {
    const deptSubjectIds = new Set(dept.subjects.map(s => s.id))
    const eligibleTeachers = dept.subjects.length === 0
      ? []
      : allTeachers.filter(t =>
          t.teacherProfile?.teacherSubjects?.some(ts => deptSubjectIds.has(ts.subjectId)) ?? false
        )
    setDeptEditForm({
      open: true, id: dept.id, name: dept.name, color: dept.color,
      headId: dept.head?.id ?? '',
      teachers: eligibleTeachers, teacherSearch: '', loading: false, error: '',
    })
  }

  // ── Départements : Modifier ────────────────────────────────────────────────
  const submitEditDept = async () => {
    if (!deptEditForm.name.trim()) { setDeptEditForm(f => ({ ...f, error: t('subjects.departments.edit_modal.name_required') })); return }
    setDeptEditForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/departments/${deptEditForm.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deptEditForm.name.trim(),
          color: deptEditForm.color,
          headId: deptEditForm.headId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setDeptEditForm(f => ({ ...f, open: false, loading: false }))
      fetchDepartments()
    } catch (err) {
      setDeptEditForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Départements : Supprimer ────────────────────────────────────────────────
  const handleDeleteDept = async (dept: { id: string; name: string }) => {
    if (!window.confirm(t('subjects.departments.edit_modal.delete_confirm').replace('{name}', dept.name))) return
    try {
      const res = await fetchApi(`/api/v2/departments/${dept.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      fetchDepartments()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    }
  }

  // ── Départements : recherche ──────────────────────────────────────────────
  const deptSearchLower = deptSearch.toLowerCase()
  const searchMatchCount = deptSearch
    ? allDepartments.reduce((sum, d) => sum + d.subjects.filter(s => s.name.toLowerCase().includes(deptSearchLower)).length, 0)
    : 0

  const filteredTeachers = assignForm.teacherSearch
    ? assignForm.teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(assignForm.teacherSearch.toLowerCase()))
    : assignForm.teachers

  const selectedClassName = classList.find(c => c.id === selectedClass)?.name

  const departmentHasSubjects = (deptId: string): boolean =>
    (departments.find(d => d.id === deptId)?.subjects.length ?? 0) > 0

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div className="mb-[16px] md:mb-[20px]" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('subjects.title')}</div>
          <div className="text-[13px] md:text-[14px]" style={sSub}>{loading ? '…' : t('subjects.count').replace('{count}', String(subjects.length))}</div>
        </div>
        {/* Actions — mobile : sync compact + CTA pilule (vert, nôtre), reproduction maquette */}
        <div className="flex md:hidden items-center gap-[6px] flex-shrink-0">
          <button onClick={handleSync} disabled={syncing} title={t('subjects.sync_title')}
            style={{ width: 28, height: 28, borderRadius: 10, border: 'none', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)', opacity: syncing ? 0.7 : 1 }}>
            {syncing ? <Loader2 size={16} strokeWidth={2} className="animate-spin" /> : <RefreshCw size={16} strokeWidth={2} />}
          </button>
          {view === 'catalogue' && (
            <button onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-[6px] rounded-full px-[14px] py-[10px] text-[12.5px] whitespace-nowrap border-0"
              style={{ background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900 }}>
              {t('subjects.btn_create')}
            </button>
          )}
          {view === 'departements' && (
            <button onClick={() => setDeptCreateForm({ open: true, name: '', color: 'var(--text3)', loading: false, error: '' })}
              className="inline-flex items-center gap-[6px] rounded-full px-[14px] py-[10px] text-[12.5px] whitespace-nowrap border-0"
              style={{ background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900 }}>
              {t('subjects.btn_create_dept')}
            </button>
          )}
        </div>
        {/* Actions — desktop, inchangées */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Toggle Vue */}
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 8, padding: 3, gap: 2 }}>
            {(['catalogue', 'par-classe', 'departements', 'par-enseignant'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: view === v ? 'white' : 'transparent',
                  color:      view === v ? 'var(--text)' : 'var(--text3)',
                  boxShadow:  view === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                {t(`subjects.view_toggles.${v === 'par-classe' ? 'par_classe' : v === 'par-enseignant' ? 'par_enseignant' : v}`)}
              </button>
            ))}
          </div>
          <button style={{ ...btnPrim, opacity: syncing ? 0.7 : 1, fontSize: 12, padding: '8px 11px' }}
            onClick={handleSync} disabled={syncing} title={t('subjects.sync_title')}>
            {syncing ? t('subjects.syncing') : t('subjects.btn_sync')}
          </button>
          {view === 'catalogue' && (
            <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('subjects.btn_create')}</button>
          )}
          {view === 'departements' && (
            <button style={btnPrim} onClick={() => setDeptCreateForm({ open: true, name: '', color: 'var(--text3)', loading: false, error: '' })}>{t('subjects.btn_create_dept')}</button>
          )}
        </div>
      </div>

      {/* Onglets de vue — mobile : puces défilables avec indicateur glissant, fondu de bord (maquette) */}
      <div className="relative md:hidden mb-[14px] -mr-4">
        <div className="flex gap-[6px] overflow-x-auto" style={{ padding: '2px 20px 4px', scrollbarWidth: 'none' }}>
          {(['catalogue', 'par-classe', 'departements', 'par-enseignant'] as const).map(v => {
            const active = view === v
            return (
              <button key={v} onClick={() => setView(v)}
                className="relative flex-shrink-0 rounded-full px-[14px] py-[9px] whitespace-nowrap border-0"
                style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                {active && (
                  <motion.div layoutId="subjects-view-pill" className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--sidebar)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10 text-[12.5px]" style={{ fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text3)' }}>
                  {t(`subjects.view_toggles.${v === 'par-classe' ? 'par_classe' : v === 'par-enseignant' ? 'par_enseignant' : v}`)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute top-0 right-0 bottom-[4px] w-7" style={{ background: 'linear-gradient(90deg,transparent,var(--bg) 65%)' }} />
      </div>

      {/* ── Vue par Classe ─────────────────────────────────────────────────────── */}
      {view === 'par-classe' && (
        <div>
          <div className="p-4 md:p-3.5 md:px-[24px] mb-[16px] md:mb-[20px] md:max-w-[480px]" style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)' }}>
            <div className="text-[11px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('subjects.class_view.selector_label')}</div>
            <select
              value={selectedClass}
              onChange={e => handleSelectClass(e.target.value)}
              className="text-[12px] md:text-[13px] px-[13px] md:px-[14px] py-[10px] md:py-[10px] rounded-[10px] md:rounded-[10px]"
              style={{ width: '100%', border: '1.5px solid var(--border)', color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', cursor: 'pointer', boxSizing: 'border-box' }}>
              <option value="">{t('subjects.class_view.selector_placeholder')}</option>
              {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {loadingCV && <div style={{ display: 'flex', justifyContent: 'center', padding: 39 }}><div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /></div>}

          {classViewError && (
            <div style={{ background: 'var(--red-light)', borderRadius: 8, padding: '11px 14px', color: 'var(--red)', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={15} strokeWidth={2} /> {classViewError}</div>
          )}

          {!loadingCV && selectedClass && classSubjects.length === 0 && !classViewError && (
            <div className="px-3.5 py-[36px] md:px-[24px] md:py-[48px]" style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text3)' }}>
                <BookOpen size={16} strokeWidth={1.5} className="md:hidden" /><BookOpen size={16} strokeWidth={1.5} className="hidden md:block" />
              </div>
              <div className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: t('subjects.class_view.no_subjects').replace('{name}', selectedClassName ?? '') }} />
              <div className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)' }} dangerouslySetInnerHTML={{ __html: t('subjects.class_view.sync_hint') }} />
            </div>
          )}

          {!loadingCV && classSubjects.length > 0 && (
            <div className="rounded-none md:rounded-[10px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden' }}>
              <div className="gap-[8px] mb-[14px] md:mb-0 md:p-[14px] md:px-[22px] md:border-b md:border-[var(--border)]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span className="text-[12px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: t('subjects.class_view.program_label').replace('{name}', selectedClassName ?? '') }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="text-[11.5px] md:text-[12px] px-[10px] md:px-[12px] py-[3px] md:py-[4px]" style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 10, fontWeight: 800 }}>
                    {t('subjects.class_view.count_badge').replace('{count}', String(classSubjects.length))}
                  </span>
                  <button onClick={() => { setAddSubjectOpen(true); setAddError(''); setAddSubjectId(''); setAddCoefficient(''); setAddClassOnly(false) }}
                    className="text-[12px] md:text-[13px] px-[12px] md:px-[14px] py-[5px] md:py-[6px]"
                    style={{ borderRadius: 8, fontWeight: 700, border: '1.5px solid var(--green)', background: 'var(--green-light)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {t('subjects.class_view.btn_add')}
                  </button>
                </div>
              </div>
              {/* ── Cartes empilées — mobile ── */}
              <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
                {classSubjects.map(s => (
                  <div key={s.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{s.name}</span>
                        {s.classOnly && (
                          <span style={{ marginLeft: 6, background: 'var(--purple-light)', color: 'var(--purple)', padding: '2px 7px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>
                            {t('subjects.class_view.class_only_badge')}
                          </span>
                        )}
                      </div>
                      <button onClick={() => handleDeleteSubject(s.subjectId, s.name)}
                        style={{ background: 'none', border: '1.5px solid var(--red-light)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: deletingSubjId === s.subjectId ? 'var(--text3)' : 'var(--red)', opacity: deletingSubjId === s.subjectId ? 0.5 : 1, flexShrink: 0 }}
                        disabled={deletingSubjId === s.subjectId}>
                        {deletingSubjId === s.subjectId ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      {editingCoeffId === s.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="number" min="0.5" step="0.5" value={editingCoeffValue}
                            onChange={e => setEditingCoeffValue(e.target.value)}
                            style={{ width: 56, padding: '4px 8px', borderRadius: 6, fontSize: 13, border: '1.5px solid var(--green)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'center', outline: 'none' }} />
                          <button onClick={() => handleUpdateCoefficient(s.subjectId)}
                            style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>OK</button>
                          <button onClick={() => setEditingCoeffId(null)}
                            style={{ background: 'var(--bg2)', color: 'var(--text2)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><X size={12} strokeWidth={2} /></button>
                        </div>
                      ) : (
                        <span onClick={() => { setEditingCoeffId(s.id); setEditingCoeffValue(String(s.coefficient)) }}
                          style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>×{s.coefficient}</span>
                      )}
                      {s.code && <code style={{ background: 'var(--bg2)', padding: '3px 7px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--text2)' }}>{s.code}</code>}
                      {s.serieCode
                        ? <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '3px 9px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>{s.serieCode}</span>
                        : <span style={{ color: 'var(--text3)', fontSize: 12.5 }}>{t('subjects.class_view.first_cycle')}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Tableau — desktop ── */}
              <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {(t('subjects.class_view_headers') as unknown as string[]).map((h: string, i: number) => (
                      <th key={i} style={{ ...thStyle, textAlign: i === 4 ? 'center' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classSubjects.map(s => (
                    <tr key={s.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>
                        {s.name}
                        {s.classOnly && (
                          <span title={t('subjects.class_view.class_only_badge')}
                            style={{ marginLeft: 6, background: 'var(--purple-light)', color: 'var(--purple)', padding: '2px 7px', borderRadius: 8, fontSize: 11, fontWeight: 800, verticalAlign: 'middle' }}>
                            {t('subjects.class_view.class_only_badge')}
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {s.code ? <code style={{ background: 'var(--bg2)', padding: '3px 8px', borderRadius: 6, fontSize: 13 }}>{s.code}</code> : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        {editingCoeffId === s.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" min="0.5" step="0.5" value={editingCoeffValue}
                              onChange={e => setEditingCoeffValue(e.target.value)}
                              style={{ width: 64, padding: '4px 8px', borderRadius: 6, fontSize: 12, border: '1.5px solid var(--green)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'center', outline: 'none' }} />
                            <button onClick={() => handleUpdateCoefficient(s.subjectId)}
                              style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>OK</button>
                            <button onClick={() => setEditingCoeffId(null)}
                              style={{ background: 'var(--bg2)', color: 'var(--text2)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }}><X size={13} strokeWidth={2} /></button>
                          </div>
                        ) : (
                          <span onClick={() => { setEditingCoeffId(s.id); setEditingCoeffValue(String(s.coefficient)) }}
                            style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}
                            title={t('subjects.class_view.coeff_edit_tooltip')}>×{s.coefficient}</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {s.serieCode
                          ? <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '4px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{s.serieCode}</span>
                          : <span style={{ color: 'var(--text3)', fontSize: 12 }}>{t('subjects.class_view.first_cycle')}</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button onClick={() => handleDeleteSubject(s.subjectId, s.name)}
                          style={{ background: 'none', border: '1.5px solid var(--red-light)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 13, color: deletingSubjId === s.subjectId ? 'var(--text3)' : 'var(--red)', opacity: deletingSubjId === s.subjectId ? 0.5 : 1 }}
                          disabled={deletingSubjId === s.subjectId}
                          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'var(--red-light)' })}
                          onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'none' })}>
                          {deletingSubjId === s.subjectId ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {!selectedClass && !loadingCV && (
            <div className="py-[44px] md:py-[60px]" style={{ textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <GraduationCap size={16} strokeWidth={1.5} className="md:hidden" /><GraduationCap size={16} strokeWidth={1.5} className="hidden md:block" />
              </div>
              <div className="text-[12px] md:text-[14px]">{t('subjects.class_view.no_selection')}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Vue Catalogue ──────────────────────────────────────────────────────── */}
      {view === 'catalogue' && loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 52 }}><div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /></div>}

      {view === 'catalogue' && !loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 8, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} strokeWidth={2} /> {error}</span>
          <button onClick={fetchSubjects} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {view === 'catalogue' && !loading && !error && (
        <div className="rounded-none md:rounded-[10px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]">
          <div className="p-0 mb-4 md:p-[14px] md:px-3.5 md:mb-0 md:border-b md:border-[var(--border)]">
            <div className="rounded-[10px] md:rounded-[10px] px-[14px] py-[12px] md:px-[14px] md:py-[8px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:bg-[var(--bg2)]" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={16} strokeWidth={2} color="var(--text3)" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('subjects.search_placeholder')}
                className="text-[12px] md:text-[13px]" style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="gap-[8px] px-[16px] py-[36px] md:py-[50px]" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: 'var(--text3)' }}>
              <Search size={16} strokeWidth={1.6} className="md:hidden" color="var(--border2)" />
              <Search size={16} strokeWidth={1.6} className="hidden md:block" color="var(--border2)" />
              <div className="text-[13.5px] md:text-[14px]">
                {subjects.length === 0 ? 'Aucune matière configurée' : 'Aucun résultat'}
              </div>
            </div>
          ) : (
            <>
            {/* ── Cartes empilées — mobile ── */}
            <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
              {filtered.map(sub => (
                <div key={sub.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 16, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 16, right: 16 }}>
                    <button onClick={() => setOpenDD(openDD === sub.id ? null : sub.id)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)' }}>
                      {deletingId === sub.id ? <Loader2 size={16} strokeWidth={2} className="animate-spin" /> : <MoreHorizontal size={16} strokeWidth={2} />}
                    </button>
                    {openDD === sub.id && (
                      <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 210, zIndex: 100, overflow: 'hidden' }}>
                        {[
                          { icon: Users, key: 'assign_teacher', action: () => openAssign(sub), danger: false },
                          { icon: Pencil, key: 'edit',            action: () => openMod(sub),    danger: false },
                          { icon: BarChart3, key: 'bac_coefficients', action: () => openCoeff(sub),  danger: false },
                          { icon: Trash2, key: 'delete',            action: () => handleDelete(sub), danger: false },
                        ].map((item, j) => {
                          const ItemIcon: LucideIcon = item.icon
                          return (
                          <div key={j} onClick={item.action}
                            style={{ padding: '11px 12px', fontSize: 13, fontWeight: 600, color: item.danger ? 'var(--red)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ItemIcon size={15} strokeWidth={2} /> {t(`subjects.action_menu.${item.key}`)}
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ paddingRight: 40, fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{sub.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}>×{sub.coefficient}</span>
                    {sub.code && <code style={{ background: 'var(--bg2)', padding: '3px 7px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--text2)' }}>{sub.code}</code>}
                    <span style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600 }}>{sub.hoursPerWeek}h</span>
                    <span style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600 }}>{t(`subjects.type_labels.${sub.subjectType}`) || sub.subjectType}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ background: sub.teacherSubjects.length > 0 ? 'var(--green-light)' : 'var(--bg2)', color: sub.teacherSubjects.length > 0 ? 'var(--green)' : 'var(--text2)', padding: '3px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 800 }}>
                      {sub.teacherSubjects.length > 0 ? t('subjects.assign_status.assigned').replace('{count}', String(sub.teacherSubjects.length)) : t('subjects.assign_status.unassigned')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Tableau — desktop ── */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{(t('subjects.table_headers') as unknown as string[]).map((h: string, i: number) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(sub => (
                  <tr key={sub.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{sub.name}</td>
                    <td style={tdStyle}>
                      {sub.code ? <code style={{ background: 'var(--bg2)', padding: '3px 9px', borderRadius: 7, fontSize: 12 }}>{sub.code}</code> : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={tdStyle}><span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 900 }}>×{sub.coefficient}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{sub.hoursPerWeek}h</td>
                    <td style={tdStyle}>{t(`subjects.type_labels.${sub.subjectType}`) || sub.subjectType}</td>
                    <td style={tdStyle}>
                      <span style={{ background: sub.teacherSubjects.length > 0 ? 'var(--green-light)' : 'var(--bg2)', color: sub.teacherSubjects.length > 0 ? 'var(--green)' : 'var(--text2)', padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800 }}>
                        {sub.teacherSubjects.length > 0 ? t('subjects.assign_status.assigned').replace('{count}', String(sub.teacherSubjects.length)) : t('subjects.assign_status.unassigned')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button onClick={() => setOpenDD(openDD === sub.id ? null : sub.id)}
                          style={{ background: 'none', border: '1.5px solid var(--border2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text3)' }}
                          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)', background: 'var(--green-light)' })}
                          onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text3)', background: 'none' })}>
                          {deletingId === sub.id ? <Loader2 size={16} strokeWidth={2} className="animate-spin" /> : <MoreHorizontal size={16} strokeWidth={2} />}
                        </button>
                        {openDD === sub.id && (
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 210, zIndex: 100, overflow: 'hidden' }}>
                            {[
                              { icon: Users, key: 'assign_teacher', action: () => openAssign(sub), danger: false },
                              { icon: Pencil, key: 'edit',            action: () => openMod(sub),    danger: false },
                              { icon: BarChart3, key: 'bac_coefficients', action: () => openCoeff(sub),  danger: false },
                              { icon: Trash2, key: 'delete',            action: () => handleDelete(sub), danger: false },
                            ].map((item, j) => {
                              const ItemIcon: LucideIcon = item.icon
                              return (
                              <div key={j} onClick={item.action}
                                style={{ padding: '11px 12px', fontSize: 13, fontWeight: 600, color: item.danger ? 'var(--red)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.danger ? 'var(--red-light)' : 'var(--bg2)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                                <ItemIcon size={15} strokeWidth={2} /> {t(`subjects.action_menu.${item.key}`)}
                              </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
        </div>
      )}

      {/* ── Vue Départements ───────────────────────────────────────────────────── */}
      {view === 'departements' && (
        <DndContext sensors={sensors} onDragStart={e => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEnd}>
          {/* Barre d'outils — le bouton "Créer un département" a été retiré d'ici : il fait
              doublon avec celui de l'en-tête (maquette : un seul bouton, dans l'en-tête). Ça
              libère la ligne pour que le badge de résultats de recherche et l'alerte "sans AP"
              s'affichent sans être à l'étroit ; ils passent sur une deuxième ligne au besoin. */}
          <div className="flex flex-col md:flex-row md:items-center gap-[10px] md:gap-3 mb-[14px] md:mb-4">
            <div className="rounded-[10px] md:rounded-[10px] px-[14px] py-[12px] md:py-[8px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:bg-[var(--bg2)] md:max-w-[400px]" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Search size={16} strokeWidth={2} color="var(--text3)" />
              <input value={deptSearch} onChange={e => setDeptSearch(e.target.value)}
                placeholder={t('subjects.departments.search_placeholder')}
                className="text-[12px] md:text-[13px]" style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
              {deptSearch && <span onClick={() => setDeptSearch('')} style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 12, display: 'inline-flex' }}><X size={14} strokeWidth={2} /></span>}
            </div>
            {(deptSearch && searchMatchCount > 0) || depsWithoutAp.length > 0 ? (
              <div className="flex flex-wrap items-center gap-[8px]">
                {deptSearch && searchMatchCount > 0 && (
                  <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800 }}>
                    {t('subjects.departments.subject_count').replace('{count}', String(searchMatchCount))}
                  </span>
                )}
                {depsWithoutAp.length > 0 && (
                  <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t('subjects.departments.ap_warning').replace('{count}', String(depsWithoutAp.length))}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {deptLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 52 }}><div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /></div>}

          {!deptLoading && deptError && (
            <div style={{ background: 'var(--red-light)', borderRadius: 8, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} strokeWidth={2} /> {deptError}</span>
              <button onClick={fetchDepartments} style={btnRetry}>Réessayer</button>
            </div>
          )}

          {!deptLoading && !deptError && allDepartments.length === 0 && (
            <div className="px-[24px] py-[44px] md:px-[24px] md:py-[64px]" style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <FolderOpen size={16} strokeWidth={1.5} className="md:hidden" /><FolderOpen size={16} strokeWidth={1.5} className="hidden md:block" />
              </div>
              <div className="text-[12px] md:text-[14px]" style={{ color: 'var(--text3)', marginBottom: 12 }}>
                {t('subjects.departments.no_depts')}
              </div>
              <button className="w-full md:w-auto justify-center" style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center' }} onClick={() => setDeptCreateForm({ open: true, name: '', color: 'var(--text3)', loading: false, error: '' })}>
                {t('subjects.departments.btn_create')}
              </button>
            </div>
          )}

          {!deptLoading && !deptError && allDepartments.length > 0 && (
            <div className="grid grid-cols-1 md:[grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]" style={{ gap: 11 }}>
              {allDepartments.map(dept => {
                const isVirtual = dept._virtual
                const hasSearch = deptSearch.length > 0
                const matchingSubjectIds = new Set(
                  dept.subjects.filter(s => s.name.toLowerCase().includes(deptSearchLower)).map(s => s.id)
                )
                const hasAnyMatch = !hasSearch || matchingSubjectIds.size > 0

                return (
                  <DeptDroppable key={dept.id} deptId={dept.id}>
                    <div style={{
                      background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)',
                      opacity: hasSearch && !hasAnyMatch ? 0.4 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                      {/* Barre de couleur — coins hauts arrondis pour epouser la forme de la
                          carte, plutot que overflow:hidden sur le conteneur (qui coupait aussi
                          le menu "Deplacer vers" quand il debordait en bas de la carte). */}
                      <div className="h-[5px] md:h-[6px]" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, background: isVirtual ? 'var(--border2)' : dept.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} />
                      <div className="p-[14px] md:px-3.5 md:py-3">
                        {/* En-tête */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 11, height: 11, borderRadius: '50%', background: isVirtual ? 'var(--border2)' : dept.color, flexShrink: 0 }} />
                            <span className="text-[13px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{dept.name}</span>
                            <span className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', fontWeight: 700 }}>({dept.subjects.length})</span>
                          </div>
                          {!isVirtual && (
                            <button onClick={() => openEditDept(dept)}
                              style={{ background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--text2)', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }}
                              title={t('subjects.departments.edit_modal.title')}>
                              <Pencil size={13} strokeWidth={2} />
                            </button>
                          )}
                        </div>

                        {/* AP */}
                        <div style={{ marginBottom: 10 }}>
                          {dept.head
                            ? <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '3px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
                                AP : {dept.head.firstName} {dept.head.lastName}
                              </span>
                            : !isVirtual
                              ? <span style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={13} strokeWidth={2} /> {t('subjects.departments.no_head')}</span>
                              : <span style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>{t('subjects.departments.unassigned')}</span>
                          }
                        </div>

                        {/* Matières */}
                        {dept.subjects.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dept.subjects
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(s => {
                                const isMatch = !hasSearch || matchingSubjectIds.has(s.id)
                                return (
                                  <DraggableSubject key={s.id} subjectId={s.id} deptId={dept.id}>
                                    <div style={{
                                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8,
                                      background: isMatch && activeDragId === s.id ? 'var(--green-light)' : 'transparent',
                                      opacity: hasSearch && !isMatch ? 0.3 : 1,
                                      transition: 'opacity 0.2s, background 0.15s',
                                      cursor: 'grab', userSelect: 'none',
                                    }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isMatch && activeDragId === s.id ? 'var(--green-light)' : 'transparent'}>
                                      <span style={{ fontSize: 12, color: 'var(--text3)', cursor: 'grab', opacity: activeDragId === s.id ? 1 : 0.3 }}>⠿</span>
                                      <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: isMatch ? 'var(--text)' : 'var(--text3)' }}>
                                        {hasSearch && isMatch ? highlightMatch(s.name, deptSearch) : s.name}
                                      </span>
                                      <span style={{ position: 'relative' }}>
                                        <button onClick={(e) => { e.stopPropagation(); setOpenDeptMenu(openDeptMenu === s.id ? null : s.id) }}
                                          style={{ background: 'none', border: 'none', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontSize: 13, color: 'var(--text3)', fontFamily: 'inherit' }}>⋯</button>
                                        {openDeptMenu === s.id && (
                                          <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 200, overflow: 'hidden' }}>
                                            <div style={{ padding: '8px 11px', fontSize: 13, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--bg2)' }}>
                                              {t('subjects.departments.move_to')}
                                            </div>
                                            {allDepartments.filter(other => other.id !== dept.id).map(other => (
                                              <div key={other.id} onClick={() => { setOpenDeptMenu(null); moveSubjectToDept(s.id, s.name, other.id, other.name) }}
                                                style={{ padding: '9px 11px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: other.color, flexShrink: 0 }} />
                                                {other.name}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </span>
                                    </div>
                                  </DraggableSubject>
                                )
                              })}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                            {t('subjects.departments.subjects_zero')}
                          </div>
                        )}

                        {/* Pied */}
                        {isVirtual && (
                          <div style={{ marginTop: 8, background: 'var(--red-light)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={14} strokeWidth={2} color="var(--red)" />
                            <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{t('subjects.teacher_view.unassigned_title')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </DeptDroppable>
                )
              })}
            </div>
          )}

          <DragOverlay>
            {activeDragId ? (
              <div style={{ padding: '8px 11px', background: 'var(--surface)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontWeight: 700, fontSize: 12, color: 'var(--text)', border: '2px solid var(--green)' }}>
                {subjects.find(s => s.id === activeDragId)?.name ?? activeDragId}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Vue Par enseignant ──────────────────────────────────────────────────── */}
      {view === 'par-enseignant' && (
        <div>
          {/* Barre outils */}
          <div className="mb-[14px] md:mb-[16px]" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="rounded-[10px] md:rounded-[10px] px-[14px] py-[12px] md:py-[8px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:bg-[var(--bg2)]" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, maxWidth: 400 }}>
              <Search size={16} strokeWidth={2} color="var(--text3)" />
              <input value={teacherViewSearch} onChange={e => setTeacherViewSearch(e.target.value)}
                placeholder={t('subjects.teacher_view.search_placeholder')}
                className="text-[12px] md:text-[13px]" style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
              {teacherViewSearch && <span onClick={() => setTeacherViewSearch('')} style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 12, display: 'inline-flex' }}><X size={14} strokeWidth={2} /></span>}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{teacherViewTeachers.length} enseignant{teacherViewTeachers.length > 1 ? 's' : ''}</span>
          </div>

          {teacherViewLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 26 }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
            </div>
          )}

          {!teacherViewLoading && teacherViewTeachers.length === 0 && (
            <div className="px-[24px] py-[44px] md:py-[64px]" style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Presentation size={16} strokeWidth={1.5} className="md:hidden" /><Presentation size={16} strokeWidth={1.5} className="hidden md:block" />
              </div>
              <div className="text-[12px] md:text-[14px]" style={{ color: 'var(--text3)' }}>{t('subjects.teacher_view.no_results')}</div>
            </div>
          )}

          {!teacherViewLoading && teacherViewTeachers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teacherViewTeachers
                .filter(t => !teacherViewSearch || `${t.firstName} ${t.lastName}`.toLowerCase().includes(teacherViewSearch.toLowerCase()))
                .map(teacher => {
                  const teacherSubjects = teacher.teacherProfile?.teacherSubjects ?? []
                  const unassignedSubjects = subjects.filter(
                    s => !teacherSubjects.some(ts => ts.subjectId === s.id)
                  )
                  return (
                    <div key={teacher.id} className="rounded-[10px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none" style={{ background: 'var(--surface)' }}>
                      <div className="p-4 md:px-3.5 md:py-3">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div className="w-8 h-8 md:hidden" style={{ borderRadius: 8, background: avatarColor(teacher.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                              {teacher.firstName[0]?.toUpperCase()}{teacher.lastName[0]?.toUpperCase()}
                            </div>
                            <div className="text-[14.5px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)', minWidth: 0 }}>{teacher.firstName} {teacher.lastName}</div>
                          </div>
                          <span className="text-[11.5px] md:text-[13px] px-[9px] md:px-[10px] py-[3px]" style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 10, fontWeight: 800, flexShrink: 0 }}>
                            {t('subjects.class_view.count_badge').replace('{count}', String(teacherSubjects.length))}
                          </span>
                        </div>

                        {teacherSubjects.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {teacherSubjects.map(ts => (
                              <span key={ts.subjectId} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: 'var(--green-light)', color: 'var(--green)', padding: '4px 10px', borderRadius: 10,
                                fontSize: 13, fontWeight: 700,
                              }}>
                                {ts.subject?.name ?? ts.subjectId}
                                <span onClick={async () => {
                                  if (!window.confirm(t('subjects.teacher_view.remove_confirm').replace('{subject}', ts.subject?.name ?? ts.subjectId).replace('{teacher}', `${teacher.firstName} ${teacher.lastName}`))) return
                                  try {
                                    const res = await fetchApi(`/api/v2/subjects/teachers/${teacher.id}/assign`, {
                                      method: 'POST', credentials: 'include',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ subjectId: ts.subjectId, action: 'RETIRER' }),
                                    })
                                    if (!res.ok) throw new Error()
                                    onToast(t('subjects.class_view.toast_removed').replace('{name}', ts.subject?.name ?? ts.subjectId), 'success')
                                    fetchTeacherView()
                                  } catch { onToast(t('subjects.departments.toast_move_error'), 'error') }
                                }}
                                  style={{ cursor: 'pointer', marginLeft: 2, fontSize: 12, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }} title="Retirer">
                                  <X size={12} strokeWidth={2} />
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                        {teacherSubjects.length === 0 && (
                          <div style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic', marginBottom: 10 }}>{t('subjects.teacher_view.no_subjects')}</div>
                        )}

                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setTeacherViewAdding(teacherViewAdding === teacher.id ? null : teacher.id)}
                            style={{
                              padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                              background: teacherViewAdding === teacher.id ? 'var(--green)' : 'var(--green-light)',
                              color: teacherViewAdding === teacher.id ? 'white' : 'var(--green)',
                              border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                            {t('subjects.teacher_view.btn_add')}
                          </button>

                          {teacherViewAdding === teacher.id && unassignedSubjects.length > 0 && (
                            <div style={{
                              position: 'absolute', left: 0, top: 'calc(100% + 4px)', background: 'var(--surface)',
                              border: '1.5px solid var(--border2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                              minWidth: 250, maxHeight: 240, overflowY: 'auto', zIndex: 200,
                            }}>
                              <div style={{ padding: '8px 11px', fontSize: 13, fontWeight: 700, color: 'var(--text3)', borderBottom: '1px solid var(--bg2)' }}>
                                {t('subjects.teacher_view.choose_subject')}
                              </div>
                              {unassignedSubjects.map(sub => (
                                <div key={sub.id} onClick={async () => {
                                  try {
                                    const res = await fetchApi(`/api/v2/subjects/teachers/${teacher.id}/assign`, {
                                      method: 'POST', credentials: 'include',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ subjectId: sub.id, action: 'ASSIGNER' }),
                                    })
                                    if (!res.ok) throw new Error()
                                    onToast(`"${sub.name}" assigné à ${teacher.firstName} ${teacher.lastName}`, 'success')
                                    setTeacherViewAdding(null)
                                    fetchTeacherView()
                                  } catch { onToast('Erreur lors de l\'assignation', 'error') }
                                }}
                                  style={{ padding: '9px 11px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', borderBottom: '1px solid var(--bg2)' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                                  {sub.name}
                                </div>
                              ))}
                            </div>
                          )}
                          {teacherViewAdding === teacher.id && unassignedSubjects.length === 0 && (
                            <div style={{
                              position: 'absolute', left: 0, top: 'calc(100% + 4px)', background: 'var(--surface)',
                              border: '1.5px solid var(--border2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                              minWidth: 250, zIndex: 200,
                            }}>
                              <div style={{ padding: '11px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('subjects.teacher_view.all_assigned')}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}

          {/* ── Matières sans enseignant ── */}
          {!teacherViewLoading && subjects.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden', marginTop: 18 }}>
              <div className="px-[16px] py-[12px] md:px-3.5 md:py-2.5 gap-[6px] md:gap-[8px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                <AlertTriangle size={15} strokeWidth={2} className="md:hidden" /><AlertTriangle size={16} strokeWidth={2} className="hidden md:block" />
                <span className="text-[12px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('subjects.teacher_view.unassigned_title')}</span>
              </div>
              {(() => {
                const assignedSubjectIds = new Set(
                  teacherViewTeachers.flatMap(t => t.teacherProfile?.teacherSubjects?.map(ts => ts.subjectId) ?? [])
                )
                const unassignedSubjs = subjects.filter(s => !assignedSubjectIds.has(s.id))
                if (unassignedSubjs.length === 0) return (
                  <div className="text-[13.5px] md:text-[13px]" style={{ padding: '14px', textAlign: 'center', color: 'var(--text3)' }}>
                    {t('subjects.teacher_view.all_covered')}
                  </div>
                )
                return (
                  <div className="px-[16px] py-[12px] md:px-3.5 md:py-2.5" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {unassignedSubjs.map(s => (
                      <span key={s.id} style={{
                        background: 'var(--amber-light)', color: 'var(--amber)', padding: '4px 12px', borderRadius: 10,
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Modal créer ── */}
      {createOpen && (
        <ModalOverlay onClose={() => { setCreateOpen(false); setForm(EMPTY_CREATE) }}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.create_modal.title')}</div>
          <div className={sLabelCls} style={sLabel}>Nom *</div>
          <input className={sInputCls} style={sInput} placeholder="Ex: Mathématiques, Français…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div className={sLabelCls} style={sLabel}>Code</div>
              <input className={sInputCls} style={sInput} placeholder="Ex: MATH, FR" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <div className={sLabelCls} style={sLabel}>Coefficient</div>
              <input className={sInputCls} style={sInput} type="number" min="0.5" step="0.5" value={form.coefficient} onChange={e => setForm(f => ({ ...f, coefficient: e.target.value }))} />
            </div>
            <div>
              <div className={sLabelCls} style={sLabel}>Heures / semaine</div>
              <input className={sInputCls} style={sInput} type="number" min="1" value={form.hoursPerWeek} onChange={e => setForm(f => ({ ...f, hoursPerWeek: e.target.value }))} />
            </div>
            <div>
              <div className={sLabelCls} style={sLabel}>Type</div>
              <select className={sInputCls} style={sInput} value={form.subjectType} onChange={e => setForm(f => ({ ...f, subjectType: e.target.value }))}>
                <option value="THEORETICAL">{t('subjects.type_labels.THEORETICAL')}</option>
                <option value="PRACTICAL">{t('subjects.type_labels.PRACTICAL')}</option>
                <option value="MIXED">{t('subjects.type_labels.MIXED')}</option>
              </select>
            </div>
          </div>
          {form.error && <div style={sError}>{form.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => { setCreateOpen(false); setForm(EMPTY_CREATE) }}>{t('subjects.create_modal.btn_cancel')}</button>
            <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={submitCreate} disabled={form.loading}>
              {form.loading ? t('subjects.departments.create_modal.creating') : t('subjects.create_modal.btn_create')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal modifier ── */}
      {modForm.open && (
        <ModalOverlay onClose={() => setModForm(EMPTY_MOD)}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.edit_modal.title')}</div>
          <div className={sLabelCls} style={sLabel}>Nom *</div>
          <input className={sInputCls} style={sInput} value={modForm.name} onChange={e => setModForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div className={sLabelCls} style={sLabel}>Code</div>
              <input className={sInputCls} style={sInput} value={modForm.code} onChange={e => setModForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <div className={sLabelCls} style={sLabel}>Coefficient</div>
              <input className={sInputCls} style={sInput} type="number" min="0.5" step="0.5" value={modForm.coefficient} onChange={e => setModForm(f => ({ ...f, coefficient: e.target.value }))} />
            </div>
            <div>
              <div className={sLabelCls} style={sLabel}>Heures / semaine</div>
              <input className={sInputCls} style={sInput} type="number" min="1" value={modForm.hoursPerWeek} onChange={e => setModForm(f => ({ ...f, hoursPerWeek: e.target.value }))} />
            </div>
            <div>
              <div className={sLabelCls} style={sLabel}>Type</div>
              <select className={sInputCls} style={sInput} value={modForm.subjectType} onChange={e => setModForm(f => ({ ...f, subjectType: e.target.value }))}>
                <option value="THEORETICAL">{t('subjects.type_labels.THEORETICAL')}</option>
                <option value="PRACTICAL">{t('subjects.type_labels.PRACTICAL')}</option>
                <option value="MIXED">{t('subjects.type_labels.MIXED')}</option>
              </select>
            </div>
          </div>
          {modForm.error && <div style={sError}>{modForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setModForm(EMPTY_MOD)}>{t('subjects.edit_modal.btn_cancel')}</button>
            <button style={{ ...btnPrim, flex: 1, opacity: modForm.loading ? 0.7 : 1 }} onClick={submitMod} disabled={modForm.loading}>
              {modForm.loading ? t('subjects.coeff_modal.saving') : t('subjects.edit_modal.btn_save')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal coefficients BAC ── */}
      {coeffForm.open && (
        <ModalOverlay onClose={() => setCoeffForm(EMPTY_COEFF)}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.coeff_modal.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 13 }}>{coeffForm.subjectName}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>{t('subjects.coeff_modal.level_header')}</th>
                  {COEFF_SERIES.map(s => (
                    <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 70 }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COEFF_LEVELS.map(lvl => (
                  <tr key={lvl}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{lvl}</td>
                    {COEFF_SERIES.map(serie => (
                      <td key={serie} style={{ ...tdStyle, textAlign: 'center', padding: '8px 6px' }}>
                        <input type="number" min="0" step="0.5"
                          value={coeffValues[`${lvl}_${serie}`] ?? ''}
                          onChange={e => setCoeffValues(v => ({ ...v, [`${lvl}_${serie}`]: e.target.value }))}
                          placeholder="—"
                          style={{ width: 64, padding: '6px 8px', borderRadius: 8, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'center', outline: 'none' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {coeffForm.error && <div style={sError}>{coeffForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setCoeffForm(EMPTY_COEFF)}>{t('subjects.coeff_modal.btn_cancel')}</button>
            <button style={{ ...btnPrim, flex: 1, opacity: coeffForm.loading ? 0.7 : 1 }} onClick={submitCoeff} disabled={coeffForm.loading}>
              {coeffForm.loading ? t('subjects.coeff_modal.saving') : t('subjects.coeff_modal.btn_save')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal ajouter matière à la classe ── */}
      {addSubjectOpen && (
        <ModalOverlay onClose={() => { setAddSubjectOpen(false); setAddSubjectId(''); setAddCoefficient(''); setAddError(''); setAddClassOnly(false) }}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.class_view.add_modal.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 13 }} dangerouslySetInnerHTML={{ __html: t('subjects.class_view.add_modal.to_label').replace('{name}', selectedClassName ?? '') }} />
          <div className={sLabelCls} style={sLabel}>{t('subjects.class_view.add_modal.subject_label')}</div>
          <select value={addSubjectId} onChange={e => setAddSubjectId(e.target.value)}
            className={sInputCls} style={sInput}>
            <option value="">{t('subjects.class_view.add_modal.subject_placeholder')}</option>
            {subjects.filter(s => !classSubjectIds.has(s.id)).map(s => (
              <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
            ))}
          </select>
          <div className={sLabelCls} style={sLabel}>{t('subjects.class_view.add_modal.coeff_label')}</div>
          <input type="number" min="0.5" step="0.5" value={addCoefficient}
            onChange={e => setAddCoefficient(e.target.value)}
            className={sInputCls} style={sInput} placeholder={t('subjects.class_view.add_modal.coeff_placeholder')} />

          {/* Toggle portée */}
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 8, padding: 3, gap: 2, marginBottom: 4, marginTop: 4 }}>
            <button type="button"
              onClick={() => setAddClassOnly(false)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: !addClassOnly ? 'white' : 'transparent',
                color:      !addClassOnly ? 'var(--text)' : 'var(--text3)',
                boxShadow:  !addClassOnly ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
              {t('subjects.class_view.add_modal.scope_all')}
            </button>
            <button type="button"
              onClick={() => setAddClassOnly(true)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: addClassOnly ? 'white' : 'transparent',
                color:      addClassOnly ? 'var(--purple)' : 'var(--text3)',
                boxShadow:  addClassOnly ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
              {t('subjects.class_view.add_modal.scope_only')}
            </button>
          </div>
          {!addClassOnly && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              {t('subjects.class_view.add_modal.toast_all_level')}
            </div>
          )}

          {addError && <div style={sError}>{addError}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => { setAddSubjectOpen(false); setAddSubjectId(''); setAddCoefficient(''); setAddError(''); setAddClassOnly(false) }}>
              {t('subjects.class_view.add_modal.btn_cancel')}
            </button>
            <button style={{ ...btnPrim, flex: 1, opacity: addLoading ? 0.7 : 1 }} onClick={handleAddSubject} disabled={addLoading}>
              {addLoading ? t('subjects.class_view.add_modal.adding') : t('subjects.class_view.add_modal.btn_add')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal assigner enseignant ── */}
      {assignForm.open && (
        <ModalOverlay onClose={() => setAssignForm(EMPTY_ASSIGN)}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.assign_modal.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 13 }}>{assignForm.subjectName}</div>
          <div className={sLabelCls} style={sLabel}>{t('subjects.assign_modal.search_placeholder')}</div>
          <input className={sInputCls} style={sInput} placeholder={t('subjects.assign_modal.search_placeholder')} value={assignForm.teacherSearch}
            onChange={e => setAssignForm(f => ({ ...f, teacherSearch: e.target.value, selected: null }))} />
          {assignForm.selected && (
            <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '8px 11px', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} strokeWidth={2} /> {assignForm.selected.firstName} {assignForm.selected.lastName}
            </div>
          )}
          {!assignForm.selected && (
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {filteredTeachers.length === 0
                ? <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('subjects.assign_modal.no_teacher')}</div>
                : filteredTeachers.map(t => (
                  <div key={t.id}
                    onClick={() => setAssignForm(f => ({ ...f, selected: t, teacherSearch: `${t.firstName} ${t.lastName}` }))}
                    style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--bg2)', color: 'var(--text)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                    {t.firstName} {t.lastName}
                  </div>
                ))}
            </div>
          )}
          {assignForm.error && <div style={sError}>{assignForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setAssignForm(EMPTY_ASSIGN)}>{t('subjects.assign_modal.btn_cancel')}</button>
            <button style={{ ...btnPrim, flex: 1, opacity: assignForm.loading ? 0.7 : 1 }} onClick={submitAssign} disabled={assignForm.loading}>
              {assignForm.loading ? t('subjects.assign_modal.assigning') : t('subjects.assign_modal.btn_assign')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal créer département ── */}
      {deptCreateForm.open && (
        <ModalOverlay onClose={() => setDeptCreateForm({ open: false, name: '', color: 'var(--text3)', loading: false, error: '' })}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.departments.create_modal.title')}</div>
          <div className={sLabelCls} style={sLabel}>Nom *</div>
          <input className={sInputCls} style={sInput} placeholder="Ex: Lettres, Sciences…" value={deptCreateForm.name}
            onChange={e => setDeptCreateForm(f => ({ ...f, name: e.target.value }))} />
          <div className={sLabelCls} style={sLabel}>Couleur</div>
          <DeptColorPicker value={deptCreateForm.color} onChange={c => setDeptCreateForm(f => ({ ...f, color: c }))} />
          {deptCreateForm.error && <div style={sError}>{deptCreateForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setDeptCreateForm({ open: false, name: '', color: 'var(--text3)', loading: false, error: '' })}>{t('subjects.departments.create_modal.btn_cancel')}</button>
            <button style={{ ...btnPrim, flex: 1, opacity: deptCreateForm.loading ? 0.7 : 1 }} onClick={submitCreateDept} disabled={deptCreateForm.loading}>
              {deptCreateForm.loading ? t('subjects.departments.create_modal.creating') : t('subjects.departments.create_modal.btn_create')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal modifier département ── */}
      {deptEditForm.open && (
        <ModalOverlay onClose={() => setDeptEditForm(f => ({ ...f, open: false }))}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.departments.edit_modal.title')}</div>

          <div className={sLabelCls} style={sLabel}>Nom *</div>
          <input className={sInputCls} style={sInput} value={deptEditForm.name}
            onChange={e => setDeptEditForm(f => ({ ...f, name: e.target.value }))} />

          <div className={sLabelCls} style={sLabel}>Couleur</div>
          <DeptColorPicker value={deptEditForm.color} onChange={c => setDeptEditForm(f => ({ ...f, color: c }))} />

          <div className={sLabelCls} style={sLabel}>{t('subjects.departments.edit_modal.ap_label')}</div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <input className={sInputCls} style={sInput} placeholder={t('subjects.departments.edit_modal.search_placeholder')} value={deptEditForm.teacherSearch}
              onChange={e => setDeptEditForm(f => ({ ...f, teacherSearch: e.target.value, headId: '' }))}
              onFocus={() => { if (!deptEditForm.headId) setDeptEditForm(f => ({ ...f, teacherSearch: '' })) }} />
            {deptEditForm.headId && (
              <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '8px 11px', borderRadius: 8, marginBottom: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} strokeWidth={2} /> {deptEditForm.teachers.find(t => t.id === deptEditForm.headId)?.firstName} {deptEditForm.teachers.find(t => t.id === deptEditForm.headId)?.lastName}</span>
                <button onClick={() => setDeptEditForm(f => ({ ...f, headId: '', teacherSearch: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={13} strokeWidth={2} /> Retirer</button>
              </div>
            )}
            {!deptEditForm.headId && (
              <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
                {(deptEditForm.teacherSearch
                  ? deptEditForm.teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(deptEditForm.teacherSearch.toLowerCase()))
                  : deptEditForm.teachers
                ).length === 0
                  ? <div style={{ padding: '11px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('subjects.departments.edit_modal.no_teacher')}</div>
                  : (deptEditForm.teacherSearch
                    ? deptEditForm.teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(deptEditForm.teacherSearch.toLowerCase()))
                    : deptEditForm.teachers
                  ).map(t => (
                    <div key={t.id}
                      onClick={() => setDeptEditForm(f => ({ ...f, headId: t.id, teacherSearch: `${t.firstName} ${t.lastName}` }))}
                      style={{ padding: '8px 11px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--bg2)', color: 'var(--text)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <div style={{ fontWeight: 600 }}>{t.firstName} {t.lastName}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {deptEditForm.error && <div style={sError}>{deptEditForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setDeptEditForm(f => ({ ...f, open: false }))}>{t('subjects.departments.edit_modal.btn_cancel')}</button>
            <button style={{ ...btnPrim, flex: 1, opacity: deptEditForm.loading ? 0.7 : 1 }} onClick={submitEditDept} disabled={deptEditForm.loading}>
              {deptEditForm.loading ? t('subjects.coeff_modal.saving') : t('subjects.departments.edit_modal.btn_save')}
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 18, paddingTop: 16 }}>
            <button onClick={() => handleDeleteDept({ id: deptEditForm.id, name: deptEditForm.name })}
              style={{
                width: '100%', padding: '10px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: departmentHasSubjects(deptEditForm.id) ? 'not-allowed' : 'pointer',
                background: departmentHasSubjects(deptEditForm.id) ? 'var(--bg2)' : 'var(--red-light)',
                color: departmentHasSubjects(deptEditForm.id) ? 'var(--text3)' : 'var(--red)',
                border: `1.5px solid ${departmentHasSubjects(deptEditForm.id) ? 'var(--border)' : 'var(--red-light)'}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
              disabled={departmentHasSubjects(deptEditForm.id)}
              title={departmentHasSubjects(deptEditForm.id) ? t('subjects.departments.toast_move_error') : t('subjects.departments.edit_modal.btn_delete')}>
              <Trash2 size={14} strokeWidth={2} /> {t('subjects.departments.edit_modal.btn_delete')}
            </button>
            {departmentHasSubjects(deptEditForm.id) && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{t('subjects.departments.toast_move_error')}</div>
            )}
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

// ── DnD Helper Components ──────────────────────────────────────────────────────
function DeptDroppable({ deptId, children }: { deptId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: deptId })
  return (
    <div ref={setNodeRef} style={{ position: 'relative' }}>
      {isOver && <div style={{ position: 'absolute', inset: 0, borderRadius: 10, border: '2px dashed var(--green)', background: 'rgba(5,150,105,0.05)', zIndex: 10, pointerEvents: 'none' }} />}
      {children}
    </div>
  )
}

function DraggableSubject({ subjectId, deptId, children }: { subjectId: string; deptId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: subjectId, data: { deptId } })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {children}
    </div>
  )
}

// ── 8 couleurs prédéfinies ────────────────────────────────────────────────────
const DEPT_COLORS = [
  { name: 'Lettres', color: 'var(--blue)' },
  { name: 'Sciences Humaines', color: 'var(--amber)' },
  { name: 'Langues Vivantes', color: 'var(--green)' },
  { name: 'Maths & Sciences', color: 'var(--red)' },
  { name: 'Informatique', color: 'var(--purple)' },
  { name: 'Arts & Culture', color: 'var(--orange)' },
  { name: 'Gris', color: 'var(--text3)' },
  { name: 'Personnalisé', color: 'var(--text)' },
]

function DeptColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [custom, setCustom] = useState(value)
  const selected = DEPT_COLORS.find(c => c.color === value)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {DEPT_COLORS.map(c => (
          <div key={c.color} onClick={() => onChange(c.color)}
            style={{
              width: 28, height: 28, borderRadius: '50%', background: c.color, cursor: 'pointer',
              border: value === c.color ? '3px solid var(--text)' : '3px solid transparent',
              transition: 'border 0.15s',
            }} title={c.name} />
        ))}
      </div>
      {!selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="color" value={custom} onChange={e => { setCustom(e.target.value); onChange(e.target.value) }}
            style={{ width: 32, height: 28, padding: 0, border: '1.5px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{custom}</span>
          <button onClick={() => onChange(custom)} style={{ ...btnSec2, padding: '4px 12px', fontSize: 13 }}>Appliquer</button>
        </div>
      )}
    </div>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <span>
      {text.slice(0, idx)}
      <strong style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '1px 3px', borderRadius: 4, fontWeight: 900 }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </span>
  )
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-5 md:px-9 md:py-8 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)', borderRadius: 10, width: 480, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
// Tailles resserrees vers la cible mobile (meme technique que SectionUsers/SectionClasses) —
// desktop inchangee via md:. fontSize/padding/marginBottom portes par les classNames compagnes.
const sModalTitleCls = 'text-[18px] md:text-[18px] mb-[16px] md:mb-[22px]'
const sModalTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sLabelCls = 'text-[12px] md:text-[13px] mb-[4px] md:mb-[6px]'
const sLabel: React.CSSProperties = { fontWeight: 700, color: 'var(--text3)' }
const sInputCls = 'rounded-[10px] px-[12px] py-[9px] mb-[10px] text-[13px] md:px-[14px] md:py-[10px] md:mb-[14px] md:text-[12px]'
const sInput: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const sError: React.CSSProperties = { background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontWeight: 600, marginBottom: 8 }
const btnPrim: React.CSSProperties = { padding: '10px 14px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec2: React.CSSProperties = { padding: '10px 14px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '7px 12px', borderRadius: 9, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thStyle: React.CSSProperties = { padding: '11px 12px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '11px 12px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
