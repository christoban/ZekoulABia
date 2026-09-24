'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Calendar, CalendarDays, Coffee, Loader2, Trash2, UtensilsCrossed } from 'lucide-react'
import SectionTimetableStaffActions from './SectionTimetableStaffActions'

const FREE_VALUE = '__FREE__'

async function lireReponseJson<T>(reponse: Response): Promise<T> {
  const texte = await reponse.text()
  if (!texte.trim()) throw new Error(`Réponse vide du serveur (HTTP ${reponse.status})`)
  try {
    return JSON.parse(texte) as T
  } catch {
    throw new Error(`Réponse invalide du serveur (HTTP ${reponse.status})`)
  }
}

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClassItem { id: string; name: string; academicYearId?: string }

interface TimetableSlot {
  id: string; dayOfWeek: number; startTime: string; endTime: string
  room: string | null; kind: string
  subject: { id: string; name: string } | null
  teacher: { id: string; firstName: string; lastName: string } | null
  isLV2Slot?: boolean
}

interface Timetable {
  id: string; classId: string; status: string
  class: { id: string; name: string }
  slots: TimetableSlot[]
}

interface PeriodeGrille {
  ordre: number; debut: string; fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'; duree: number
}

interface GridConfig {
  heureDebut: string; dureePeriode: number
  periodesAvantP1: number; dureePetitePause: number
  periodesAvantP2: number; dureeGrandePause: number; periodesApresP2: number; joursActifs: string[]
  periodesCoursParJour: Record<string, number>
}


interface Assignment {
  subjectId: string; subjectName: string; coefficient: number
  currentTeacherId: string | null; currentTeacherName: string | null
  eligibleTeachers: { id: string; name: string }[]
}

interface BulkProposal {
  seances: unknown[]
  seancesGroupes: unknown[]
}

