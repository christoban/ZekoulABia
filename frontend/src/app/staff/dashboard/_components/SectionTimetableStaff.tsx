'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Calendar, CalendarDays, Coffee, UtensilsCrossed } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClassItem { id: string; name: string }

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
  periodesAvantP2: number; dureeGrandePause: number
  periodesApresP2: number; joursActifs: string[]
}

interface Assignment {
  subjectId: string; subjectName: string; coefficient: number
  currentTeacherId: string | null; currentTeacherName: string | null
  eligibleTeachers: { id: string; name: string }[]
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
  { bg: 'rgba(139,92,246,0.09)', border: 'var(--purple)', text: '#6d28d9' },
  { bg: 'rgba(236,72,153,0.09)', border: '#db2777', text: '#be185d' },
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
  const [assignments, setAssignments]     = useState<Assignment[]>([])
  const [loading, setLoading]             = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [generating, setGenerating]       = useState(false)
  const [publishing, setPublishing]       = useState(false)
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

  const handlePublish = async () => {
    if (!timetable) return
    setPublishing(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/publish`, {
        method: 'PUT', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur publication')
      onToast(t('timetable.publishSuccess'), 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.publishError'), 'error')
    } finally {
      setPublishing(false)
    }
  }

  // ─── Modal ─────────────────────────────────────────────────────────────────
  const openModal = (slot: TimetableSlot) => {
    setModalSlot(slot)
    setModalSubjectId(slot.subject?.id ?? '')
    setModalTeacherId(slot.teacher?.id ?? '')
    setModalTeacherName(slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '')
    setModalIsLV2Slot(slot.isLV2Slot ?? false) // reflète la valeur actuelle à l'édition
    setConflictMsg(null)
  }

  const handleSubjectSelect = (subjectId: string) => {
    setModalSubjectId(subjectId)
    setConflictMsg(null)
    // Matière de langue LV2 → case proposée cochée par défaut ; sinon pas de case
    setModalIsLV2Slot(lv2SubjectIds.has(subjectId))
    if (!subjectId) { setModalTeacherId(''); setModalTeacherName(''); return; }
    const aff = assignments.find(a => a.subjectId === subjectId)
    setModalTeacherId(aff?.currentTeacherId ?? '')
    setModalTeacherName(aff?.currentTeacherName ?? (aff?.currentTeacherId ? t('timetable.assignedTeacher') : t('timetable.unassigned')))
  }

  const handleSaveSlot = async () => {
    if (!modalSlot) return
    setSaving(true); setConflictMsg(null)
    try {
      // Vérification conflit avant envoi
      if (modalTeacherId) {
        const chkRes = await fetchApi(
          `/api/v2/timetables/check-conflict?teacherId=${modalTeacherId}&dayOfWeek=${modalSlot.dayOfWeek}&startTime=${encodeURIComponent(modalSlot.startTime)}&excludeSlotId=${modalSlot.id}`,
          { credentials: 'include' }
        )
        const chkData = await chkRes.json()
        if (chkData.data?.hasConflict) {
          setConflictMsg(t('timetable.conflictPrefix', { conflictClass: chkData.data.conflictClass }))
          setSaving(false); return
        }
      }

      const res = await fetchApi(`/api/v2/timetables/slots/${modalSlot.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: modalSubjectId || null,
          teacherId: modalTeacherId || null,
          isLV2Slot: lv2SubjectIds.has(modalSubjectId) ? modalIsLV2Slot : false,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'CONFLIT_HORAIRE') { setConflictMsg(data.message); return; }
        if (data.code === 'VOLUME_AP_DEPASSE') { setConflictMsg(data.message); return; }
        throw new Error(data.message || 'Erreur sauvegarde')
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
      const res = await fetchApi(`/api/v2/timetables/slots/${modalSlot.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: null, teacherId: null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setTimetable(prev => prev ? {
        ...prev,
        slots: prev.slots.map(s => s.id === modalSlot.id ? { ...s, subject: null, teacher: null } : s),
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
  const totalCours = slots.filter(s => s.kind === 'CLASS').length
  const remplis    = slots.filter(s => s.kind === 'CLASS' && s.subject).length
  const pct        = totalCours > 0 ? Math.round(remplis / totalCours * 100) : 0

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ height: '100%', overflowY: 'auto' }}>
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
              ? t('timetable.subtitleFilled', { className: timetable.class.name, filled: remplis, total: totalCours, pct, status: timetable.status === 'PUBLISHED' ? t('timetable.statusPublished') : t('timetable.statusDraft') })
              : gridConfig ? t('timetable.selectClass') : t('timetable.gridNotConfigured')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={classId} onChange={e => handleClassChange(e.target.value)} style={selectSt} disabled={loadingClasses}>
            <option value="">{loadingClasses ? t('timetable.loading') : t('timetable.selectClassOption')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {timetable && timetable.status !== 'PUBLISHED' && (
            <button style={btnPrim} onClick={handlePublish} disabled={publishing}>
              {publishing ? <><Spinner /> {t('timetable.publishing')}</> : t('timetable.validateAndPublish')}
            </button>
          )}
        </div>
      </div>

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
                    // Ligne pause
                    const isPetite = periode.type === 'PETITE_PAUSE'
                    return (
                      <tr key={`pause-${idx}`}>
                        <td colSpan={joursActifs.length + 1}
                          style={{ textAlign: 'center', padding: '3px 10px', background: 'var(--amber-light)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--amber)', letterSpacing: '0.4px' }}>
                          {isPetite ? <Coffee size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> : <UtensilsCrossed size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />}{isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')} — {periode.debut} à {periode.fin} ({periode.duree} min)
                        </td>
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
                        const filled = !!(slot?.subject)
                        const col = slot?.subject ? subjectColor(slot.subject.id) : null

                        return (
                          <td key={jour}
                            style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 105, height: 58 }}
                            onClick={() => slot && openModal(slot)}>
                            {slot ? (
                              filled ? (
                                <div className="tt-cell-filled"
                                  style={{ padding: '5px 8px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                  <div style={{ fontSize: 12, fontWeight: 800, color: col!.text, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.subject!.name}</span>
                                    {slot.isLV2Slot && (
                                      <span title={t('timetable.lv2Tooltip')} style={{ background: 'rgba(3,105,161,0.14)', color: 'var(--blue)', fontSize: 9, fontWeight: 900, padding: '1px 4px', borderRadius: 4, letterSpacing: '0.2px', flexShrink: 0 }}>{t('timetable.lv2Badge')}</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}
                                  </div>
                                </div>
                              ) : (
                                <div className="tt-cell-hover"
                                  style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                                  <span style={{ fontSize: 16, color: 'var(--border2)' }}>+</span>
                                </div>
                              )
                            ) : (
                              <div style={{ height: '100%', background: 'var(--bg)' }} />
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
