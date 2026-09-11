'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, School, GraduationCap, Armchair, UserCheck, Trash2, Link2, Check, ArrowLeft } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem {
  id: string; name: string; level: string | null; filiere: string | null; serie: string | null
  capacity: number
  professorPrincipal: { id: string; firstName: string; lastName: string } | null
  _count: { students: number }
}

interface SchoolInfo {
  id: string
  subsystem: string
  hasPEBSFrancophone: boolean
  hasPEBSAnglophone: boolean
}

interface Teacher { id: string; firstName: string; lastName: string }
interface SubGroup { id: string; name: string }
interface StudentItem { id: string; firstName: string; lastName: string; studentProfile?: { id: string } | null }
interface SubjectItem { id: string; name: string }
interface LV2StudentRow { id: string; firstName: string; lastName: string; lv2SubjectId: string | null; pendingId: string | null; saving: boolean }
interface LV2Overview { className: string; groupes: { subjectId: string; langue: string; nombreEleves: number; eleves: { id: string; firstName: string; lastName: string }[] }[]; sansLV2: { id: string; firstName: string; lastName: string }[]; total: number }
interface PEBSStudentRow { id: string; firstName: string; lastName: string; pebsFiliere: string | null; saving: boolean }
interface PEBSOverview { className: string; pebsCount: number; nonPEBSCount: number; total: number; eleves: { id: string; firstName: string; lastName: string; pebsFiliere: string | null }[] }
interface ALevelStudentRow { id: string; firstName: string; lastName: string; subjects: SubjectItem[]; count: number; saving: boolean }
interface ALevelCombo { code: string; type: string; label: string; subjects: string[] }
const ALEVEL_MIN = 3
const ALEVEL_MAX = 5
function isSixthForm(cls: { level: string | null; name: string }): boolean {
  const src = `${cls.level ?? ''} ${cls.name}`.toLowerCase()
  return /sixth|lower\s*6|upper\s*6/.test(src)
}
function isLV2Level(cls: { level: string | null }): boolean {
  if (!cls.level) return false
  return ['4e', '3e', '2nde', '1ère', 'Tle'].includes(cls.level)
}

function serieToFiliere(serie: string): string {
  if (/^A4/.test(serie)) return 'Littéraire'
  if (serie === 'A') return 'Littéraire'
  if (serie === 'C' || serie === 'D') return 'Scientifique'
  if (serie === 'TI') return 'Technique'
  return ''
}

function isCollegLevel(level: string, name: string): boolean {
  const src = (level || name).trim()
  return /^[3456](e|ème|e\s|$)/i.test(src)
}

function inferFromName(name: string): { filiere: string; serie: string } {
  const n = name.trim()
  const a4Match = n.match(/A4[-\s](\w+)/i)
  if (a4Match) return { filiere: 'Littéraire', serie: `A4-${a4Match[1]}` }
  if (/\bA4\b/i.test(n)) return { filiere: 'Littéraire', serie: 'A4' }
  if (/\bTI\b/.test(n)) return { filiere: 'Technique', serie: 'TI' }
  if (/^(Tle|Terminale|1[eèê]re?|Première)\s/i.test(n)) {
    if (/\bC$/i.test(n)) return { filiere: 'Scientifique', serie: 'C' }
    if (/\bD$/i.test(n)) return { filiere: 'Scientifique', serie: 'D' }
  }
  return { filiere: '', serie: '' }
}



const EMPTY_FORM = { name: '', level: '', filiere: '', serie: '', capacity: '40', loading: false, error: '' }
const EMPTY_PP   = { open: false, classId: '', className: '', teacherSearch: '', teachers: [] as Teacher[], selected: null as Teacher | null, loading: false, error: '' }
const EMPTY_MOD  = { open: false, classId: '', name: '', level: '', filiere: '', serie: '', capacity: '', loading: false, error: '' }
const EMPTY_SG   = { open: false, classId: '', className: '', subgroups: [] as SubGroup[], newName: '', creating: false, error: '' }
const EMPTY_ASSIGN = { open: false, subGroupId: '', subGroupName: '', classId: '', students: [] as StudentItem[], selected: new Set<string>(), loading: false, submitting: false, error: '' }
const EMPTY_LV2 = { open: false, classId: '', className: '', rows: [] as LV2StudentRow[], subjects: [] as SubjectItem[], loading: false, error: '', bulkSelected: new Set<string>(), bulkSubjectId: '', bulkAssigning: false }
const EMPTY_PEBS = { open: false, classId: '', className: '', rows: [] as PEBSStudentRow[], loading: false, error: '', bulkSelected: new Set<string>(), bulkValue: '', bulkAssigning: false }
const EMPTY_ALEVEL = { open: false, classId: '', className: '', rows: [] as ALevelStudentRow[], available: [] as SubjectItem[], combos: [] as ALevelCombo[], loading: false, error: '', bulkCombo: '', bulkApplying: false, editingStudentId: '' }

export default function SectionClasses({ onToast }: Props) {
  const t = useT('admin')

  const secondCycleSeries: { value: string; label: string }[] = [
    'A4-Allemand', 'A4-Arabe', 'A4-Chinois', 'A4-Espagnol', 'A', 'C', 'D', 'TI',
  ].map((v, i) => ({ value: v, label: t(`classes.second_cycle_series.${i}.label`) }))

  const filiereOptions: { value: string; label: string }[] = [
    'Scientifique', 'Littéraire', 'Technique',
  ].map((v, i) => ({ value: v, label: t(`classes.filiere_options.${i}.label`) }))

  const [classes, setClasses]         = useState<ClassItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [createOpen, setCreateOpen]   = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [ppForm, setPPForm]           = useState(EMPTY_PP)
  const [modForm, setModForm]         = useState(EMPTY_MOD)
  const [delConfirm, setDelConfirm]   = useState<{ classId: string; className: string } | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [sgForm, setSgForm]           = useState(EMPTY_SG)
  const [assignForm, setAssignForm]   = useState(EMPTY_ASSIGN)
  const [lv2Form, setLV2Form]         = useState(EMPTY_LV2)
  const [pebsForm, setPEBSForm]       = useState(EMPTY_PEBS)
  const [alevelForm, setALevelForm]   = useState(EMPTY_ALEVEL)
  const [schoolInfo, setSchoolInfo]   = useState<SchoolInfo | null>(null)

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      setClasses(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('classes.error.load'))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  // Rafraîchissement temps réel quand l'assistant IA agit sur les classes.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'class') fetchClasses()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchClasses])

  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.data) setSchoolInfo(data.data) })
      .catch(() => {})
  }, [])

  const totalEleves = classes.reduce((s, c) => s + c._count.students, 0)

  // ── Créer une classe ──────────────────────────────────────────────────────
  const submitCreate = async () => {
    if (!form.name.trim()) { setForm(f => ({ ...f, error: t('classes.create_modal.error_required') })); return }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/classes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          level: form.level || undefined,
          filiere: form.filiere || undefined,
          serie: form.serie || undefined,
          capacity: parseInt(form.capacity) || 40,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.toast.created').replace('{name}', form.name.trim()), 'success')
      setCreateOpen(false); setForm(EMPTY_FORM)
      fetchClasses()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : t('classes.error.load'), loading: false }))
    }
  }

  // ── Modifier une classe ───────────────────────────────────────────────────
  const openMod = (cls: ClassItem) => {
    const college = isCollegLevel(cls.level ?? '', cls.name)
    let filiere = cls.filiere ?? ''
    let serie = cls.serie ?? ''
    if (!college) {
      if (!filiere && !serie) {
        const inferred = inferFromName(cls.name)
        filiere = inferred.filiere
        serie = inferred.serie
      } else if (!filiere && serie) {
        filiere = serieToFiliere(serie)
      }
    }
    setModForm({
      open: true, classId: cls.id, name: cls.name, level: cls.level ?? '',
      filiere, serie,
      capacity: String(cls.capacity), loading: false, error: '',
    })
  }

  const submitMod = async () => {
    if (!modForm.name.trim()) { setModForm(f => ({ ...f, error: t('classes.edit_modal.error_required') })); return }
    setModForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/${modForm.classId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modForm.name.trim(),
          level: modForm.level || undefined,
          filiere: modForm.filiere || undefined,
          serie: modForm.serie || undefined,
          capacity: parseInt(modForm.capacity) || 40,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.toast.modified'), 'success')
      setModForm(EMPTY_MOD); fetchClasses()
    } catch (err) {
      setModForm(f => ({ ...f, error: err instanceof Error ? err.message : t('classes.error.load'), loading: false }))
    }
  }

  // ── Assigner PP ───────────────────────────────────────────────────────────
  const openPP = async (cls: ClassItem) => {
    setPPForm({ open: true, classId: cls.id, className: cls.name, teacherSearch: '', teachers: [], selected: null, loading: false, error: '' })
    try {
      const res = await fetchApi('/api/v2/users?role=TEACHER&limit=100', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setPPForm(f => ({ ...f, teachers: data.data || [] }))
    } catch { /* silencieux */ }
  }

  const submitPP = async () => {
    if (!ppForm.selected) { setPPForm(f => ({ ...f, error: t('classes.pp_modal.error_required') })); return }
    setPPForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/${ppForm.classId}/professor-principal`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherUserId: ppForm.selected.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.toast.pp_assigned').replace('{name}', `${ppForm.selected.firstName} ${ppForm.selected.lastName}`), 'success')
      setPPForm(EMPTY_PP); fetchClasses()
    } catch (err) {
      setPPForm(f => ({ ...f, error: err instanceof Error ? err.message : t('classes.error.load'), loading: false }))
    }
  }

  function getFiliereOptions(college: boolean): { value: string; label: string }[] {
    if (!college || !schoolInfo) return []
    const isFR = schoolInfo.subsystem === 'FRANCOPHONE'
    const opts: { value: string; label: string }[] = isFR
      ? [{ value: 'FR_GENERAL', label: t('classes.filiere_labels.FR_GENERAL') }]
      : [{ value: 'EN_GENERAL', label: t('classes.filiere_labels.EN_GENERAL') }]
    if (isFR && schoolInfo.hasPEBSFrancophone) opts.push({ value: 'FR_PEBS', label: t('classes.filiere_labels.FR_PEBS') })
    if (!isFR && schoolInfo.hasPEBSAnglophone) opts.push({ value: 'EN_PEBS', label: t('classes.filiere_labels.EN_PEBS') })
    return opts
  }

  const filteredTeachers = ppForm.teacherSearch
    ? ppForm.teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(ppForm.teacherSearch.toLowerCase()))
    : ppForm.teachers

  // ── ACTION 1 — Supprimer une classe ───────────────────────────────────────
  const confirmDelete = async () => {
    if (!delConfirm) return
    setDeleting(true)
    try {
      const res = await fetchApi(`/api/v2/classes/${delConfirm.classId}`, {
        method: 'DELETE', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.toast.deleted').replace('{name}', delConfirm.className), 'success')
      setClasses(prev => prev.filter(c => c.id !== delConfirm.classId))
      setDelConfirm(null)
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  // ── ACTION 2 — Gérer les sous-groupes ─────────────────────────────────────
  const openSubgroups = (cls: ClassItem) => {
    setSgForm({ open: true, classId: cls.id, className: cls.name, subgroups: [], newName: '', creating: false, error: '' })
  }

  const createSubgroup = async () => {
    if (!sgForm.newName.trim()) { setSgForm(f => ({ ...f, error: 'Nom du sous-groupe obligatoire' })); return }
    setSgForm(f => ({ ...f, creating: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/${sgForm.classId}/subgroups`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sgForm.newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const newSg: SubGroup = { id: data.data.sousGroupeId, name: sgForm.newName.trim() }
      setSgForm(f => ({ ...f, subgroups: [...f.subgroups, newSg], newName: '', creating: false }))
      onToast(t('classes.toast.subgroup_created').replace('{name}', newSg.name), 'success')
    } catch (err) {
      setSgForm(f => ({ ...f, error: err instanceof Error ? err.message : t('classes.error.load'), creating: false }))
    }
  }

  // ── ACTION 3 — Assigner des élèves à un sous-groupe ───────────────────────
  const openAssign = async (sg: SubGroup) => {
    setAssignForm({ open: true, subGroupId: sg.id, subGroupName: sg.name, classId: sgForm.classId, students: [], selected: new Set(), loading: true, submitting: false, error: '' })
    try {
      const res = await fetchApi(`/api/v2/users?role=STUDENT&classId=${sgForm.classId}&limit=200`, { credentials: 'include' })
      const data = await res.json()
      setAssignForm(f => ({ ...f, students: data.data ?? [], loading: false }))
    } catch {
      setAssignForm(f => ({ ...f, loading: false, error: t('classes.subgroups.assign_modal.loading_error') }))
    }
  }

  const toggleStudent = (id: string) => {
    setAssignForm(f => {
      const next = new Set(f.selected)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...f, selected: next }
    })
  }

  const submitAssign = async () => {
    if (assignForm.selected.size === 0) { setAssignForm(f => ({ ...f, error: t('classes.subgroups.assign_modal.selected_error') })); return }
    setAssignForm(f => ({ ...f, submitting: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/subgroups/${assignForm.subGroupId}/students`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentProfileIds: Array.from(assignForm.selected) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.subgroups.assign_modal.toast_success').replace('{name}', assignForm.subGroupName), 'success')
      setAssignForm(EMPTY_ASSIGN)
    } catch (err) {
      setAssignForm(f => ({ ...f, error: err instanceof Error ? err.message : t('classes.error.load'), submitting: false }))
    }
  }

  // ── ACTION LV2 — Répartition LV2 d'une classe ────────────────────────────
  const openLV2 = async (cls: ClassItem) => {
    setLV2Form({ ...EMPTY_LV2, open: true, classId: cls.id, className: cls.name, loading: true })
    try {
      const [overviewRes, subjectsRes] = await Promise.all([
        fetchApi(`/api/v2/classes/${cls.id}/lv2-overview`, { credentials: 'include' }),
        fetchApi('/api/v2/subjects', { credentials: 'include' }),
      ])
      const [overviewData, subjectsData] = await Promise.all([overviewRes.json(), subjectsRes.json()])
      if (!overviewRes.ok) throw new Error(overviewData.message || t('classes.error.load'))
      const overview: LV2Overview = overviewData.data
      const subjects: SubjectItem[] = (subjectsData.data ?? []).sort((a: SubjectItem, b: SubjectItem) => a.name.localeCompare(b.name))

      // Construire une liste plate de tous les élèves avec leur lv2SubjectId courant
      const lv2Map = new Map<string, string>()
      for (const g of overview.groupes) {
        for (const e of g.eleves) lv2Map.set(e.id, g.subjectId)
      }
      const allStudents: { id: string; firstName: string; lastName: string }[] = [
        ...overview.groupes.flatMap(g => g.eleves),
        ...overview.sansLV2,
      ].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))

      const rows: LV2StudentRow[] = allStudents.map(s => ({
        id: s.id, firstName: s.firstName, lastName: s.lastName,
        lv2SubjectId: lv2Map.get(s.id) ?? null, pendingId: null, saving: false,
      }))

      setLV2Form(f => ({ ...f, rows, subjects, loading: false }))
    } catch (err) {
      setLV2Form(f => ({ ...f, loading: false, error: err instanceof Error ? err.message : t('classes.error.load') }))
    }
  }

  const updateStudentLV2 = async (studentId: string, lv2SubjectId: string | null) => {
    setLV2Form(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, pendingId: lv2SubjectId, saving: true } : r) }))
    try {
      const res = await fetchApi(`/api/v2/students/${studentId}/lv2`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lv2SubjectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      setLV2Form(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, lv2SubjectId, pendingId: null, saving: false } : r) }))
    } catch {
      setLV2Form(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, pendingId: null, saving: false } : r) }))
      onToast(t('classes.lv2.update_error'), 'error')
    }
  }

  const bulkAssignLV2 = async () => {
    if (lv2Form.bulkSelected.size === 0 || !lv2Form.bulkSubjectId) return
    setLV2Form(f => ({ ...f, bulkAssigning: true }))
    try {
      const res = await fetchApi('/api/v2/students/lv2/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentUserIds: Array.from(lv2Form.bulkSelected), lv2SubjectId: lv2Form.bulkSubjectId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const assignedId = lv2Form.bulkSubjectId || null
      setLV2Form(f => ({
        ...f, bulkAssigning: false, bulkSelected: new Set(), bulkSubjectId: '',
        rows: f.rows.map(r => f.bulkSelected.has(r.id) ? { ...r, lv2SubjectId: assignedId } : r),
      }))
      onToast(t('classes.lv2.toast_bulk_done').replace('{count}', String(data.data?.modifies ?? lv2Form.bulkSelected.size)), 'success')
    } catch (err) {
      setLV2Form(f => ({ ...f, bulkAssigning: false }))
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  // ── ACTION PEBS — Répartition PEBS d'une classe ──────────────────────────
  const getPEBSOptions = () => {
    const opts: { value: string; label: string }[] = []
    if (schoolInfo?.hasPEBSFrancophone) opts.push({ value: 'FR_PEBS', label: t('classes.pebs.opt_fr') })
    if (schoolInfo?.hasPEBSAnglophone) opts.push({ value: 'EN_PEBS', label: t('classes.pebs.opt_en') })
    return opts
  }

  const openPEBS = async (cls: ClassItem) => {
    setPEBSForm({ ...EMPTY_PEBS, open: true, classId: cls.id, className: cls.name, loading: true })
    try {
      const res = await fetchApi(`/api/v2/classes/${cls.id}/pebs-overview`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const overview: PEBSOverview = data.data

      const rows: PEBSStudentRow[] = overview.eleves.map(s => ({
        id: s.id, firstName: s.firstName, lastName: s.lastName,
        pebsFiliere: s.pebsFiliere, saving: false,
      }))

      setPEBSForm(f => ({ ...f, rows, loading: false }))
    } catch (err) {
      setPEBSForm(f => ({ ...f, loading: false, error: err instanceof Error ? err.message : t('classes.error.load') }))
    }
  }

  const updateStudentPEBS = async (studentId: string, pebsFiliere: string | null) => {
    setPEBSForm(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, saving: true } : r) }))
    try {
      const res = await fetchApi(`/api/v2/students/${studentId}/pebs`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pebsFiliere }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      setPEBSForm(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, pebsFiliere, saving: false } : r) }))
    } catch {
      setPEBSForm(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, saving: false } : r) }))
      onToast(t('classes.pebs.update_error'), 'error')
    }
  }

  const bulkAssignPEBS = async () => {
    if (pebsForm.bulkSelected.size === 0) return
    setPEBSForm(f => ({ ...f, bulkAssigning: true }))
    try {
      const res = await fetchApi('/api/v2/students/pebs/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentUserIds: Array.from(pebsForm.bulkSelected), pebsFiliere: pebsForm.bulkValue || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const assigned = pebsForm.bulkValue || null
      setPEBSForm(f => ({
        ...f, bulkAssigning: false, bulkSelected: new Set(), bulkValue: '',
        rows: f.rows.map(r => f.bulkSelected.has(r.id) ? { ...r, pebsFiliere: assigned } : r),
      }))
      onToast(t('classes.pebs.toast_bulk_done').replace('{count}', String(data.data?.modifies ?? pebsForm.bulkSelected.size)), 'success')
    } catch (err) {
      setPEBSForm(f => ({ ...f, bulkAssigning: false }))
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  // ── ACTION A-Level — choix individuel des matières (Sixth Form) ───────────
  const openALevel = async (cls: ClassItem) => {
    setALevelForm({ ...EMPTY_ALEVEL, open: true, classId: cls.id, className: cls.name, loading: true })
    try {
      const [ovRes, comboRes] = await Promise.all([
        fetchApi(`/api/v2/classes/${cls.id}/alevel-overview`, { credentials: 'include' }),
        fetchApi('/api/v2/onboarding/anglophone-streams', { credentials: 'include' }),
      ])
      const [ov, comboData] = await Promise.all([ovRes.json(), comboRes.json()])
      if (!ovRes.ok) throw new Error(ov.message || t('classes.error.load'))
      const combos: ALevelCombo[] = comboData?.success
        ? [...(comboData.data.arts ?? []), ...(comboData.data.science ?? [])]
        : []
      const rows: ALevelStudentRow[] = (ov.data.students ?? []).map((s: any) => ({
        id: s.id, firstName: s.firstName, lastName: s.lastName, subjects: s.subjects ?? [], count: s.count ?? 0, saving: false,
      }))
      setALevelForm(f => ({ ...f, rows, available: ov.data.availableSubjects ?? [], combos, loading: false }))
    } catch (err) {
      setALevelForm(f => ({ ...f, loading: false, error: err instanceof Error ? err.message : t('classes.error.load') }))
    }
  }

  const saveStudentALevel = async (studentId: string, subjects: SubjectItem[]) => {
    if (subjects.length > ALEVEL_MAX) return
    setALevelForm(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, saving: true } : r) }))
    try {
      const res = await fetchApi(`/api/v2/students/${studentId}/alevel-subjects`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectIds: subjects.map(s => s.id) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      setALevelForm(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, subjects, count: subjects.length, saving: false } : r) }))
    } catch (err) {
      setALevelForm(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, saving: false } : r) }))
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  const toggleStudentSubject = (row: ALevelStudentRow, subject: SubjectItem) => {
    const has = row.subjects.some(s => s.id === subject.id)
    if (!has && row.subjects.length >= ALEVEL_MAX) { onToast(t('classes.alevel.max_error').replace('{max}', String(ALEVEL_MAX)), 'error'); return }
    const next = has ? row.subjects.filter(s => s.id !== subject.id) : [...row.subjects, subject]
    saveStudentALevel(row.id, next)
  }

  const applyComboToStudent = async (studentId: string, combinationCode: string) => {
    if (!combinationCode) return
    setALevelForm(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, saving: true } : r) }))
    try {
      const res = await fetchApi(`/api/v2/students/${studentId}/alevel-subjects/from-combination`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ combinationCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const applied: SubjectItem[] = (data.data?.applied ?? []).map((a: any) => ({ id: a.id, name: a.name }))
      setALevelForm(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, subjects: applied, count: applied.length, saving: false } : r) }))
    } catch (err) {
      setALevelForm(f => ({ ...f, rows: f.rows.map(r => r.id === studentId ? { ...r, saving: false } : r) }))
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  const bulkApplyCombo = async () => {
    if (!alevelForm.bulkCombo) return
    setALevelForm(f => ({ ...f, bulkApplying: true }))
    try {
      const res = await fetchApi(`/api/v2/classes/${alevelForm.classId}/alevel-subjects/bulk-from-combination`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ combinationCode: alevelForm.bulkCombo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.alevel.toast_bulk_done').replace('{count}', String(data.data?.modifies ?? 0)), 'success')
      setALevelForm(f => ({ ...f, bulkApplying: false, bulkCombo: '' }))
      // Recharger la vue d'ensemble
      const ov = await (await fetchApi(`/api/v2/classes/${alevelForm.classId}/alevel-overview`, { credentials: 'include' })).json()
      if (ov?.success) {
        setALevelForm(f => ({ ...f, rows: (ov.data.students ?? []).map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, subjects: s.subjects ?? [], count: s.count ?? 0, saving: false })) }))
      }
    } catch (err) {
      setALevelForm(f => ({ ...f, bulkApplying: false }))
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  function getLevelBadge(name: string): { bg: string; color: string; label: string } {
    const u = name.toUpperCase()
    if (u.startsWith('6') || u.startsWith('5') || u.startsWith('4')) return { bg: 'var(--blue-light)', color: 'var(--blue)', label: t('classes.level_badges.college') }
    if (u.startsWith('3')) return { bg: 'var(--purple-light)', color: 'var(--purple)', label: t('classes.level_badges.bepc') }
    if (u.startsWith('2NDE') || u.startsWith('2')) return { bg: 'var(--orange-light)', color: 'var(--orange)', label: t('classes.level_badges.lycee') }
    if (u.startsWith('1')) return { bg: 'var(--orange-light)', color: 'var(--orange)', label: t('classes.level_badges.lycee') }
    if (u.startsWith('TLE') || u.startsWith('T ') || u.startsWith('T.')) return { bg: 'var(--red-light)', color: 'var(--red)', label: t('classes.level_badges.bac') }
    return { bg: 'var(--bg2)', color: 'var(--text2)', label: name.split(' ')[0] ?? '' }
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="mb-[16px] md:mb-[26px]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('classes.title')}</div>
          <div className="text-[13px] md:text-[14px]" style={sSub}>{loading ? '…' : t('classes.subtitle').replace('{count}', String(classes.length)).replace('{students}', String(totalEleves))}</div>
        </div>
        <button className="hidden md:inline-block" style={btnPrim} onClick={() => setCreateOpen(true)}>{t('classes.btn_create')}</button>
        <button
          className="md:hidden inline-flex items-center gap-[6px] rounded-full px-[14px] py-[10px] text-[12.5px] border-0 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900 }}
          onClick={() => setCreateOpen(true)}>{t('classes.btn_create')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 52 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}
      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 8, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} color="var(--red)" />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchClasses} style={btnRetry}>{t('dashboard.retry')}</button>
        </div>
      )}

      {!loading && !error && classes.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', padding: '39px 20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><School size={16} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('classes.empty.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>{t('classes.empty.desc')}</div>
          <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('classes.btn_create')}</button>
        </div>
      )}

      {!loading && !error && classes.length > 0 && (
        <>
        {/* ── Cartes empilées — mobile (reproduction maquette) ── */}
        <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
          {classes.map(cls => {
            const badge = getLevelBadge(cls.name)
            const ppName = cls.professorPrincipal ? `${cls.professorPrincipal.firstName} ${cls.professorPrincipal.lastName}` : t('classes.pp_not_assigned')
            const cardBtnMobile: React.CSSProperties = { flex: 1, fontSize: 13, fontWeight: 850, color: 'var(--text2)', background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '9px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
            return (
              <div key={cls.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 13, fontWeight: 850, color: 'var(--text)' }}>{cls.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 850, color: badge.color, background: badge.bg, borderRadius: 8, padding: '3px 9px' }}>{badge.label}</span>
                    <button onClick={() => setDelConfirm({ classId: cls.id, className: cls.name })}
                      style={{ width: 26, height: 26, borderRadius: 8, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', flexShrink: 0, cursor: 'pointer' }}>
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)' }}><GraduationCap size={15} strokeWidth={2} color="var(--text3)" /> {t('classes.student_count').replace('{count}', String(cls._count.students))}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)' }}><Armchair size={15} strokeWidth={2} color="var(--text3)" /> {t('classes.capacity_label').replace('{capacity}', String(cls.capacity))}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12.5, color: 'var(--text2)' }}>
                  <UserCheck size={15} strokeWidth={2} color="var(--text3)" /> {t('classes.pp_label')} <span style={{ fontStyle: cls.professorPrincipal ? 'normal' : 'italic', color: cls.professorPrincipal ? 'var(--text2)' : 'var(--text3)' }}>{ppName}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {(() => {
                    const pebsBadge = (cls as any).pebsBadge as string | null
                    const isPEBSFiliere = cls.filiere === 'FR_PEBS' || cls.filiere === 'EN_PEBS'
                    if (pebsBadge === 'PEBS' || isPEBSFiliere) {
                      const label = cls.filiere === 'EN_PEBS' ? 'PEBS EN' : 'PEBS FR'
                      return <span style={{ fontSize: 12, fontWeight: 850, color: 'var(--green)', background: 'var(--green-light)', borderRadius: 8, padding: '4px 10px' }}>{label}</span>
                    }
                    if (pebsBadge === 'MIXTE') return <span style={{ fontSize: 12.5, fontWeight: 850, color: '#b45309', background: 'rgba(234,179,8,0.12)', borderRadius: 8, padding: '4px 10px' }}>{t('classes.filiere_labels.MIXTE')}</span>
                    if (pebsBadge === 'GENERAL') return <span style={{ fontSize: 12.5, fontWeight: 850, color: 'var(--blue)', background: 'var(--blue-light)', borderRadius: 8, padding: '4px 10px' }}>{t('classes.filiere_labels.GENERAL')}</span>
                    if (cls.filiere && !['FR_PEBS', 'EN_PEBS', 'FR_GENERAL', 'EN_GENERAL'].includes(cls.filiere)) return <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-light)', borderRadius: 8, padding: '4px 10px' }}>{cls.filiere}</span>
                    return null
                  })()}
                  {cls.serie && <span style={{ fontSize: 12, fontWeight: 850, color: 'var(--text2)', background: 'var(--bg2)', borderRadius: 8, padding: '4px 10px' }}>{t('classes.serie_label').replace('{serie}', cls.serie)}</span>}
                  {/* LV2/PEBS — pas d'équivalent maquette : intégrés comme pastilles dans la ligne
                      des tags (filière/série), pas comme boutons pleine largeur dans le pied. */}
                  {isLV2Level(cls) && (
                    <button onClick={() => openLV2(cls)}
                      style={{ fontSize: 12, fontWeight: 850, color: 'var(--blue)', background: 'var(--blue-light)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {t('classes.btn_lv2')}
                    </button>
                  )}
                  {(schoolInfo?.hasPEBSFrancophone || schoolInfo?.hasPEBSAnglophone) && (
                    <button onClick={() => openPEBS(cls)}
                      style={{ fontSize: 12, fontWeight: 850, color: 'var(--green)', background: 'var(--green-light)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {t('classes.btn_pebs')}
                    </button>
                  )}
                  {isSixthForm(cls) && (
                    <button onClick={() => openALevel(cls)}
                      style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--purple)', background: 'var(--purple-light)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {t('classes.btn_alevel')}
                    </button>
                  )}
                </div>
                {/* Pied — exactement les 3 boutons de la maquette (PP/Modifier/Sous-groupes,
                    ratios 1/1/1.4), pas de retour à la ligne. */}
                <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bg2)' }}>
                  <button onClick={() => openPP(cls)} style={cardBtnMobile}>{t('classes.btn_pp')}</button>
                  <button onClick={() => openMod(cls)} style={cardBtnMobile}>{t('classes.btn_edit')}</button>
                  <button onClick={() => openSubgroups(cls)} style={{ ...cardBtnMobile, flex: 1.4 }}>{t('classes.btn_subgroups')}</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Grille — desktop (inchangée) ── */}
        <div className="hidden md:grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {classes.map(cls => {
            const badge = getLevelBadge(cls.name)
            const ppName = cls.professorPrincipal ? `${cls.professorPrincipal.firstName} ${cls.professorPrincipal.lastName}` : t('classes.pp_not_assigned')
            return (
              <div key={cls.id}
                style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', padding: 15, transition: 'all 0.15s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)', borderColor: 'var(--border2)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none', borderColor: 'var(--border)' })}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{cls.name}</div>
                  <span style={{ background: badge.bg, color: badge.color, padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800 }}>{badge.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 11, fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GraduationCap size={15} /> {t('classes.student_count').replace('{count}', String(cls._count.students))}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Armchair size={15} /> {t('classes.capacity_label').replace('{capacity}', String(cls.capacity))}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserCheck size={15} /> {t('classes.pp_label')} <strong style={{ color: cls.professorPrincipal ? 'var(--text2)' : 'var(--text3)', fontStyle: cls.professorPrincipal ? 'normal' : 'italic' }}>{ppName}</strong>
                </div>
                <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(() => {
                    const badge = (cls as any).pebsBadge as string | null;
                    const isPEBSFiliere = cls.filiere === 'FR_PEBS' || cls.filiere === 'EN_PEBS';
                    if (badge === 'PEBS' || isPEBSFiliere) {
                      const label = cls.filiere === 'EN_PEBS' ? 'PEBS EN' : 'PEBS FR';
                      return <span style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--green)', padding: '3px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{label}</span>;
                    }
                    if (badge === 'MIXTE') {
                      return <span style={{ background: 'rgba(234,179,8,0.12)', color: '#b45309', padding: '3px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{t('classes.filiere_labels.MIXTE')}</span>;
                    }
                    if (badge === 'GENERAL') {
                      return <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{t('classes.filiere_labels.GENERAL')}</span>;
                    }
                    if (cls.filiere && !['FR_PEBS', 'EN_PEBS', 'FR_GENERAL', 'EN_GENERAL'].includes(cls.filiere)) {
                      return <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{cls.filiere}</span>;
                    }
                    return null;
                  })()}
                  {cls.serie && (
                    <span style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '3px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{t('classes.serie_label').replace('{serie}', cls.serie)}</span>
                  )}
                </div>
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button onClick={() => openPP(cls)} style={btnSecSm}>{t('classes.btn_pp')}</button>
                  <button onClick={() => openMod(cls)} style={btnSecSm}>{t('classes.btn_edit')}</button>
                  <button onClick={() => openSubgroups(cls)} style={btnSecSm}>{t('classes.btn_subgroups')}</button>
                  {isLV2Level(cls) && (
                    <button onClick={() => openLV2(cls)} style={{ ...btnSecSm, color: 'var(--blue)', borderColor: 'rgba(3,105,161,0.3)' }}>{t('classes.btn_lv2')}</button>
                  )}
                  {(schoolInfo?.hasPEBSFrancophone || schoolInfo?.hasPEBSAnglophone) && (
                    <button onClick={() => openPEBS(cls)} style={{ ...btnSecSm, color: 'var(--green)', borderColor: 'rgba(22,163,74,0.3)' }}>{t('classes.btn_pebs')}</button>
                  )}
                  {isSixthForm(cls) && (
                    <button onClick={() => openALevel(cls)} style={{ ...btnSecSm, color: 'var(--purple)', borderColor: 'rgba(124,58,237,0.3)' }}>{t('classes.btn_alevel')}</button>
                  )}
                  <button onClick={() => setDelConfirm({ classId: cls.id, className: cls.name })} style={{ ...btnSecSm, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)', display: 'inline-flex', alignItems: 'center' }}><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}

      {/* ── Modal créer ── */}
      {createOpen && (() => {
        const college = isCollegLevel(form.level, form.name)
        return (
        <ModalOverlay onClose={() => { setCreateOpen(false); setForm(EMPTY_FORM) }}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('classes.create_modal.title')}</div>
          <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.name_label')}</div>
          <input className={sInputCls} style={sInput} placeholder={t('classes.create_modal.name_placeholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.level_label')}</div>
              <input className={sInputCls} style={sInput} placeholder={t('classes.create_modal.level_placeholder')} value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} />
            </div>
            <div>
              <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.filiere_label')}</div>
              {college ? (
                <select className={sInputCls} style={sInput} value={form.filiere} onChange={e => setForm(f => ({ ...f, filiere: e.target.value }))}>
                  <option value="">{t('classes.create_modal.filiere_select')}</option>
                  {getFiliereOptions(college).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <select className={sInputCls} style={sInput} value={form.filiere} onChange={e => setForm(f => ({ ...f, filiere: e.target.value }))}>
                  <option value="">{t('classes.create_modal.filiere_select_empty')}</option>
                  {filiereOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>
            {!college && (
              <div>
                <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.serie_label')}</div>
                <select className={sInputCls} style={sInput} value={form.serie} onChange={e => {
                  const serie = e.target.value
                  setForm(f => ({ ...f, serie, filiere: f.filiere || serieToFiliere(serie) }))
                }}>
                  <option value="">{t('classes.create_modal.serie_select_empty')}</option>
                  {secondCycleSeries.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.capacity_label')}</div>
              <input className={sInputCls} style={sInput} type="number" min="1" max="200" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          {form.error && <div style={sError}>{form.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => { setCreateOpen(false); setForm(EMPTY_FORM) }}>{t('classes.create_modal.btn_cancel')}</button>
            <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={submitCreate} disabled={form.loading}>
              {form.loading ? t('classes.create_modal.creating') : t('classes.create_modal.btn_create')}
            </button>
          </div>
        </ModalOverlay>
        )
      })()}

      {/* ── Modal modifier ── */}
      {modForm.open && (() => {
        const college = isCollegLevel(modForm.level, modForm.name)
        return (
        <ModalOverlay onClose={() => setModForm(EMPTY_MOD)}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('classes.edit_modal.title')}</div>
          <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.name_label')}</div>
          <input className={sInputCls} style={sInput} value={modForm.name} onChange={e => setModForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.level_label')}</div>
              <input className={sInputCls} style={sInput} placeholder={t('classes.edit_modal.level_placeholder')} value={modForm.level} onChange={e => setModForm(f => ({ ...f, level: e.target.value }))} />
            </div>
            <div>
              <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.filiere_label')}</div>
              {college ? (
                <select className={sInputCls} style={sInput} value={modForm.filiere} onChange={e => setModForm(f => ({ ...f, filiere: e.target.value }))}>
                  <option value="">{t('classes.create_modal.filiere_select')}</option>
                  {getFiliereOptions(college).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <select className={sInputCls} style={sInput} value={modForm.filiere} onChange={e => setModForm(f => ({ ...f, filiere: e.target.value }))}>
                  <option value="">{t('classes.create_modal.filiere_select_empty')}</option>
                  {filiereOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>
            {!college && (
              <div>
                <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.serie_label')}</div>
                <select className={sInputCls} style={sInput} value={modForm.serie} onChange={e => {
                  const serie = e.target.value
                  setModForm(f => ({ ...f, serie, filiere: f.filiere || serieToFiliere(serie) }))
                }}>
                  <option value="">{t('classes.create_modal.serie_select_empty')}</option>
                  {secondCycleSeries.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.capacity_label')}</div>
              <input className={sInputCls} style={sInput} type="number" min="1" value={modForm.capacity} onChange={e => setModForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          {modForm.error && <div style={sError}>{modForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setModForm(EMPTY_MOD)}>{t('classes.edit_modal.btn_cancel')}</button>
            <button style={{ ...btnPrim, flex: 1, opacity: modForm.loading ? 0.7 : 1 }} onClick={submitMod} disabled={modForm.loading}>
              {modForm.loading ? t('classes.edit_modal.saving') : t('classes.edit_modal.btn_save')}
            </button>
          </div>
        </ModalOverlay>
        )
      })()}

      {/* ── Modal assigner PP ── */}
      {ppForm.open && (
        <ModalOverlay onClose={() => setPPForm(EMPTY_PP)}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('classes.pp_modal.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 13 }}>{t('classes.pp_modal.class_name').replace('{name}', ppForm.className)}</div>
          <div className={sLabelCls} style={sLabel}>{t('classes.pp_modal.search_label')}</div>
          <input className={sInputCls} style={sInput} placeholder={t('classes.pp_modal.search_placeholder')} value={ppForm.teacherSearch}
            onChange={e => setPPForm(f => ({ ...f, teacherSearch: e.target.value, selected: null }))} />
          {ppForm.selected && (
            <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '8px 11px', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> {ppForm.selected.firstName} {ppForm.selected.lastName}
            </div>
          )}
          {!ppForm.selected && (
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {filteredTeachers.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('classes.pp_modal.no_teacher')}</div>
              ) : filteredTeachers.map(t => (
                <div key={t.id}
                  onClick={() => setPPForm(f => ({ ...f, selected: t, teacherSearch: `${t.firstName} ${t.lastName}` }))}
                  style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--bg2)', color: 'var(--text)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                  {t.firstName} {t.lastName}
                </div>
              ))}
            </div>
          )}
          {ppForm.error && <div style={sError}>{ppForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setPPForm(EMPTY_PP)}>{t('classes.pp_modal.btn_cancel')}</button>
            <button style={{ ...btnPrim, flex: 1, opacity: ppForm.loading ? 0.7 : 1 }} onClick={submitPP} disabled={ppForm.loading}>
              {ppForm.loading ? t('classes.pp_modal.assigning') : t('classes.pp_modal.btn_assign')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── ACTION 1 : Confirmation de suppression ── */}
      {delConfirm && (
        <ModalOverlay onClose={() => !deleting && setDelConfirm(null)}>
          <div className={sModalTitleCls} style={{ ...sModalTitle, color: 'var(--red)' }}>{t('classes.delete_modal.title')}</div>
          <div className="text-[13.5px] md:text-[13px] mb-[18px] md:mb-[24px]" style={{ color: 'var(--text2)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: t('classes.delete_modal.confirm').replace('{name}', delConfirm.className) }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setDelConfirm(null)} disabled={deleting}>{t('classes.delete_modal.btn_cancel')}</button>
            <button
              style={{ ...btnPrim, flex: 1, background: 'linear-gradient(135deg,var(--red),var(--red))', opacity: deleting ? 0.7 : 1 }}
              onClick={confirmDelete} disabled={deleting}>
              {deleting ? t('classes.delete_modal.deleting') : t('classes.delete_modal.btn_confirm')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── ACTION 2 : Gérer les sous-groupes ── */}
      {sgForm.open && !assignForm.open && (
        <ModalOverlay onClose={() => setSgForm(EMPTY_SG)}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('classes.subgroups.title').replace('{name}', sgForm.className)}</div>

          {/* Liste des sous-groupes existants */}
          {sgForm.subgroups.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 13, fontStyle: 'italic' }}>
              {t('classes.subgroups.empty')}
            </div>
          ) : (
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 13 }}>
              {sgForm.subgroups.map((sg, i) => (
                <div key={sg.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: i < sgForm.subgroups.length - 1 ? '1px solid var(--bg2)' : 'none', fontSize: 12, color: 'var(--text)' }}>
                  <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Link2 size={14} /> {sg.name}</span>
                  <button onClick={() => openAssign(sg)} style={btnSecSm}>
                    {t('classes.subgroups.btn_assign')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Créer un nouveau sous-groupe */}
          <div className={sLabelCls} style={sLabel}>{t('classes.subgroups.new_name_label')}</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              className={sInputCls} style={{ ...sInput, marginBottom: 0, flex: 1 }}
              placeholder={t('classes.subgroups.new_name_placeholder')}
              value={sgForm.newName}
              onChange={e => setSgForm(f => ({ ...f, newName: e.target.value, error: '' }))}
              onKeyDown={e => e.key === 'Enter' && createSubgroup()}
            />
            <button
              style={{ ...btnPrim, whiteSpace: 'nowrap', opacity: sgForm.creating ? 0.7 : 1 }}
              onClick={createSubgroup} disabled={sgForm.creating}>
              {sgForm.creating ? '…' : t('classes.subgroups.btn_create')}
            </button>
          </div>
          {sgForm.error && <div style={{ ...sError, marginBottom: 12 }}>{sgForm.error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button style={btnSec2} onClick={() => setSgForm(EMPTY_SG)}>{t('classes.subgroups.btn_close')}</button>
          </div>
        </ModalOverlay>
      )}

      {/* ── ACTION LV2 : Répartition LV2 d'une classe ── */}
      {lv2Form.open && (
        <div onClick={() => setLV2Form(EMPTY_LV2)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, width: 680, maxWidth: '96vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className={sModalTitleCls} style={sModalTitle}>{t('classes.lv2.title').replace('{name}', lv2Form.className)}</div>
              <button onClick={() => setLV2Form(EMPTY_LV2)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', lineHeight: 1 }}>×</button>
            </div>

            {/* Compteur par langue */}
            {!lv2Form.loading && lv2Form.rows.length > 0 && (() => {
              const counts = new Map<string, { name: string; count: number }>()
              for (const r of lv2Form.rows) {
                if (r.lv2SubjectId) {
                  const sub = lv2Form.subjects.find(s => s.id === r.lv2SubjectId)
                  const name = sub?.name ?? r.lv2SubjectId
                  const prev = counts.get(r.lv2SubjectId)
                  counts.set(r.lv2SubjectId, { name, count: (prev?.count ?? 0) + 1 })
                }
              }
              const sansCount = lv2Form.rows.filter(r => !r.lv2SubjectId).length
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {Array.from(counts.values()).map(({ name, count }) => (
                    <span key={name} style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '4px 12px', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>
                      {name}: {count}
                    </span>
                  ))}
                  {sansCount > 0 && (
                    <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '4px 12px', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>
                      {t('classes.lv2.unassigned').replace('{count}', String(sansCount))}
                    </span>
                  )}
                </div>
              )
            })()}

            {lv2Form.loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 31 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            ) : lv2Form.error ? (
              <div style={sError}>{lv2Form.error}</div>
            ) : lv2Form.rows.length === 0 ? (
              <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>{t('classes.lv2.no_students')}</div>
            ) : (
              <>
                {/* Bulk action bar */}
                {lv2Form.bulkSelected.size > 0 && (
                  <div style={{ background: 'var(--blue-light)', border: '1.5px solid var(--blue-light)', borderRadius: 8, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{t('classes.lv2.bulk_selected').replace('{count}', String(lv2Form.bulkSelected.size))}</span>
                    <select
                      value={lv2Form.bulkSubjectId}
                      onChange={e => setLV2Form(f => ({ ...f, bulkSubjectId: e.target.value }))}
                      className={sInputCls} style={{ ...sInput, marginBottom: 0, flex: 1, minWidth: 140, fontSize: 13 }}>
                      <option value="">{t('classes.lv2.bulk_clear_option')}</option>
                      {lv2Form.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button
                      style={{ ...btnPrim, fontSize: 13, padding: '7px 12px', opacity: lv2Form.bulkAssigning ? 0.7 : 1 }}
                      onClick={bulkAssignLV2} disabled={lv2Form.bulkAssigning}>
                      {lv2Form.bulkAssigning ? t('classes.lv2.bulk_assigning') : t('classes.lv2.btn_bulk_assign')}
                    </button>
                    <button
                      style={{ ...btnSec2, fontSize: 13, padding: '7px 11px' }}
                      onClick={() => setLV2Form(f => ({ ...f, bulkSelected: new Set() }))}>
                      {t('classes.lv2.btn_deselect_all')}
                    </button>
                  </div>
                )}

                {/* Liste des élèves */}
                <div style={{ overflowY: 'auto', flex: 1, border: '1.5px solid var(--border)', borderRadius: 8 }}>
                  {/* En-tête */}
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 200px', gap: 10, padding: '8px 11px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', position: 'sticky', top: 0 }}>
                    <div><input type="checkbox"
                      checked={lv2Form.rows.length > 0 && lv2Form.bulkSelected.size === lv2Form.rows.length}
                      onChange={e => setLV2Form(f => ({ ...f, bulkSelected: e.target.checked ? new Set(f.rows.map(r => r.id)) : new Set() }))}
                      style={{ accentColor: 'var(--blue)', cursor: 'pointer' }} /></div>
                    <div>{t('classes.lv2.col_el')}</div>
                    <div>{t('classes.lv2.col_lv2')}</div>
                  </div>

                  {lv2Form.rows.map((row, i) => {
                    const currentSub = lv2Form.subjects.find(s => s.id === row.lv2SubjectId)
                    return (
                      <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 200px', gap: 10, padding: '8px 11px', alignItems: 'center', borderBottom: i < lv2Form.rows.length - 1 ? '1px solid var(--bg2)' : 'none', background: lv2Form.bulkSelected.has(row.id) ? 'var(--blue-light)' : 'white' }}>
                        <div>
                          <input type="checkbox"
                            checked={lv2Form.bulkSelected.has(row.id)}
                            onChange={() => setLV2Form(f => {
                              const next = new Set(f.bulkSelected)
                              next.has(row.id) ? next.delete(row.id) : next.add(row.id)
                              return { ...f, bulkSelected: next }
                            })}
                            style={{ accentColor: 'var(--blue)', cursor: 'pointer' }} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{row.lastName} {row.firstName}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {row.saving ? (
                            <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', flexShrink: 0 }} />
                          ) : currentSub ? (
                            <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 9px', borderRadius: 8, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{currentSub.name}</span>
                          ) : (
                            <span style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700, fontStyle: 'italic' }}>{t('classes.lv2.unassigned_label')}</span>
                          )}
                          <select
                            value={row.lv2SubjectId ?? ''}
                            disabled={row.saving}
                            onChange={e => updateStudentLV2(row.id, e.target.value || null)}
                            style={{ fontSize: 12, border: '1px solid var(--border2)', borderRadius: 7, padding: '3px 6px', color: 'var(--text2)', background: 'var(--surface)', cursor: 'pointer', maxWidth: 110 }}>
                            <option value="">— Aucune —</option>
                            {lv2Form.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={btnSec2} onClick={() => setLV2Form(EMPTY_LV2)}>{t('classes.subgroups.btn_close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION PEBS : Répartition PEBS d'une classe ── */}
      {pebsForm.open && (
        <div onClick={() => setPEBSForm(EMPTY_PEBS)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, width: 680, maxWidth: '96vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className={sModalTitleCls} style={sModalTitle}>{t('classes.pebs.title').replace('{name}', pebsForm.className)}</div>
              <button onClick={() => setPEBSForm(EMPTY_PEBS)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', lineHeight: 1 }}>×</button>
            </div>

            {/* Compteur PEBS / non-PEBS */}
            {!pebsForm.loading && pebsForm.rows.length > 0 && (() => {
              const pebsCount = pebsForm.rows.filter(r => r.pebsFiliere !== null).length
              const nonCount = pebsForm.rows.filter(r => r.pebsFiliere === null).length
              const frCount = pebsForm.rows.filter(r => r.pebsFiliere === 'FR_PEBS').length
              const enCount = pebsForm.rows.filter(r => r.pebsFiliere === 'EN_PEBS').length
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {frCount > 0 && (
                    <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '4px 12px', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>
                      {t('classes.pebs.count_fr').replace('{count}', String(frCount))}
                    </span>
                  )}
                  {enCount > 0 && (
                    <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '4px 12px', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>
                      {t('classes.pebs.count_en').replace('{count}', String(enCount))}
                    </span>
                  )}
                  {pebsCount > 0 && (
                    <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '4px 12px', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>
                      {t('classes.pebs.total_pebs').replace('{count}', String(pebsCount))}
                    </span>
                  )}
                  {nonCount > 0 && (
                    <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '4px 12px', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>
                      {t('classes.pebs.non_pebs').replace('{count}', String(nonCount))}
                    </span>
                  )}
                </div>
              )
            })()}

            {pebsForm.loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 31 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            ) : pebsForm.error ? (
              <div style={sError}>{pebsForm.error}</div>
            ) : pebsForm.rows.length === 0 ? (
              <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>{t('classes.pebs.no_students')}</div>
            ) : (
              <>
                {/* Bulk action bar */}
                {pebsForm.bulkSelected.size > 0 && (
                  <div style={{ background: 'var(--green-light)', border: '1.5px solid var(--green-light)', borderRadius: 8, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{t('classes.pebs.bulk_selected').replace('{count}', String(pebsForm.bulkSelected.size))}</span>
                    <select
                      value={pebsForm.bulkValue}
                      onChange={e => setPEBSForm(f => ({ ...f, bulkValue: e.target.value }))}
                      className={sInputCls} style={{ ...sInput, marginBottom: 0, flex: 1, minWidth: 140, fontSize: 13 }}>
                      <option value="">{t('classes.pebs.bulk_clear_option')}</option>
                      {getPEBSOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                      style={{ ...btnPrim, fontSize: 13, padding: '7px 12px', opacity: pebsForm.bulkAssigning ? 0.7 : 1 }}
                      onClick={bulkAssignPEBS} disabled={pebsForm.bulkAssigning}>
                      {pebsForm.bulkAssigning ? t('classes.pebs.bulk_assigning') : t('classes.pebs.btn_bulk_assign')}
                    </button>
                    <button
                      style={{ ...btnSec2, fontSize: 13, padding: '7px 11px' }}
                      onClick={() => setPEBSForm(f => ({ ...f, bulkSelected: new Set() }))}>
                      {t('classes.pebs.btn_deselect_all')}
                    </button>
                  </div>
                )}

                {/* Liste des élèves */}
                <div style={{ overflowY: 'auto', flex: 1, border: '1.5px solid var(--border)', borderRadius: 8 }}>
                  {/* En-tête */}
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 160px', gap: 10, padding: '8px 11px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', position: 'sticky', top: 0 }}>
                    <div><input type="checkbox"
                      checked={pebsForm.rows.length > 0 && pebsForm.bulkSelected.size === pebsForm.rows.length}
                      onChange={e => setPEBSForm(f => ({ ...f, bulkSelected: e.target.checked ? new Set(f.rows.map(r => r.id)) : new Set() }))}
                      style={{ accentColor: 'var(--green)', cursor: 'pointer' }} /></div>
                    <div>{t('classes.pebs.col_el')}</div>
                    <div>{t('classes.pebs.col_status')}</div>
                  </div>

                  {pebsForm.rows.map((row, i) => {
                    const pebsLabel = row.pebsFiliere === 'FR_PEBS' ? t('classes.pebs.status_fr')
                      : row.pebsFiliere === 'EN_PEBS' ? t('classes.pebs.status_en')
                      : null
                    return (
                      <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 160px', gap: 10, padding: '8px 11px', alignItems: 'center', borderBottom: i < pebsForm.rows.length - 1 ? '1px solid var(--bg2)' : 'none', background: pebsForm.bulkSelected.has(row.id) ? 'var(--green-light)' : 'white' }}>
                        <div>
                          <input type="checkbox"
                            checked={pebsForm.bulkSelected.has(row.id)}
                            onChange={() => setPEBSForm(f => {
                              const next = new Set(f.bulkSelected)
                              next.has(row.id) ? next.delete(row.id) : next.add(row.id)
                              return { ...f, bulkSelected: next }
                            })}
                            style={{ accentColor: 'var(--green)', cursor: 'pointer' }} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{row.lastName} {row.firstName}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {row.saving ? (
                            <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', flexShrink: 0 }} />
                          ) : pebsLabel ? (
                            <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 9px', borderRadius: 8, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{pebsLabel}</span>
                          ) : (
                            <span style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '2px 9px', borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{t('classes.filiere_labels.GENERAL')}</span>
                          )}
                          <select
                            value={row.pebsFiliere ?? ''}
                            disabled={row.saving}
                            onChange={e => updateStudentPEBS(row.id, e.target.value || null)}
                            style={{ fontSize: 12, border: '1px solid var(--border2)', borderRadius: 7, padding: '3px 6px', color: 'var(--text2)', background: 'var(--surface)', cursor: 'pointer', maxWidth: 110 }}>
                            <option value="">— Aucun —</option>
                            {getPEBSOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={btnSec2} onClick={() => setPEBSForm(EMPTY_PEBS)}>{t('classes.subgroups.btn_close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION A-Level : choix individuel des matières (Sixth Form) ── */}
      {alevelForm.open && (
        <div onClick={() => setALevelForm(EMPTY_ALEVEL)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-5 md:px-7 md:py-5" style={{ background: 'var(--surface)', borderRadius: 10, width: 720, maxWidth: '96vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className={sModalTitleCls} style={sModalTitle}>{t('classes.alevel.title').replace('{name}', alevelForm.className)}</div>
              <button onClick={() => setALevelForm(EMPTY_ALEVEL)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>
              Chaque élève choisit entre {ALEVEL_MIN} et {ALEVEL_MAX} matières. Les combinaisons ne sont qu'un point de départ personnalisable.
            </div>

            {alevelForm.loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 31 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--purple)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            ) : alevelForm.error ? (
              <div style={sError}>{alevelForm.error}</div>
            ) : alevelForm.rows.length === 0 ? (
              <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>{t('classes.lv2.no_students')}</div>
            ) : (
              <>
                {/* Barre d'action de masse */}
                <div style={{ background: 'var(--purple-light)', border: '1.5px solid var(--purple-light)', borderRadius: 8, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>Combinaison de départ pour toute la classe :</span>
                  <select value={alevelForm.bulkCombo} onChange={e => setALevelForm(f => ({ ...f, bulkCombo: e.target.value }))} className={sInputCls} style={{ ...sInput, marginBottom: 0, flex: 1, minWidth: 160, fontSize: 13 }}>
                    <option value="">— Choisir —</option>
                    {alevelForm.combos.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
                  </select>
                  <button style={{ ...btnPrim, background: 'var(--purple)', fontSize: 13, padding: '7px 12px', opacity: (!alevelForm.bulkCombo || alevelForm.bulkApplying) ? 0.6 : 1 }}
                    onClick={bulkApplyCombo} disabled={!alevelForm.bulkCombo || alevelForm.bulkApplying}>
                    {alevelForm.bulkApplying ? 'En cours…' : 'Appliquer à tous'}
                  </button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, border: '1.5px solid var(--border)', borderRadius: 8 }}>
                  {alevelForm.rows.map((row, i) => {
                    const incomplete = row.count < ALEVEL_MIN
                    const editing = alevelForm.editingStudentId === row.id
                    return (
                      <div key={row.id} style={{ padding: '10px 11px', borderBottom: i < alevelForm.rows.length - 1 ? '1px solid var(--bg2)' : 'none', background: editing ? 'var(--purple-light)' : 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 150 }}>{row.lastName} {row.firstName}</span>
                          <span style={{ background: incomplete ? 'var(--red-light)' : 'var(--purple-light)', color: incomplete ? 'var(--red)' : 'var(--purple)', padding: '2px 9px', borderRadius: 8, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {row.count}/{ALEVEL_MAX}{incomplete && <AlertTriangle size={11} />}
                          </span>
                          {row.saving && <div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--purple)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />}
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                            {row.subjects.map(s => (
                              <span key={s.id} style={{ background: 'var(--purple-light)', color: 'var(--purple)', padding: '2px 8px', borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>{s.name}</span>
                            ))}
                            {row.count === 0 && <span style={{ color: 'var(--red)', fontSize: 12, fontStyle: 'italic', fontWeight: 700 }}>Aucune matière</span>}
                          </div>
                          <select value="" disabled={row.saving} onChange={e => { if (e.target.value) applyComboToStudent(row.id, e.target.value) }}
                            style={{ fontSize: 12, border: '1px solid var(--border2)', borderRadius: 7, padding: '3px 6px', color: 'var(--text2)', background: 'var(--surface)', cursor: 'pointer', maxWidth: 120 }}>
                            <option value="">Préréglage…</option>
                            {alevelForm.combos.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                          </select>
                          <button style={{ ...btnSecSm, color: 'var(--purple)', borderColor: 'rgba(124,58,237,0.3)', padding: '5px 12px' }}
                            onClick={() => setALevelForm(f => ({ ...f, editingStudentId: editing ? '' : row.id }))}>
                            {editing ? t('classes.subgroups.btn_close') : t('classes.btn_edit')}
                          </button>
                        </div>

                        {editing && (
                          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {alevelForm.available.map(subj => {
                              const selected = row.subjects.some(s => s.id === subj.id)
                              const blocked = !selected && row.count >= ALEVEL_MAX
                              return (
                                <button key={subj.id} disabled={row.saving || blocked}
                                  onClick={() => toggleStudentSubject(row, subj)}
                                  style={{
                                    padding: '5px 11px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: (row.saving || blocked) ? 'not-allowed' : 'pointer',
                                    border: `1.5px solid ${selected ? 'var(--purple)' : 'var(--border)'}`, background: selected ? 'var(--purple)' : 'white',
                                    color: selected ? 'white' : blocked ? 'var(--border2)' : 'var(--text2)', opacity: blocked ? 0.5 : 1,
                                  }}>
                                  {selected && <Check size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />}{subj.name}
                                </button>
                              )
                            })}
                            {alevelForm.available.length === 0 && (
                              <span style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>Aucune matière A-Level disponible dans cet établissement.</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={12} /> = sélection incomplète (moins de {ALEVEL_MIN} matières). Les modifications sont enregistrées automatiquement.
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button style={btnSec2} onClick={() => setALevelForm(EMPTY_ALEVEL)}>{t('classes.subgroups.btn_close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION 3 : Assigner des élèves à un sous-groupe ── */}
      {assignForm.open && (
        <ModalOverlay onClose={() => setAssignForm(EMPTY_ASSIGN)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button
              onClick={() => setAssignForm(EMPTY_ASSIGN)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, lineHeight: 1, display: 'flex' }}>
              <ArrowLeft size={15} />
            </button>
            <div className={sModalTitleCls} style={sModalTitle}>{t('classes.subgroups.btn_assign')}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 13 }}>
            Sous-groupe : <strong style={{ color: 'var(--text2)' }}>{assignForm.subGroupName}</strong>
          </div>

          {assignForm.loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
            </div>
          ) : assignForm.students.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: '16px', fontStyle: 'italic' }}>
              {t('classes.lv2.no_students')}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                {t('classes.lv2.bulk_selected').replace('{count}', String(assignForm.selected.size))}
              </div>
              <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 10 }}>
                {assignForm.students.map((s, i) => {
                  const profileId = s.studentProfile?.id ?? s.id
                  return (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', cursor: 'pointer', borderBottom: i < assignForm.students.length - 1 ? '1px solid var(--bg2)' : 'none', fontSize: 12, color: 'var(--text)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <input
                        type="checkbox"
                        checked={assignForm.selected.has(profileId)}
                        onChange={() => toggleStudent(profileId)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--green)' }}
                      />
                      {s.firstName} {s.lastName}
                    </label>
                  )
                })}
              </div>
            </>
          )}

          {assignForm.error && <div style={{ ...sError, marginBottom: 12 }}>{assignForm.error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setAssignForm(EMPTY_ASSIGN)}>{t('classes.create_modal.btn_cancel')}</button>
            <button
              style={{ ...btnPrim, flex: 1, opacity: (assignForm.submitting || assignForm.selected.size === 0) ? 0.6 : 1 }}
              onClick={submitAssign}
              disabled={assignForm.submitting || assignForm.selected.size === 0 || assignForm.loading}>
              {assignForm.submitting ? t('classes.edit_modal.saving') : t('classes.edit_modal.btn_save')}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
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
// Tailles resserrees vers la cible mobile (meme technique que SectionUsers) — desktop inchangee
// via md:. fontSize/padding/marginBottom retires des objets style (toujours gagnants sur
// className) et portes par les classNames compagnes ci-dessous.
const sModalTitleCls = 'text-[18px] md:text-[18px] mb-[16px] md:mb-[22px]'
const sModalTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sLabelCls = 'text-[12px] md:text-[13px] mb-[4px] md:mb-[6px]'
const sLabel: React.CSSProperties = { fontWeight: 700, color: 'var(--text3)' }
const sInputCls = 'rounded-[10px] px-[12px] py-[9px] mb-[10px] text-[13px] md:px-[14px] md:py-[10px] md:mb-[14px] md:text-[12px]'
const sInput: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const sError: React.CSSProperties = { background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontWeight: 600, marginBottom: 8 }
const btnPrim: React.CSSProperties = { padding: '10px 14px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec2: React.CSSProperties = { padding: '10px 14px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '7px 11px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '7px 12px', borderRadius: 9, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
