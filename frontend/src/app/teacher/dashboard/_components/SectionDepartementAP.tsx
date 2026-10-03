'use client'
import { useState, useCallback, useEffect } from 'react'
import {
  Inbox, AlertTriangle, CheckCircle2, BarChart3, Clock, TrendingUp,
  Circle, Target, Package, BookOpen, Plus, Trash2, ChevronDown, ChevronRight,
  Edit3, X, Check, Loader2
} from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'

interface Props {
  user: UserInfo
  departementId: string
  departementNom: string
  departmentsList?: { id: string; name: string; color: string; subjects?: { id: string; name: string }[] }[]
  onSelectDept?: (id: string) => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface PerfRow {
  teacherName: string
  subjectName: string
  className: string
  moyenne: number | null
  nbEleves: number
}

interface HoraireRow {
  teacherName: string
  subjectName: string
  totalHours: number
  isOverLimit: boolean
}

interface Chapitre {
  id: string
  titre: string
  ordre: number
  volumeHeuresPrevu: number
  sequenceCibleFin?: number | null
  realise?: boolean
}

interface Programme {
  id: string
  titre: string
  subject: { id: string; name: string }
  class: { id: string; name: string } | null
  level: string | null
  chapitres: Chapitre[]
}

type Tab = 'performances' | 'horaires' | 'progression' | 'programmes'

interface ProgAlerte {
  programmeTitre: string; subjectName: string; className: string
  chapitresTotal: number; chapitresRealises: number; progressionPct: number
  attenduPct: number; retardPct: number; niveau: 'CRITIQUE' | 'MODERE'
}

export default function SectionDepartementAP({ user, departementId, departementNom, departmentsList, onSelectDept, onToast }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const [tab, setTab] = useState<Tab>('performances')

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    if (onToast) onToast(msg, type)
  }, [onToast])

  // ─── Onglet Performances ──────────────────────────────────────────────────
  const fetchPerfFn = useCallback(async (): Promise<PerfRow[]> => {
    const res = await fetchApi(`/api/v2/departments/${departementId}/performance`, { credentials: 'include' })
    const d = await res.json()
    return Array.isArray(d.data) ? d.data : []
  }, [departementId])
  const { data: perfData, loading: perfLoading, error: perfError, fromCache: perfFromCache, cachedAt: perfCachedAt } =
    useCachedFetch<PerfRow[]>(tab === 'performances' ? `teacher:dept-perf:${departementId}` : '', fetchPerfFn)
  const perf = perfData ?? []

  // ─── Onglet Horaires ──────────────────────────────────────────────────────
  const fetchHorairesFn = useCallback(async (): Promise<HoraireRow[]> => {
    const res = await fetchApi(`/api/v2/timetables?departmentId=${departementId}`, { credentials: 'include' })
    const d = await res.json()
    if (!d.success) return []
    const map = new Map<string, { teacherName: string; subjectName: string; totalHours: number }>()
    for (const timetable of d.data ?? []) {
      for (const slot of timetable.slots ?? []) {
        const key = `${slot.teacher?.id}__${slot.subject?.id}`
        const dur = slot.durationMinutes ?? 60
        const existing = map.get(key)
        if (existing) {
          existing.totalHours += dur / 60
        } else {
          map.set(key, {
            teacherName: slot.teacher ? `${slot.teacher.user?.firstName ?? ''} ${slot.teacher.user?.lastName ?? ''}`.trim() : '—',
            subjectName: slot.subject?.name ?? '—',
            totalHours: dur / 60,
          })
        }
      }
    }
    return [...map.values()].map(r => ({ ...r, isOverLimit: r.totalHours > 14 })).sort((a, b) => b.totalHours - a.totalHours)
  }, [departementId])
  const { data: horairesData, loading: horairesLoading, fromCache: horFromCache, cachedAt: horCachedAt } =
    useCachedFetch<HoraireRow[]>(tab === 'horaires' ? `teacher:dept-hours:${departementId}` : '', fetchHorairesFn)
  const horaires = horairesData ?? []

  // ─── Onglet Progression ───────────────────────────────────────────────────
  const currentDept = departmentsList?.find(dept => dept.id === departementId) || user?.headedDepartments?.find(dept => dept.id === departementId)
  const deptSubjects = currentDept?.subjects ?? []
  const allowedSubjectNames = new Set(deptSubjects.map(s => s.name.toLowerCase().trim()))
  const allowedSubjectIds = new Set(deptSubjects.map(s => s.id))

  const fetchAlertesFn = useCallback(async (): Promise<ProgAlerte[]> => {
    const res = await fetchApi(`/api/v2/pedagogie/alertes-retard`, { credentials: 'include' })
    const d = await res.json()
    if (!d.success) throw new Error(t('department.error_progression'))
    const allAlertes: ProgAlerte[] = d.data ?? []

    if (allowedSubjectNames.size > 0) {
      return allAlertes.filter(a => allowedSubjectNames.has((a.subjectName || '').toLowerCase().trim()))
    }
    return allAlertes
  }, [t, allowedSubjectNames])
  const { data: alertesData, loading: alertesLoading, fromCache: alFromCache, cachedAt: alCachedAt } =
    useCachedFetch<ProgAlerte[]>(tab === 'progression' ? `teacher:dept-progression:${departementId}` : '', fetchAlertesFn)
  const alertes = alertesData ?? []

  // ─── Onglet Programmes & Chapitres ────────────────────────────────────────
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [progLoading, setProgLoading] = useState(false)
  const [expandedProg, setExpandedProg] = useState<string | null>(null)
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([])
  const [showNewProgForm, setShowNewProgForm] = useState(false)

  // Formulaire nouveau programme
  const [formTitre, setFormTitre] = useState('')
  const [formSubjectId, setFormSubjectId] = useState(deptSubjects[0]?.id || '')
  const [formClassId, setFormClassId] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [savingProg, setSavingProg] = useState(false)

  // Formulaire ajout chapitre
  const [addingChapFor, setAddingChapFor] = useState<string | null>(null)
  const [chapTitre, setChapTitre] = useState('')
  const [chapHeures, setChapHeures] = useState(2)
  const [chapSeq, setChapSeq] = useState('')
  const [savingChap, setSavingChap] = useState(false)

  // Édition chapitre
  const [editingChap, setEditingChap] = useState<{ id: string; titre: string; volumeHeuresPrevu: number; sequenceCibleFin?: number | null } | null>(null)
  const [savingEditChap, setSavingEditChap] = useState(false)

  const loadProgrammes = useCallback(async () => {
    setProgLoading(true)
    try {
      const res = await fetchApi('/api/v2/pedagogie/programmes', { credentials: 'include' }).then(r => r.json())
      if (res.success && Array.isArray(res.data)) {
        const all: Programme[] = res.data
        // Filtrage strict : matières du département géré par cet animateur
        const filtered = all.filter(p => allowedSubjectIds.has(p.subject?.id) || allowedSubjectNames.has((p.subject?.name || '').toLowerCase().trim()))
        setProgrammes(filtered)
      }
    } catch {
      showToast('Erreur lors du chargement des programmes', 'error')
    } finally {
      setProgLoading(false)
    }
  }, [allowedSubjectIds, allowedSubjectNames, showToast])

  useEffect(() => {
    if (tab === 'programmes') {
      loadProgrammes()
      fetchApi('/api/v2/classes', { credentials: 'include' })
        .then(r => r.json())
        .then(d => { if (d.success && Array.isArray(d.data)) setClassesList(d.data) })
        .catch(() => {})
    }
  }, [tab, loadProgrammes])

  useEffect(() => {
    if (deptSubjects.length > 0 && !formSubjectId) {
      setFormSubjectId(deptSubjects[0].id)
    }
  }, [deptSubjects, formSubjectId])

  const handleCreateProgramme = async () => {
    if (!formTitre.trim() || !formSubjectId) {
      showToast('Titre et matière requis', 'warning')
      return
    }
    setSavingProg(true)
    try {
      const payload = {
        titre: formTitre.trim(),
        subjectId: formSubjectId,
        classId: formClassId || undefined,
        level: formLevel || undefined,
      }
      const res = await fetchApi('/api/v2/pedagogie/programmes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        showToast('Programme créé avec succès', 'success')
        setFormTitre('')
        setFormLevel('')
        setFormClassId('')
        setShowNewProgForm(false)
        await loadProgrammes()
        if (res.data?.id) setExpandedProg(res.data.id)
      } else {
        showToast(res.message || 'Erreur lors de la création', 'error')
      }
    } catch {
      showToast('Erreur réseau lors de la création du programme', 'error')
    } finally {
      setSavingProg(false)
    }
  }

  const handleDeleteProgramme = async (id: string, titre: string) => {
    if (!confirm(`Supprimer le programme « ${titre} » et tous ses chapitres ?`)) return
    try {
      const res = await fetchApi(`/api/v2/pedagogie/programmes/${id}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json())
      if (res.success) {
        showToast('Programme supprimé', 'success')
        await loadProgrammes()
      } else {
        showToast(res.message || 'Erreur lors de la suppression', 'error')
      }
    } catch {
      showToast('Erreur réseau', 'error')
    }
  }

  const handleAddChapitre = async (programmeId: string) => {
    if (!chapTitre.trim()) {
      showToast('Titre du chapitre requis', 'warning')
      return
    }
    setSavingChap(true)
    try {
      const payload = {
        titre: chapTitre.trim(),
        volumeHeuresPrevu: chapHeures,
        sequenceCibleFin: chapSeq ? parseInt(chapSeq, 10) : undefined,
      }
      const res = await fetchApi(`/api/v2/pedagogie/programmes/${programmeId}/chapitres`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        showToast('Chapitre ajouté', 'success')
        setChapTitre('')
        setChapHeures(2)
        setChapSeq('')
        setAddingChapFor(null)
        await loadProgrammes()
      } else {
        showToast(res.message || 'Erreur lors de l\'ajout', 'error')
      }
    } catch {
      showToast('Erreur réseau', 'error')
    } finally {
      setSavingChap(false)
    }
  }

  const handleUpdateChapitre = async () => {
    if (!editingChap || !editingChap.titre.trim()) return
    setSavingEditChap(true)
    try {
      const payload = {
        titre: editingChap.titre.trim(),
        volumeHeuresPrevu: editingChap.volumeHeuresPrevu,
        sequenceCibleFin: editingChap.sequenceCibleFin ?? null,
      }
      const res = await fetchApi(`/api/v2/pedagogie/chapitres/${editingChap.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        showToast('Chapitre mis à jour', 'success')
        setEditingChap(null)
        await loadProgrammes()
      } else {
        showToast(res.message || 'Erreur lors de la mise à jour', 'error')
      }
    } catch {
      showToast('Erreur réseau', 'error')
    } finally {
      setSavingEditChap(false)
    }
  }

  const handleDeleteChapitre = async (chapitreId: string, titre: string) => {
    if (!confirm(`Supprimer le chapitre « ${titre} » ?`)) return
    try {
      const res = await fetchApi(`/api/v2/pedagogie/chapitres/${chapitreId}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json())
      if (res.success) {
        showToast('Chapitre supprimé', 'success')
        await loadProgrammes()
      } else {
        showToast(res.message || 'Erreur lors de la suppression', 'error')
      }
    } catch {
      showToast('Erreur réseau', 'error')
    }
  }

  const loading = tab === 'performances' ? perfLoading : tab === 'horaires' ? horairesLoading : tab === 'progression' ? alertesLoading : progLoading
  const error = tab === 'performances' && perfError && perfError !== 'OFFLINE_NO_CACHE' ? t('department.error_performance') : null
  const fromCache = tab === 'performances' ? perfFromCache : tab === 'horaires' ? horFromCache : tab === 'progression' ? alFromCache : false
  const cachedAt = tab === 'performances' ? perfCachedAt : tab === 'horaires' ? horCachedAt : tab === 'progression' ? alCachedAt : null

  const tabBtn = (tabId: Tab, label: string, Icon: typeof BarChart3) => (
    <button onClick={() => setTab(tabId)}
      style={{ minHeight: 38, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === tabId ? 'var(--sidebar)' : 'var(--bg2)', color: tab === tabId ? 'white' : 'var(--text2)', transition: 'all 0.15s',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
      <Icon size={14} strokeWidth={2} />{label}
    </button>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: 'var(--text)',
    background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3, display: 'block',
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      {/* Sélecteur multi-départements AP si l'animateur en dirige plusieurs */}
      {departmentsList && departmentsList.length > 1 && (
        <div className="flex items-center gap-2 p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
          <span className="text-xs font-bold text-[var(--text3)] px-2 whitespace-nowrap">Mes départements :</span>
          {departmentsList.map(d => (
            <button
              key={d.id}
              onClick={() => onSelectDept?.(d.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-extrabold cursor-pointer border transition-all ${
                d.id === departementId
                  ? 'text-white border-transparent'
                  : 'bg-[var(--bg)] text-[var(--text2)] border-[var(--border)] hover:text-[var(--text)]'
              }`}
              style={d.id === departementId ? { background: d.color || 'var(--sidebar)' } : {}}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} strokeWidth={2} />{t('department.title').replace('{name}', departementNom)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
          {t('department.subtitle')} · Matières : {deptSubjects.map(s => s.name).join(', ') || 'Aucune matière assignée'}
        </div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Package size={13} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabBtn('performances', t('department.tab_performances') || 'Performances', BarChart3)}
        {tabBtn('horaires', t('department.tab_horaires') || 'Volume horaire', Clock)}
        {tabBtn('progression', t('department.tab_progression') || 'Progression', TrendingUp)}
        {tabBtn('programmes', 'Programmes & Chapitres', BookOpen)}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--red-light)', borderRadius: 8, color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}>{error}</div>
      )}

      {/* ─── Onglet Performances ─── */}
      {tab === 'performances' && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('department.performance_title')}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{t('department.performance_count').replace('{count}', String(perf.length))}</span>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{tcommon('status.loading')}</div>
          ) : perf.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Inbox size={26} strokeWidth={2} /></div>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('department.performance_empty')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--border2)', marginTop: 4 }}>{t('department.performance_empty_hint')}</div>
            </div>
          ) : (
            <>
              {/* Vue mobile par cartes */}
              <div className="md:hidden divide-y divide-[var(--border)]">
                {perf.map((row, i) => {
                  const moy = row.moyenne
                  const moyBg = moy === null ? 'var(--bg2)' : moy >= 12 ? 'var(--green-light)' : moy >= 8 ? 'var(--amber-light)' : 'var(--red-light)'
                  const moyColor = moy === null ? 'var(--text3)' : moy >= 12 ? 'var(--green)' : moy >= 8 ? 'var(--amber)' : 'var(--red)'
                  return (
                    <div key={i} className="p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[var(--text)]">{row.teacherName}</span>
                        <span style={{ background: moyBg, color: moyColor, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                          {moy !== null ? `${moy.toFixed(2)}/20` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[var(--text2)]">
                        <span>{row.subjectName} · <strong>{row.className}</strong></span>
                        <span className="text-[var(--text3)]">{row.nbEleves} élèves</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Table desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {[t('department.perf_table_teacher'), t('department.perf_table_subject'), t('department.perf_table_class'), t('department.perf_table_average'), t('department.perf_table_students')].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((row, i) => {
                      const moy = row.moyenne
                      const moyBg = moy === null ? 'var(--bg2)' : moy >= 12 ? 'var(--green-light)' : moy >= 8 ? 'var(--amber-light)' : 'var(--red-light)'
                      const moyColor = moy === null ? 'var(--text3)' : moy >= 12 ? 'var(--green)' : moy >= 8 ? 'var(--amber)' : 'var(--red)'
                      return (
                        <tr key={i} style={{ borderTop: '1px solid var(--bg)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{row.teacherName}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.subjectName}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.className}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ background: moyBg, color: moyColor, padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800 }}>
                              {moy !== null ? moy.toFixed(2) : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.nbEleves}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Onglet Volume horaire ─── */}
      {tab === 'horaires' && (
        <div className="space-y-3">
          <div style={{ padding: '8px 12px', background: 'var(--amber-light)', border: '1px solid var(--amber-light)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ display: 'flex', flexShrink: 0 }}><AlertTriangle size={15} strokeWidth={2} /></span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{t('department.hours_legal_warn')} — <span style={{ fontWeight: 500 }}>{t('department.hours_legal_hint')}</span></div>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('department.hours_title')}</span>
            </div>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{tcommon('status.loading')}</div>
            ) : horaires.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Inbox size={26} strokeWidth={2} /></div>
                <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('department.hours_empty')}</div>
              </div>
            ) : (
              <>
                <div className="md:hidden divide-y divide-[var(--border)]">
                  {horaires.map((row, i) => (
                    <div key={i} className="p-3.5 space-y-2" style={{ background: row.isOverLimit ? 'var(--red-light)' : undefined }}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold" style={{ color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>{row.teacherName}</div>
                          <div className="text-xs text-[var(--text2)]">{row.subjectName}</div>
                        </div>
                        {row.isOverLimit
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><Circle size={6} fill="var(--red)" stroke="none" />{t('department.hours_over')}</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--green-light)', color: 'var(--green)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><CheckCircle2 size={11} strokeWidth={2} />{t('department.hours_ok')}</span>
                        }
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black" style={{ color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>{row.totalHours.toFixed(1)}h</span>
                        <div className="flex-1 bg-[var(--bg2)] rounded-full h-1.5 overflow-hidden">
                          <div style={{ height: '100%', width: `${Math.min((row.totalHours / 20) * 100, 100)}%`, background: row.isOverLimit ? 'var(--red)' : 'var(--green)' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)' }}>
                        {[t('department.hours_table_teacher'), t('department.hours_table_subject'), t('department.hours_table_hours'), t('department.hours_table_status')].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {horaires.map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--bg)', background: row.isOverLimit ? 'var(--red-light)' : i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>{row.teacherName}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.subjectName}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>
                                {row.totalHours.toFixed(1)}h
                              </span>
                              <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 3, height: 4, maxWidth: 80, overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min((row.totalHours / 20) * 100, 100)}%`, background: row.isOverLimit ? 'var(--red)' : 'var(--green)' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {row.isOverLimit
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><Circle size={6} fill="var(--red)" stroke="none" />{t('department.hours_over')}</span>
                              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--green-light)', color: 'var(--green)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><CheckCircle2 size={11} strokeWidth={2} />{t('department.hours_ok')}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Onglet Progression programmes ─── */}
      {tab === 'progression' && (
        <div>
          <div style={{ padding: '8px 12px', background: 'var(--green-light)', border: '1px solid var(--green-light)', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
            {t('department.progression_info')}
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('department.progression_loading')}</div>
          ) : alertes.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><CheckCircle2 size={26} strokeWidth={2} color="var(--green)" /></div>
              <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>{t('department.progression_no_alerts')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('department.progression_no_alerts_hint')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alertes.map((a, i) => {
                const isCritique = a.niveau === 'CRITIQUE'
                return (
                  <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, border: `1px solid ${isCritique ? 'var(--red-light)' : 'var(--amber-light)'}`, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ background: isCritique ? 'var(--red-light)' : 'var(--amber-light)', borderRadius: 7, padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isCritique ? 'var(--red)' : 'var(--amber)' }}>-{a.retardPct}%</div>
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: isCritique ? 'var(--red)' : 'var(--amber)', textTransform: 'uppercase' }}>{a.niveau}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{a.className}</span>
                          <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '1px 6px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{a.subjectName}</span>
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{a.programmeTitre}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>
                          {t('department.progression_chapters').replace('{done}', String(a.chapitresRealises)).replace('{total}', String(a.chapitresTotal)).replace('{pct}', String(a.progressionPct)).replace('{expected}', String(a.attenduPct))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Onglet Programmes & Chapitres ─── */}
      {tab === 'programmes' && (
        <div className="space-y-3.5">
          {/* Entête avec bouton d'ajout */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Programmes pédagogiques de la discipline
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                Définissez les programmes officiels et structurez les chapitres pour les matières de votre département.
              </div>
            </div>
            <button
              onClick={() => setShowNewProgForm(p => !p)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white border-none cursor-pointer inline-flex items-center gap-1.5 transition-all"
              style={{ background: showNewProgForm ? 'var(--text3)' : 'var(--sidebar)' }}
            >
              {showNewProgForm ? <X size={13} /> : <Plus size={13} />}
              <span>{showNewProgForm ? 'Fermer' : 'Nouveau programme'}</span>
            </button>
          </div>

          {/* Formulaire de création de nouveau programme */}
          {showNewProgForm && (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3 shadow-xs">
              <div className="text-xs font-bold text-[var(--text)]">Nouveau programme départemental</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label style={labelStyle}>Titre du programme *</label>
                  <input
                    value={formTitre}
                    onChange={e => setFormTitre(e.target.value)}
                    placeholder="Ex: Mathématiques 6ème — Programme officiel 2026/2027"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Matière *</label>
                  <select
                    value={formSubjectId}
                    onChange={e => setFormSubjectId(e.target.value)}
                    style={inputStyle}
                  >
                    {deptSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Niveau (ex: 6e, 5e, 4e, 3e...)</label>
                  <input
                    value={formLevel}
                    onChange={e => setFormLevel(e.target.value)}
                    placeholder="Ex: 6e"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Classe spécifique (optionnel)</label>
                  <select
                    value={formClassId}
                    onChange={e => setFormClassId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">— Toutes classes du niveau —</option>
                    {classesList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleCreateProgramme}
                    disabled={savingProg || !formTitre.trim() || !formSubjectId}
                    className="w-full h-[38px] px-4 rounded-lg text-xs font-extrabold text-white border-none cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--sidebar)' }}
                  >
                    {savingProg ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    <span>{savingProg ? 'Enregistrement…' : 'Créer le programme'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Liste des programmes existants */}
          {progLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
              {tcommon('status.loading')}
            </div>
          ) : programmes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><BookOpen size={28} strokeWidth={1.5} color="var(--text3)" /></div>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>Aucun programme pour ce département</div>
              <div style={{ fontSize: 11.5, color: 'var(--border2)', marginTop: 4 }}>
                Cliquez sur « Nouveau programme » ci-dessus pour initialiser le syllabus de votre discipline.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {programmes.map(p => {
                const isExpanded = expandedProg === p.id
                const totalHours = p.chapitres.reduce((sum, c) => sum + (c.volumeHeuresPrevu || 0), 0)
                return (
                  <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs">
                    {/* Header accordéon du programme */}
                    <div
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg2)] transition-colors"
                      onClick={() => setExpandedProg(isExpanded ? null : p.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[var(--text3)]">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-[var(--text)] truncate">{p.titre}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>
                              {p.subject?.name}
                            </span>
                            {p.level && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
                                Niveau {p.level}
                              </span>
                            )}
                            {p.class && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                                {p.class.name}
                              </span>
                            )}
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold text-[var(--text3)]">
                              {p.chapitres.length} chapitre{p.chapitres.length > 1 ? 's' : ''} ({totalHours}h prévues)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setAddingChapFor(p.id)
                            setExpandedProg(p.id)
                          }}
                          className="px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer inline-flex items-center gap-1 border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg2)] text-[var(--text)]"
                        >
                          <Plus size={12} />
                          <span className="hidden sm:inline">Ajouter chapitre</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProgramme(p.id, p.titre)}
                          className="p-1.5 rounded-md text-[var(--red)] hover:bg-[var(--red-light)] border-none cursor-pointer transition-colors"
                          title="Supprimer ce programme"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Contenu dépliable : Liste des chapitres + formulaire d'ajout */}
                    {isExpanded && (
                      <div className="p-3.5 border-t border-[var(--border)] bg-[var(--bg)]/40 space-y-3">
                        {/* Formulaire ajout chapitre */}
                        {addingChapFor === p.id && (
                          <div className="p-3 rounded-lg border border-[var(--border2)] bg-[var(--surface)] space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[var(--text)]">Ajouter un chapitre</span>
                              <button onClick={() => setAddingChapFor(null)} className="text-[var(--text3)] hover:text-[var(--text)] border-none bg-transparent cursor-pointer">
                                <X size={14} />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <div className="sm:col-span-2">
                                <label style={labelStyle}>Titre du chapitre *</label>
                                <input
                                  value={chapTitre}
                                  onChange={e => setChapTitre(e.target.value)}
                                  placeholder="Ex: Chapitre 1 — Nombres entiers et décimaux"
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Volume horaire (heures)</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={chapHeures}
                                  onChange={e => setChapHeures(parseInt(e.target.value, 10) || 1)}
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Séquence cible de fin (1-6)</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={6}
                                  value={chapSeq}
                                  onChange={e => setChapSeq(e.target.value)}
                                  placeholder="Ex: 2"
                                  style={inputStyle}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => setAddingChapFor(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text2)] bg-[var(--bg2)] border-none cursor-pointer"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={() => handleAddChapitre(p.id)}
                                disabled={savingChap || !chapTitre.trim()}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold text-white border-none cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                                style={{ background: 'var(--sidebar)' }}
                              >
                                {savingChap ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                <span>Enregistrer le chapitre</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Liste des chapitres */}
                        {p.chapitres.length === 0 ? (
                          <div className="p-4 text-center text-xs text-[var(--text3)] italic">
                            Aucun chapitre défini pour ce programme. Cliquez sur « Ajouter chapitre » ci-dessus.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {p.chapitres.sort((a, b) => a.ordre - b.ordre).map(chap => {
                              const isEditingThis = editingChap?.id === chap.id
                              return (
                                <div
                                  key={chap.id}
                                  className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-3 text-xs"
                                >
                                  {isEditingThis ? (
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                                      <input
                                        className="sm:col-span-2"
                                        value={editingChap.titre}
                                        onChange={e => setEditingChap(prev => prev ? { ...prev, titre: e.target.value } : null)}
                                        style={inputStyle}
                                      />
                                      <input
                                        type="number"
                                        min={1}
                                        value={editingChap.volumeHeuresPrevu}
                                        onChange={e => setEditingChap(prev => prev ? { ...prev, volumeHeuresPrevu: parseInt(e.target.value, 10) || 1 } : null)}
                                        style={inputStyle}
                                      />
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={handleUpdateChapitre}
                                          disabled={savingEditChap}
                                          className="p-1.5 rounded-md bg-[var(--green-light)] text-[var(--green)] border-none cursor-pointer font-bold"
                                        >
                                          <Check size={14} />
                                        </button>
                                        <button
                                          onClick={() => setEditingChap(null)}
                                          className="p-1.5 rounded-md bg-[var(--bg2)] text-[var(--text2)] border-none cursor-pointer"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="w-5 h-5 rounded-full bg-[var(--bg2)] text-[10.5px] font-extrabold text-[var(--text2)] flex items-center justify-center shrink-0">
                                          {chap.ordre}
                                        </span>
                                        <span className="font-bold text-[var(--text)] truncate">{chap.titre}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-semibold text-[var(--text3)]">{chap.volumeHeuresPrevu}h</span>
                                        {chap.sequenceCibleFin && (
                                          <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-[var(--purple-light)] text-[var(--purple)]">
                                            Fin S{chap.sequenceCibleFin}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => setEditingChap({
                                            id: chap.id,
                                            titre: chap.titre,
                                            volumeHeuresPrevu: chap.volumeHeuresPrevu,
                                            sequenceCibleFin: chap.sequenceCibleFin,
                                          })}
                                          className="p-1 rounded text-[var(--text2)] hover:bg-[var(--bg2)] border-none cursor-pointer"
                                          title="Modifier"
                                        >
                                          <Edit3 size={13} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteChapitre(chap.id, chap.titre)}
                                          className="p-1 rounded text-[var(--red)] hover:bg-[var(--red-light)] border-none cursor-pointer"
                                          title="Supprimer"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