interface BulkResult {
  classId: string
  className: string
  timetableId?: string
  status: 'success' | 'error' | 'applied'
  error?: string
  warnings: string[]
  proposal?: BulkProposal
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const DAY_NAME: Record<string, string> = {
  LUNDI: 'Lundi', MARDI: 'Mardi', MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi', VENDREDI: 'Vendredi', SAMEDI: 'Samedi',
}
const DAY_MAP: Record<string, number> = {
  LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5,
}

// Palette de couleurs par matière (hash stable)
const SUBJECT_PALETTES = [
  { bg: 'rgba(5,150,105,0.10)', border: 'var(--green)', text: 'var(--green2)' },
  { bg: 'rgba(37,99,235,0.09)', border: 'var(--blue)', text: 'var(--blue)' },
  { bg: 'rgba(217,119,6,0.09)', border: 'var(--amber)', text: 'var(--amber)' },
  { bg: 'rgba(139,92,246,0.09)', border: 'var(--purple)', text: 'var(--purple)' },
  { bg: 'rgba(236,72,153,0.09)', border: 'var(--red)', text: 'var(--red)' },
  { bg: 'rgba(142,42,58,0.09)', border: 'var(--primary)', text: 'var(--primary)' },
  { bg: 'rgba(239,68,68,0.09)', border: 'var(--red)', text: 'var(--red)' },
  { bg: 'rgba(251,146,60,0.09)', border: 'var(--orange)', text: 'var(--orange)' },
]
function subjectColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length]
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function SectionTimetable({ onToast }: Props) {
  const t = useT('staff')
  const [classes, setClasses]             = useState<ClassItem[]>([])
  const [classId, setClassId]             = useState('')
  const [timetable, setTimetable]         = useState<Timetable | null>(null)
  const [gridConfig, setGridConfig]       = useState<GridConfig | null>(null)
  const [squelette, setSquelette]         = useState<PeriodeGrille[]>([])
  const [squeletteParJour, setSqueletteParJour] = useState<Record<string, PeriodeGrille[]>>({})
  const [assignments, setAssignments]     = useState<Assignment[]>([])
  const [loading, setLoading]             = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [generating, setGenerating]       = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [clearingAll, setClearingAll]     = useState(false)
  const [bulkPropose, setBulkPropose]     = useState<{ current: number; total: number; className: string; errors: string[]; warnings: string[] } | null>(null)
  const [bulkResults, setBulkResults]     = useState<BulkResult[]>([])
  const [applyingAll, setApplyingAll]     = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  // Modal
  const [modalSlot, setModalSlot]         = useState<TimetableSlot | null>(null)
  const [modalSubjectId, setModalSubjectId] = useState('')
  const [modalTeacherId, setModalTeacherId] = useState('')
  const [modalTeacherName, setModalTeacherName] = useState('')
  const [saving, setSaving]               = useState(false)
  const [conflictMsg, setConflictMsg]     = useState<string | null>(null)
  const conflictTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Matières LV2 (isLV2=true) — pour proposer la case "Créneau LV2" au bon moment
  const [lv2SubjectIds, setLv2SubjectIds] = useState<Set<string>>(new Set())
  const [modalIsLV2Slot, setModalIsLV2Slot] = useState(false)

  // Charger classes et config grille au montage
  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ]).then(([classData, configData, subjectData]) => {
      const list = Array.isArray(classData?.data) ? classData.data : Array.isArray(classData) ? classData : []
      setClasses(list)
      if (configData?.data) {
         setGridConfig(configData.data.config)
         setSquelette(configData.data.squelette)
         setSqueletteParJour(configData.data.squeletteParJour ?? {})

      }
      if (Array.isArray(subjectData?.data)) {
        setLv2SubjectIds(new Set(subjectData.data.filter((s: any) => s.isLV2).map((s: any) => s.id)))
      }
    }).catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  // Charger EDT + affectations quand classId change
  const fetchTimetable = useCallback(async (cid?: string) => {
    const id = cid ?? classId
    if (!id) return
    try {
      setLoading(true); setError(null)
      const [tmRes, assRes] = await Promise.all([
        fetchApi(`/api/v2/timetables?classId=${id}`, { credentials: 'include' }),
        fetchApi(`/api/v2/teaching-assignments?classId=${id}`, { credentials: 'include' }),
      ])
      const tmData  = await tmRes.json()
      const assData = await assRes.json()
      if (!tmRes.ok) throw new Error(tmData.message || t('timetable.loading'))
      const list: Timetable[] = tmData.data || []
      setTimetable(list[0] ?? null)
      setAssignments(assData.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [classId])

  const handleClassChange = (newClassId: string) => {
    setClassId(newClassId)
    setTimetable(null)
    setError(null)
    if (newClassId) fetchTimetable(newClassId)
  }

  const handleGenerate = async () => {
    if (!classId) return
    setGenerating(true)
    try {
      const res = await fetchApi('/api/v2/timetables/generate-skeleton', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      })
      const data = await res.json()
      if (!res.ok) {
        // EDT déjà existant → charger
        if (res.status === 409 && data.data?.timetableId) { fetchTimetable(); return; }
        throw new Error(data.message || 'Erreur génération')
      }
      onToast(t('timetable.skeletonGenerated'), 'success')
      setTimetable(data.data)
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.generationError'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleProposeAll = async () => {
    if (classes.length === 0 || !window.confirm(t('timetable.bulkProposeConfirm'))) return
    const errors: string[] = []
    const warnings: string[] = []
    const results: BulkResult[] = []
    setBulkResults([])
    setBulkPropose({ current: 0, total: classes.length, className: '', errors, warnings })
    for (const [index, classe] of classes.entries()) {
      setBulkPropose({ current: index, total: classes.length, className: classe.name, errors: [...errors], warnings: [...warnings] })
      try {
        const listResponse = await fetchApi(`/api/v2/timetables?classId=${encodeURIComponent(classe.id)}`, { credentials: 'include' })
        const listData = await lireReponseJson<{ data?: Timetable[] }>(listResponse)
        let timetableId = listData.data?.[0]?.id
        if (!timetableId) {
          const skeletonResponse = await fetchApi('/api/v2/timetables/generate-skeleton', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId: classe.id }),
          })
          const skeletonData = await lireReponseJson<{ data?: { id?: string; timetableId?: string }; message?: string }>(skeletonResponse)
          if (!skeletonResponse.ok && skeletonResponse.status !== 409) throw new Error(skeletonData.message || t('timetable.generationError'))
          timetableId = skeletonData.data?.id ?? skeletonData.data?.timetableId
        }
        if (!timetableId) throw new Error(t('timetable.bulkNoTimetable'))
        const proposalResponse = await fetchApi(`/api/v2/timetables/${timetableId}/propose-schedule`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const proposalData = await lireReponseJson<{ message?: string; data?: BulkProposal & { avertissements?: string[]; problemes?: string[] } }>(proposalResponse)
        if (!proposalResponse.ok) throw new Error(proposalData.message || t('timetable.planning.proposeError'))
        const classWarnings = [
          ...(proposalData.data?.avertissements ?? []),
          ...(proposalData.data?.problemes ?? []),
        ].map(warning => `${classe.name} : ${warning}`)
        warnings.push(...classWarnings)
        results.push({ classId: classe.id, className: classe.name, timetableId, status: 'success', warnings: classWarnings, proposal: proposalData.data ? { seances: proposalData.data.seances ?? [], seancesGroupes: proposalData.data.seancesGroupes ?? [] } : undefined })
      } catch (error) {
        const message = error instanceof Error ? error.message : t('timetable.planning.proposeError')
        errors.push(`${classe.name} : ${message}`)
        results.push({ classId: classe.id, className: classe.name, status: 'error', error: message, warnings: [] })
      }
      setBulkResults([...results])
      setBulkPropose({ current: index + 1, total: classes.length, className: classe.name, errors: [...errors], warnings: [...warnings] })
    }
    setBulkPropose(null)
    onToast(errors.length > 0 ? t('timetable.bulkProposePartial', { count: errors.length }) : t('timetable.bulkProposeSuccess'), errors.length > 0 ? 'info' : 'success')
  }

  const handleApplyAll = async () => {
    const applicable = bulkResults.filter(result => result.status === 'success' && result.timetableId && result.proposal)
    if (applicable.length === 0 || !window.confirm(t('timetable.bulkApplyConfirm', { count: applicable.length }))) return
    setApplyingAll(true)
    const appliedResults: BulkResult[] = []
    for (const result of bulkResults) {
      if (result.status !== 'success' || !result.timetableId || !result.proposal) {
        appliedResults.push(result)
        continue
      }
      try {
        const response = await fetchApi(`/api/v2/timetables/${result.timetableId}/apply-schedule`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seances: result.proposal.seances, seancesGroupes: result.proposal.seancesGroupes }),
        })
        const data = await lireReponseJson<{ message?: string }>(response)
        if (!response.ok) throw new Error(data.message || t('timetable.planning.applyError'))
        appliedResults.push({ ...result, status: 'applied' })
      } catch (error) {
        appliedResults.push({ ...result, status: 'error', error: error instanceof Error ? error.message : t('timetable.planning.applyError') })
      }
      setBulkResults([...appliedResults])
    }
    setApplyingAll(false)
    onToast(t('timetable.bulkApplyDone'), 'success')
  }

  const clearBulkResults = () => {
    setBulkResults([])
    setBulkPropose(null)
  }

  const handleSubmit = async () => {
    if (!timetable || timetable.status !== 'DRAFT') return
    setSubmitting(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/submit`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.submitError'))
      onToast(t('timetable.submitSuccess'), 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.submitError'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearAll = async () => {
    if (!timetable || timetable.status !== 'DRAFT') return
    if (!window.confirm(t('timetable.clearAllConfirm', { className: timetable.class.name }))) return
    setClearingAll(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/slots`, {
        method: 'DELETE', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.clearAllError'))
      await fetchTimetable()
      onToast(t('timetable.allSlotsCleared'), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.clearAllError'), 'error')
    } finally {
      setClearingAll(false)
    }
  }

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
    setSaving(true); setConflictMsg(null)
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
          setSaving(false); return
        }
      }

       const isNewSlot = !modalSlot.id
       const res = await fetchApi(
         isNewSlot
           ? `/api/v2/timetables/${timetable.id}/slots`
           : `/api/v2/timetables/${timetable.id}/slots/${modalSlot.id}`,
         {
           method: isNewSlot ? 'POST' : 'PUT', credentials: 'include',
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
if (data.code === 'CONFLIT_HORAIRE') { setConflictMsg(data.message ?? 'Erreur'); return; }
         if (data.code === 'VOLUME_AP_DEPASSE') { setConflictMsg(data.message ?? 'Erreur'); return; }
         throw new Error(data.message || 'Erreur sauvegarde')
       }

       if (isNewSlot) {
         setModalSlot(null)
         await fetchTimetable()
         onToast(t('timetable.slotUpdated'), 'success')
         return
       }

       // Mettre à jour le slot dans l'état local
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
           method: 'POST', credentials: 'include',
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
         method: 'DELETE', credentials: 'include',
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

  // ─── Construction de la grille ─────────────────────────────────────────────
  const slots = timetable?.slots ?? []
  const slotMap = new Map<string, TimetableSlot>()
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.startTime}`, s)

  const joursActifs = gridConfig?.joursActifs ?? ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
  // filter sur undefined et non sur la véracité : `.filter(Boolean)` supprimerait le lundi (0).
  const joursNumeriques = joursActifs.map(j => DAY_MAP[j]).filter((d): d is number => d !== undefined)

  // Calcul du remplissage
   const totalCours = gridConfig
     ? (Object.keys(squeletteParJour).length > 0
         ? joursActifs.reduce((total, jour) => total + (squeletteParJour[jour] ?? squelette).filter(periode => periode.type === 'COURS').length, 0)
         : squelette.filter(periode => periode.type === 'COURS').length * joursNumeriques.length)
     : slots.filter(s => s.kind === 'CLASS').length
   const remplis    = slots.filter(s => s.kind === 'CLASS' && s.subject).length
   const pct        = totalCours > 0 ? Math.round(remplis / totalCours * 100) : 0

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', paddingBottom: 140 }}>
      <style>{`
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        .tt-cell-hover:hover { background: rgba(5,150,105,0.05) !important; cursor: pointer; }
        .tt-cell-filled:hover { opacity: 0.88; cursor: pointer; }
      `}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={sTitle}>{t('timetable.title')}</div>
          <div style={sSub}>
            {timetable
              ? t('timetable.subtitleFilled', { className: timetable.class.name, filled: remplis, total: totalCours, pct, status: timetable.status === 'PUBLISHED' ? t('timetable.statusPublished') : timetable.status === 'SUBMITTED' ? t('timetable.statusSubmitted') : t('timetable.statusDraft') })
              : gridConfig ? t('timetable.selectClass') : t('timetable.gridNotConfigured')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={classId} onChange={e => handleClassChange(e.target.value)} style={selectSt} disabled={loadingClasses}>
            <option value="">{loadingClasses ? t('timetable.loading') : t('timetable.selectClassOption')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
           {timetable && timetable.status === 'DRAFT' && (
             <>
               <button style={btnSec} onClick={handleClearAll} disabled={clearingAll || submitting}>
                 <Trash2 size={14} /> {clearingAll ? t('timetable.clearingAll') : t('timetable.clearAll')}
               </button>
               <button style={btnPrim} onClick={handleSubmit} disabled={submitting || clearingAll}>
                 {submitting ? <><Spinner /> {t('timetable.submitting')}</> : t('timetable.submitForValidation')}
               </button>
             </>
           )}

         {!classId && (
             <button style={btnSec} onClick={handleProposeAll} disabled={loadingClasses || classes.length === 0 || bulkPropose !== null}>
               {bulkPropose ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />} {bulkPropose ? t('timetable.bulkProposeRunning', { current: bulkPropose.current, total: bulkPropose.total }) : t('timetable.bulkProposeButton')}
             </button>
         )}
         </div>
       </div>

       {bulkPropose && (
         <div style={{ background: 'var(--blue-light)', border: '1px solid var(--blue-light)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--text2)' }}>
           <div style={{ fontWeight: 700 }}>{t('timetable.bulkProposeProgress', { current: bulkPropose.current, total: bulkPropose.total, className: bulkPropose.className })}</div>
           {bulkPropose.errors.length > 0 && <div style={{ marginTop: 4, color: 'var(--red)' }}>{bulkPropose.errors.join(' · ')}</div>}
           {bulkPropose.warnings.length > 0 && <div style={{ marginTop: 4, color: 'var(--amber)' }}>{bulkPropose.warnings.join(' · ')}</div>}
         </div>
       )}

        {bulkResults.length > 0 && !bulkPropose && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <strong style={{ fontSize: 13, color: 'var(--text)' }}>{t('timetable.bulkResultsTitle')}</strong>
              <button type="button" style={btnSec} onClick={clearBulkResults}><Trash2 size={13} /> {t('timetable.bulkClear')}</button>
            </div>
            {bulkResults.map(result => (
              <div key={result.classId} style={{ padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: 12, color: result.status === 'error' ? 'var(--red)' : result.status === 'applied' ? 'var(--green)' : 'var(--text2)' }}>
                <strong>{result.className}</strong> — {result.status === 'error' ? result.error : result.status === 'applied' ? t('timetable.bulkApplied') : t('timetable.bulkProposed')}
                {result.warnings.map(warning => <div key={warning} style={{ marginTop: 3, color: 'var(--amber)' }}>{warning}</div>)}
              </div>
            ))}
            {bulkResults.every(result => result.status === 'success') && (
              <button type="button" style={{ ...btnPrim, marginTop: 10 }} onClick={handleApplyAll} disabled={applyingAll}>
                {applyingAll ? <Loader2 size={14} className="animate-spin" /> : null} {applyingAll ? t('timetable.bulkApplying') : t('timetable.bulkApplyAll')}
              </button>
            )}
          </div>
        )}

        {classId && !loadingClasses && (
        <SectionTimetableStaffActions
          classId={classId}
          academicYearId={classes.find(c => c.id === classId)?.academicYearId}
          timetable={timetable}
          assignments={assignments}
          gridConfigured={!!gridConfig}
          onRefresh={() => fetchTimetable()}
          onToast={onToast}
        />
      )}

      {/* Grille non configurée */}
      {!gridConfig && !loadingClasses && (
        <div style={{ background: 'var(--orange-light)', border: '1px solid var(--orange-light)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12.5, color: 'var(--amber)' }} dangerouslySetInnerHTML={{ __html: t('timetable.gridNotConfiguredDesc') }}>
        </div>
      )}

      {/* Chargement */}
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><div style={spinnerStyle} /></div>}

      {/* Erreur */}
      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={15} strokeWidth={2} /></span>
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{error}</span>
          <button onClick={() => fetchTimetable()} style={btnSec}>{t('timetable.retry')}</button>
        </div>
      )}

      {/* Aucune classe */}
      {!loading && !error && !classId && (
        <EmptyState icon={<CalendarDays size={38} strokeWidth={1.8} />} title={t('timetable.emptyStateTitle')} sub={t('timetable.emptyStateSub')} />
      )}

      {/* Classe sélectionnée, pas d'EDT */}
      {!loading && !error && classId && !timetable && gridConfig && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 38, marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><Calendar size={38} strokeWidth={1.8} /></div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('timetable.noTimetableTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }} dangerouslySetInnerHTML={{ __html: t('timetable.noTimetableDesc') }}>
          </div>
          <button style={{ ...btnPrim, fontSize: 13.5, padding: '8px 18px' }} onClick={handleGenerate} disabled={generating}>
            {generating ? <><Spinner /> {t('timetable.generating')}</> : t('timetable.generateSkeleton')}
          </button>
        </div>
      )}

      {/* Grille EDT */}
      {!loading && !error && timetable && squelette.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Barre de progression */}
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
              {t('timetable.slotsFilled', { filled: remplis, total: totalCours })}
            </span>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--amber)', transition: 'width 0.3s', borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: pct === 100 ? 'var(--green)' : 'var(--amber)' }}>{pct}%</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ ...thSt, width: 85 }}>{t('timetable.scheduleHeader')}</th>
                  {joursActifs.map(j => <th key={j} style={thSt}>{DAY_NAME[j] ?? j}</th>)}
                </tr>
              </thead>
              <tbody>
                {squelette.map((periode, idx) => {
                   if (periode.type !== 'COURS') {
                     const isPetite = periode.type === 'PETITE_PAUSE'
                     return (
                       <tr key={`pause-${idx}`}>
                         <td style={{ padding: '3px 8px', background: 'var(--bg)', fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                           {periode.debut}<br /><span style={{ fontSize: 10, fontWeight: 600 }}>{periode.fin}</span>
                         </td>
                         {joursActifs.map(jour => {
                           const pauseActive = (squeletteParJour[jour] ?? squelette).some(periodeJour => periodeJour.type === periode.type && periodeJour.debut === periode.debut && periodeJour.fin === periode.fin)
                           return (
                             <td key={jour} style={{ padding: '3px 10px', background: pauseActive ? 'var(--amber-light)' : 'var(--bg)', border: '1px solid var(--border)', textAlign: 'center', fontSize: 11, fontWeight: 700, color: pauseActive ? 'var(--amber)' : 'var(--text3)' }}>
                               {pauseActive && <>{isPetite ? <Coffee size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> : <UtensilsCrossed size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />}{isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')}</>}
                             </td>
                           )
                         })}
                       </tr>
                     )
                   }


                  return (
                    <tr key={`cours-${periode.debut}`}>
                      <td style={{ padding: '6px 8px', background: 'var(--bg)', fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {periode.debut}<br /><span style={{ fontSize: 10, fontWeight: 600 }}>{periode.fin}</span>
                      </td>
                      {joursActifs.map(jour => {
                         const dayNum = DAY_MAP[jour]
                         const slot = slotMap.get(`${dayNum}-${periode.debut}`)
                         const courseActive = (squeletteParJour[jour] ?? squelette).some(periodeJour => periodeJour.type === 'COURS' && periodeJour.debut === periode.debut && periodeJour.fin === periode.fin)
                         const filled = slot?.kind === 'FREE' || !!slot?.subject
                         const col = slot?.subject ? subjectColor(slot.subject.id) : null


                        return (
                           <td key={jour}
                             style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 105, height: 58, opacity: courseActive ? 1 : 0.4 }}
                             onClick={courseActive ? () => slot ? openModal(slot) : openEmptyModal({ id: '', dayOfWeek: dayNum, startTime: periode.debut, endTime: periode.fin, room: null, kind: 'CLASS', subject: null, teacher: null, isLV2Slot: false }) : undefined}>
                             {!courseActive ? (
                               <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>—</div>
                             ) : slot ? (

                              filled ? (
                                 <div className="tt-cell-filled"
                                   style={{ padding: '5px 8px', height: '100%', background: slot.kind === 'FREE' ? 'var(--blue-light)' : col?.bg ?? 'var(--bg)', borderLeft: `3px solid ${slot.kind === 'FREE' ? 'var(--blue)' : col?.border ?? 'var(--border)'}`, boxSizing: 'border-box' }}>
                                   {slot.kind === 'FREE' ? (
                                     <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', lineHeight: 1.2 }}>{t('timetable.freeTime')}</div>
                                   ) : (
                                     <>
                                       <div style={{ fontSize: 12, fontWeight: 800, color: col!.text, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                         <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.subject!.name}</span>
                                         {slot.isLV2Slot && (
                                           <span title={t('timetable.lv2Tooltip')} style={{ background: 'rgba(3,105,161,0.14)', color: 'var(--blue)', fontSize: 9, fontWeight: 900, padding: '1px 4px', borderRadius: 4, letterSpacing: '0.2px', flexShrink: 0 }}>{t('timetable.lv2Badge')}</span>
                                         )}
                                       </div>
                                       <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                         {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}
                                       </div>
                                       {slot.room && <div style={{ fontSize: 9.5, color: 'var(--text3)', marginTop: 2 }}>{t('timetable.roomLabel')} {slot.room}</div>}
                                     </>
                                   )}
                                 </div>
                              ) : (
                                <div className="tt-cell-hover"
                                  style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                                  <span style={{ fontSize: 16, color: 'var(--border2)' }}>+</span>
                                </div>
                              )
                             ) : (
                               <div className="tt-cell-hover"
                                 style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                                 <span style={{ fontSize: 16, color: 'var(--border2)' }}>+</span>
                               </div>
                             )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal saisie créneau */}
      {modalSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModalSlot(null) }}>
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
              <select value={modalSubjectId} onChange={e => handleSubjectSelect(e.target.value)} style={inputSt}>
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
                  <input type="checkbox" checked={modalIsLV2Slot} onChange={e => setModalIsLV2Slot(e.target.checked)}
                    style={{ width: 15, height: 15, marginTop: 1, cursor: 'pointer', accentColor: 'var(--blue)', flexShrink: 0 }} />
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
                <button style={{ ...btnSec, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)' }} onClick={handleClearSlot} disabled={saving}>
                  {t('timetable.clear')}
                </button>
              )}
              <button style={btnSec} onClick={() => setModalSlot(null)} disabled={saving}>{t('timetable.cancel')}</button>
              <button style={btnPrim} onClick={handleSaveSlot} disabled={saving || !modalSubjectId}>
                {saving ? <><Spinner /> {t('timetable.savingSlot')}</> : t('timetable.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Petits composants ────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 38, marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{sub}</div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle', marginRight: 5 }} />
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sTitle:   React.CSSProperties = { fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
const sSub:     React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const btnPrim:  React.CSSProperties = { padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }
const btnSec:   React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt:     React.CSSProperties = { padding: '7px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.4px' }
const labelSt:  React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }
const inputSt:  React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'var(--surface)' }
const spinnerStyle: React.CSSProperties = { width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }
