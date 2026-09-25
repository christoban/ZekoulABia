'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Check, FlaskConical, Play, RefreshCw, Sparkles, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Assignment {
  subjectId: string
  subjectName: string
  currentTeacherId: string | null
  currentTeacherName: string | null
}

interface Room {
  id: string
  name: string
  type: string
  status: string
  capacity: number
}

interface Group {
  id: string
  name: string
  subjectId?: string | null
}

interface GroupSet {
  id: string
  name: string
  groups: Group[]
}

interface ProposedSession {
  subjectId: string
  teacherId: string
  roomId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface ProposedGroupSession extends ProposedSession {
  groupId: string
  groupName: string
  participantsCount: number
  isLV2Slot: true
}

interface ProposedFreeTime {
  kind: 'FREE'
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface Proposal {
  statut: 'OPTIMAL' | 'FEASIBLE' | 'INFAISABLE'
  seances: ProposedSession[]
  seancesGroupes?: ProposedGroupSession[]
  tempsLibres?: ProposedFreeTime[]
  scoreObjectif: number
  dureeResolutionMs: number
  raisonInfaisabilite?: string
  problemes?: string[]
  suggestions?: string[]
  explicatifs?: string[]
  avertissements?: string[]
}

interface AsyncGenerationRun {
  id: string
  academicYearId: string
  status: string
  progress?: { targets?: Array<{ classId: string }> }
  results?: Array<{
    classId: string
    timetableId?: string
    status: string
    seances?: ProposedSession[]
    seancesGroupes?: ProposedGroupSession[]
    warnings?: string[]
    error?: string
  }>
}

const RUN_STORAGE_PREFIX = 'zekoulabia_timetable_run_'

interface SimulationResult {
  propositionSimulee: Proposal
  differences: {
    seancesDeplacees: number
    scoreBase: number
    scoreSimule: number
    avertissements: string[]
  }
}

interface TimetableLike {
  id: string
  status: string
}

interface Props {
  classId: string
  academicYearId?: string
  timetable: TimetableLike | null
  assignments: Assignment[]
  gridConfigured: boolean
  onRefresh: () => void
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

type BusyAction = 'propose' | 'apply' | 'whatif' | 'adjust' | 'group' | 'room' | null

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

type ReponseApi<T> = T & { message?: string; data?: T }

async function lireReponseJson<T>(reponse: Response): Promise<ReponseApi<T>> {
  const texte = await reponse.text()
  if (!texte.trim()) throw new Error(`Réponse vide du serveur (HTTP ${reponse.status})`)
  try {
    return JSON.parse(texte) as ReponseApi<T>
  } catch {
    throw new Error(`Réponse invalide du serveur (HTTP ${reponse.status})`)
  }
}

const attendre = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function SectionTimetableStaffActions({
  classId,
  academicYearId,
  timetable,
  assignments,
  gridConfigured,
  onRefresh,
  onToast,
}: Props) {
  const t = useT('staff')
  const [rooms, setRooms] = useState<Room[]>([])
  const [groupSets, setGroupSets] = useState<GroupSet[]>([])
  const [roomId, setRoomId] = useState('')
  const [groupSetId, setGroupSetId] = useState('')
  const [groupDay, setGroupDay] = useState('0')
  const [groupStart, setGroupStart] = useState('08:00')
  const [groupEnd, setGroupEnd] = useState('09:00')
  const [whatIfOpen, setWhatIfOpen] = useState(false)
  const [unavailableRooms, setUnavailableRooms] = useState<Set<string>>(new Set())
  const [hoursToRemove, setHoursToRemove] = useState<Record<string, number>>({})
  const [teacherUnavailableId, setTeacherUnavailableId] = useState('')
  const [teacherDay, setTeacherDay] = useState('0')
  const [teacherStart, setTeacherStart] = useState('08:00')
  const [teacherEnd, setTeacherEnd] = useState('09:00')
  const [adjustInstruction, setAdjustInstruction] = useState('')
  const [adjustResult, setAdjustResult] = useState<{ applied: string[]; errors: string[]; message: string } | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [proposalTimetableId, setProposalTimetableId] = useState('')
  const [simulation, setSimulation] = useState<SimulationResult | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      const [roomRes, groupRes, roomAssignmentRes] = await Promise.all([
        fetchApi('/api/v2/rooms', { credentials: 'include' }),
        fetchApi('/api/v2/student-groups', { credentials: 'include' }),
        academicYearId
          ? fetchApi(`/api/v2/class-room-assignments?academicYearId=${encodeURIComponent(academicYearId)}`, { credentials: 'include' })
          : Promise.resolve(null),
      ])
      const [roomData, groupData, roomAssignmentData] = await Promise.all([roomRes.json(), groupRes.json(), roomAssignmentRes?.json() ?? Promise.resolve(null)])
      if (!active) return
      setRooms(Array.isArray(roomData.data) ? roomData.data : [])
      setGroupSets(Array.isArray(groupData.data) ? groupData.data : [])
      const assignment = Array.isArray(roomAssignmentData?.data)
        ? roomAssignmentData.data.find((item: { classId?: string }) => item.classId === classId)
        : null
      setRoomId(assignment?.roomId ?? '')
    }
    load().catch(() => {
      if (active) onToast(t('timetable.planning.loadError'), 'error')
    })
    return () => { active = false }
  }, [academicYearId, classId])

  const activeRooms = useMemo(() => rooms.filter(room => room.status === 'ACTIVE'), [rooms])
  const assignedCount = assignments.filter(assignment => assignment.currentTeacherId).length
  const assignedTeachers = useMemo(() => {
    const teachers = new Map<string, string>()
    for (const assignment of assignments) {
      if (assignment.currentTeacherId && assignment.currentTeacherName) teachers.set(assignment.currentTeacherId, assignment.currentTeacherName)
    }
    return [...teachers.entries()]
  }, [assignments])
  const selectedGroupSet = groupSets.find(groupSet => groupSet.id === groupSetId)
  const canEdit = !timetable || timetable.status === 'DRAFT'
  const canPropose = canEdit && Boolean(gridConfigured && activeRooms.length > 0 && assignedCount > 0)
  const canSimulate = Boolean(timetable?.id && assignments.length > 0)
  const canAdjust = Boolean(timetable?.id && canEdit)

  const ensureTimetable = async (): Promise<string> => {
    if (timetable?.id) return timetable.id
    const res = await fetchApi('/api/v2/timetables/generate-skeleton', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ classId }),
     })
     const data = await lireReponseJson<{ id?: string; timetableId?: string }>(res)
    if (!res.ok) {
      if (res.status === 409 && data.data?.timetableId) return data.data.timetableId as string
      throw new Error(data.message || t('timetable.planning.createError'))
    }
    return data.data?.id as string
  }

  const pollRun = useCallback(async (runId: string) => {
    if (!mountedRef.current) return
    const terminal = new Set(['PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED'])
    try {
      while (mountedRef.current) {
        const response = await fetchApi(`/api/v2/timetables/generation-runs/${runId}`, { credentials: 'include' })
        if (response.status === 404) {
          localStorage.removeItem(`${RUN_STORAGE_PREFIX}${timetable?.id ?? classId}`)
          return
        }
        const data = await lireReponseJson<{ data?: AsyncGenerationRun }>(response)
        if (!response.ok || !data.data) throw new Error(t('timetable.planning.proposeError'))
        if (terminal.has(data.data.status)) {
          const result = data.data.results?.find(item => item.classId === classId)
          if (!result || !result.seances || ['ECHEC', 'ECHEC_TECHNIQUE', 'NON_TRAITE', 'INFAISABLE', 'IGNORE_EDT_VERROUILLE'].includes(result.status)) {
            throw new Error(result?.error || t('timetable.planning.proposeError'))
          }
          setProposalTimetableId(result.timetableId ?? timetable?.id ?? '')
          setProposal({
            statut: result.status === 'DEGRADE' || result.status === 'PARTIEL' ? 'FEASIBLE' : 'OPTIMAL',
            seances: result.seances,
            seancesGroupes: result.seancesGroupes ?? [],
            tempsLibres: [],
            scoreObjectif: 0,
            dureeResolutionMs: 0,
          })
          setSimulation(null)
          onRefresh()
           onToast(t('timetable.planning.proposed'), 'success')
           return
        }
        await attendre(1000)
      }
    } catch (error) {
      if (mountedRef.current) onToast(error instanceof Error ? error.message : t('timetable.planning.proposeError'), 'error')
    }
  }, [classId, onRefresh, onToast, t, timetable?.id])

  useEffect(() => {
    mountedRef.current = true
    if (!timetable?.id || !academicYearId) return
    let cancelled = false
    const restore = async () => {
      const storageKey = `${RUN_STORAGE_PREFIX}${timetable.id}`
      const storedValue = localStorage.getItem(storageKey)
      const stored = storedValue ? JSON.parse(storedValue) as { runId?: string } : null
      let runId = stored?.runId
      if (!runId) {
        const response = await fetchApi(`/api/v2/timetables/generation-runs/active?academicYearId=${encodeURIComponent(academicYearId)}`, { credentials: 'include' })
        if (cancelled || !response.ok) return
        const data = await lireReponseJson<{ data?: AsyncGenerationRun | null }>(response)
        const activeRun = data.data
        if (!activeRun?.progress?.targets?.some(target => target.classId === classId)) return
        runId = activeRun.id
        localStorage.setItem(storageKey, JSON.stringify({ runId }))
      }
      if (runId) {
        setBusy('propose')
        await pollRun(runId)
        if (mountedRef.current) setBusy(null)
      }
    }
    restore().catch(() => undefined)
    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [academicYearId, classId, pollRun, timetable?.id])

  const handlePropose = async () => {
    setBusy('propose')
    setProposal(null)
    setSimulation(null)
    try {
      const timetableId = await ensureTimetable()
      const response = await fetchApi(`/api/v2/timetables/${timetableId}/propose-schedule-async`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await lireReponseJson<{ data?: { runId: string; academicYearId: string } }>(response)
      if (!response.ok || !data.data?.runId) throw new Error(t('timetable.planning.proposeError'))
      localStorage.setItem(`${RUN_STORAGE_PREFIX}${timetableId}`, JSON.stringify({ runId: data.data.runId }))
      await pollRun(data.data.runId)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.planning.proposeError'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleApply = async () => {
    if (!proposal || !proposalTimetableId || (proposal.seances.length === 0 && (proposal.seancesGroupes?.length ?? 0) === 0 && (proposal.tempsLibres?.length ?? 0) === 0)) return
    if (!window.confirm(t('timetable.planning.applyConfirm'))) return
    setBusy('apply')
    try {
      const res = await fetchApi(`/api/v2/timetables/${proposalTimetableId}/apply-schedule`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ seances: proposal.seances, seancesGroupes: proposal.seancesGroupes ?? [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.planning.applyError'))
       setProposal(null)
       setSimulation(null)
       if ((data.data as { avertissements?: string[] } | undefined)?.avertissements?.length) {
         onToast(t('timetable.planning.applyWarnings'), 'info')
       }
       onToast(t('timetable.planning.applied'), 'success')

      onRefresh()
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.planning.applyError'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleWhatIf = async () => {
    if (!timetable?.id) return
    setBusy('whatif')
    try {
      const retraitHeures = Object.entries(hoursToRemove)
        .filter(([, heures]) => heures > 0)
        .map(([subjectId, heures]) => ({ subjectId, heures }))
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/what-if`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulations: {
            sallesHorsService: [...unavailableRooms],
            ...(teacherUnavailableId ? {
              indisponibilitesSupplementaires: [{
                teacherId: teacherUnavailableId,
                dayOfWeek: Number(teacherDay),
                startTime: teacherStart,
                endTime: teacherEnd,
              }],
            } : {}),
            ...(retraitHeures.length > 0 ? { retraitHeures } : {}),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.planning.whatIfError'))
      setSimulation(data.data)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.planning.whatIfError'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleAdjust = async () => {
    if (!timetable?.id || !adjustInstruction.trim()) return
    if (!window.confirm(t('timetable.planning.adjustConfirm'))) return
    setBusy('adjust')
    setAdjustResult(null)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/adjust`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: adjustInstruction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.planning.adjustError'))
      setAdjustResult(data.data)
      setAdjustInstruction('')
      onRefresh()
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.planning.adjustError'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const saveRoomAssignment = async () => {
    if (!roomId || !academicYearId) return
    setBusy('room')
    try {
      const res = await fetchApi(`/api/v2/classes/${classId}/room-assignment`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, academicYearId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.planning.roomError'))
      onToast(t('timetable.planning.roomSaved'), 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.planning.roomError'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const generateGroupSessions = async () => {
    if (!timetable?.id || !selectedGroupSet || !academicYearId) return
    const assignmentsBySubject = new Map(assignments.map(assignment => [assignment.subjectId, assignment.currentTeacherId]))
    const enseignantParGroupe = selectedGroupSet.groups.flatMap(group => {
      const teacherId = group.subjectId ? assignmentsBySubject.get(group.subjectId) : null
      return teacherId ? [{ groupId: group.id, teacherId }] : []
    })
    if (enseignantParGroupe.length !== selectedGroupSet.groups.length) {
      onToast(t('timetable.planning.groupTeacherMissing'), 'error')
      return
    }
    if (!window.confirm(t('timetable.planning.groupConfirm'))) return
    setBusy('group')
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/generate-group-sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupSetId: selectedGroupSet.id,
          academicYearId,
          dayOfWeek: Number(groupDay),
          startTime: groupStart,
          endTime: groupEnd,
          enseignantParGroupe,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.planning.groupError'))
      onToast(t('timetable.planning.groupSuccess'), 'success')
      onRefresh()
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.planning.groupError'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const toggleRoom = (id: string) => {
    setUnavailableRooms(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Sparkles size={16} color="var(--purple)" />
          <strong style={{ color: 'var(--text)', fontSize: 14 }}>{t('timetable.planning.title')}</strong>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button style={actionButton} onClick={handlePropose} disabled={!canPropose || busy !== null}>
            {busy === 'propose' ? <RefreshCw size={14} className="animate-spin" /> : <Bot size={14} />}
            {t('timetable.planning.propose')}
          </button>
          <button style={secondaryButton} onClick={() => setWhatIfOpen(value => !value)} disabled={!canSimulate}>
            <FlaskConical size={14} /> {t('timetable.planning.whatIf')}
          </button>
           {proposal && (proposal.seances.length > 0 || (proposal.seancesGroupes?.length ?? 0) > 0 || (proposal.tempsLibres?.length ?? 0) > 0) && (
            <button style={actionButton} onClick={handleApply} disabled={!canEdit || busy !== null}>
              <Check size={14} /> {busy === 'apply' ? t('timetable.planning.applying') : t('timetable.planning.apply')}
            </button>
          )}
        </div>
        {!canPropose && (
          <div style={{ marginTop: 9, color: 'var(--amber)', fontSize: 12 }}>
            {t('timetable.planning.prerequisites', {
              grid: gridConfigured ? '✓' : '⚠',
              rooms: activeRooms.length > 0 ? '✓' : '⚠',
              assignments: assignedCount > 0 ? '✓' : '⚠',
            })}
          </div>
        )}
      </div>

      {proposal && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--purple)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.proposalTitle')}</strong>
            <button style={iconButton} onClick={() => setProposal(null)} aria-label={t('timetable.planning.close')}><X size={15} /></button>
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 11.5, marginTop: 4 }}>
             {t('timetable.planning.proposalMeta', { count: proposal.seances.length + (proposal.seancesGroupes?.length ?? 0) + (proposal.tempsLibres?.length ?? 0), score: proposal.scoreObjectif })}
          </div>
           {proposal.raisonInfaisabilite && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 7 }}>{proposal.raisonInfaisabilite}</div>}
           {proposal.problemes && proposal.problemes.length > 0 && (
             <div style={{ marginTop: 9 }}>
               <strong style={{ color: 'var(--text2)', fontSize: 12 }}>{t('timetable.planning.problemsTitle')}</strong>
               <ul style={{ margin: '5px 0 0 18px', padding: 0, color: 'var(--red)', fontSize: 12 }}>
                 {proposal.problemes.map(probleme => <li key={probleme}>{probleme}</li>)}
               </ul>
             </div>
           )}
           {proposal.suggestions && proposal.suggestions.length > 0 && (
             <div style={{ marginTop: 9 }}>
               <strong style={{ color: 'var(--text2)', fontSize: 12 }}>{t('timetable.planning.suggestionsTitle')}</strong>
               <ul style={{ margin: '5px 0 0 18px', padding: 0, color: 'var(--amber)', fontSize: 12 }}>
                 {proposal.suggestions.map(suggestion => <li key={suggestion}>{suggestion}</li>)}
               </ul>
             </div>
           )}
           {proposal.avertissements && proposal.avertissements.length > 0 && (
             <div style={{ marginTop: 9 }}>
               <strong style={{ color: 'var(--amber)', fontSize: 12 }}>{t('timetable.planning.warningsTitle')}</strong>
               <ul style={{ margin: '5px 0 0 18px', padding: 0, color: 'var(--amber)', fontSize: 12 }}>
                 {proposal.avertissements.map(avertissement => <li key={avertissement}>{avertissement}</li>)}
               </ul>
             </div>
           )}
           {proposal.explicatifs && proposal.explicatifs.length > 0 && (
             <div style={{ marginTop: 10, maxHeight: 130, overflowY: 'auto' }}>
               <strong style={{ color: 'var(--text2)', fontSize: 12 }}>{t('timetable.planning.explanationsTitle')}</strong>
               <ul style={{ margin: '5px 0 0 18px', padding: 0, color: 'var(--text3)', fontSize: 11.5 }}>
                 {proposal.explicatifs.map(explication => <li key={explication}>{explication}</li>)}
               </ul>
             </div>
           )}

           {(proposal.seances.length > 0 || (proposal.seancesGroupes?.length ?? 0) > 0 || (proposal.tempsLibres?.length ?? 0) > 0) && (
             <div style={{ display: 'grid', gap: 5, marginTop: 10, maxHeight: 220, overflowY: 'auto' }}>
              {proposal.seances.map((session, index) => (
                <div key={`${session.subjectId}-${session.teacherId}-${session.dayOfWeek}-${session.startTime}-${index}`} style={sessionRow}>
                  <span>{DAY_NAMES[session.dayOfWeek] ?? session.dayOfWeek} · {session.startTime}–{session.endTime}</span>
                  <span>{assignments.find(a => a.subjectId === session.subjectId)?.subjectName ?? session.subjectId} · {rooms.find(r => r.id === session.roomId)?.name ?? session.roomId}</span>
                </div>
               ))}
               {proposal.seancesGroupes?.map((session, index) => (
                 <div key={`${session.groupId}-${session.dayOfWeek}-${session.startTime}-${index}`} style={sessionRow}>
                   <span>{DAY_NAMES[session.dayOfWeek] ?? session.dayOfWeek} · {session.startTime}–{session.endTime}</span>
                   <span>{assignments.find(a => a.subjectId === session.subjectId)?.subjectName ?? session.subjectId} · {session.groupName} ({session.participantsCount}) · {rooms.find(r => r.id === session.roomId)?.name ?? session.roomId}</span>
                 </div>
                ))}
                {proposal.tempsLibres?.map((session, index) => (
                  <div key={`${session.dayOfWeek}-${session.startTime}-${index}`} style={{ ...sessionRow, background: 'var(--blue-light)' }}>
                    <span>{DAY_NAMES[session.dayOfWeek] ?? session.dayOfWeek} · {session.startTime}–{session.endTime}</span>
                    <span>{t('timetable.freeTime')}</span>
                  </div>
                ))}
              </div>
          )}
        </div>
      )}

      {whatIfOpen && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--blue)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.whatIfTitle')}</strong>
            <button style={iconButton} onClick={() => setWhatIfOpen(false)} aria-label={t('timetable.planning.close')}><X size={15} /></button>
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 11.5, marginBottom: 9 }}>{t('timetable.planning.whatIfHint')}</div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
            {activeRooms.map(room => (
              <label key={room.id} style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text2)', fontSize: 12 }}>
                <input type="checkbox" checked={unavailableRooms.has(room.id)} onChange={() => toggleRoom(room.id)} />
                {room.name} · {room.capacity}
              </label>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ color: 'var(--text2)', fontSize: 11.5 }}>{t('timetable.planning.teacherUnavailable')}</span>
              <select value={teacherUnavailableId} onChange={event => setTeacherUnavailableId(event.target.value)} style={inputStyle}>
                <option value="">{t('timetable.planning.teacherPlaceholder')}</option>
                {assignedTeachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            {teacherUnavailableId && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <select value={teacherDay} onChange={event => setTeacherDay(event.target.value)} style={{ ...inputStyle, width: 130 }}>
                  {DAY_NAMES.map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
                <input type="time" value={teacherStart} onChange={event => setTeacherStart(event.target.value)} style={{ ...inputStyle, width: 120 }} />
                <input type="time" value={teacherEnd} onChange={event => setTeacherEnd(event.target.value)} style={{ ...inputStyle, width: 120 }} />
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {assignments.map(assignment => (
              <label key={assignment.subjectId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text2)', fontSize: 12 }}>
                <span>{assignment.subjectName}</span>
                <input type="number" min={0} step={0.5} value={hoursToRemove[assignment.subjectId] ?? 0} onChange={event => setHoursToRemove(previous => ({ ...previous, [assignment.subjectId]: Number(event.target.value) }))} style={{ width: 72, padding: 5, border: '1px solid var(--border)', borderRadius: 6 }} />
              </label>
            ))}
          </div>
          <button style={{ ...actionButton, marginTop: 12 }} onClick={handleWhatIf} disabled={busy !== null}>
            <Play size={14} /> {busy === 'whatif' ? t('timetable.planning.simulating') : t('timetable.planning.simulate')}
          </button>
          {simulation && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--blue-light)', color: 'var(--text2)', fontSize: 12 }}>
              <strong style={{ color: 'var(--blue)' }}>{t('timetable.planning.simulationResult')}</strong>
              <div>{t('timetable.planning.moved', { count: simulation.differences.seancesDeplacees })}</div>
              <div>{t('timetable.planning.score', { base: simulation.differences.scoreBase, simulated: simulation.differences.scoreSimule })}</div>
            </div>
          )}
        </div>
      )}

      {canAdjust && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}><Bot size={15} color="var(--purple)" /><strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.adjustTitle')}</strong></div>
          <div style={{ color: 'var(--text3)', fontSize: 11.5, marginBottom: 8 }}>{t('timetable.planning.adjustHint')}</div>
          <textarea value={adjustInstruction} onChange={event => setAdjustInstruction(event.target.value)} placeholder={t('timetable.planning.adjustPlaceholder')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <button style={{ ...actionButton, marginTop: 8 }} onClick={handleAdjust} disabled={busy !== null || !adjustInstruction.trim()}>{busy === 'adjust' ? t('timetable.planning.adjusting') : t('timetable.planning.adjust')}</button>
          {adjustResult && <div style={{ marginTop: 8, color: adjustResult.errors.length > 0 ? 'var(--red)' : 'var(--green)', fontSize: 12 }}>{adjustResult.message}</div>}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
        <strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.roomTitle')}</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <select value={roomId} onChange={event => setRoomId(event.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 170 }}>
            <option value="">{t('timetable.planning.roomPlaceholder')}</option>
            {activeRooms.map(room => <option key={room.id} value={room.id}>{room.name} · {room.capacity}</option>)}
          </select>
          <button style={secondaryButton} onClick={saveRoomAssignment} disabled={!canEdit || !roomId || !academicYearId || busy !== null}>{t('timetable.planning.saveRoom')}</button>
        </div>
      </div>

      {groupSets.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.groupTitle')}</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <select value={groupSetId} onChange={event => setGroupSetId(event.target.value)} style={inputStyle}>
              <option value="">{t('timetable.planning.groupPlaceholder')}</option>
              {groupSets.map(groupSet => <option key={groupSet.id} value={groupSet.id}>{groupSet.name}</option>)}
            </select>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
              <select value={groupDay} onChange={event => setGroupDay(event.target.value)} style={{ ...inputStyle, width: 130 }}>
                {DAY_NAMES.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
              <input type="time" value={groupStart} onChange={event => setGroupStart(event.target.value)} style={{ ...inputStyle, width: 120 }} />
              <input type="time" value={groupEnd} onChange={event => setGroupEnd(event.target.value)} style={{ ...inputStyle, width: 120 }} />
               <button style={secondaryButton} onClick={generateGroupSessions} disabled={!canEdit || !timetable?.id || !selectedGroupSet || busy !== null}>{t('timetable.planning.generateGroups')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const actionButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', fontSize: 12, fontWeight: 750, cursor: 'pointer', opacity: 1 }
const secondaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const iconButton: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'inline-flex', padding: 3 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }
const sessionRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 8px', borderRadius: 6, background: 'var(--bg)', color: 'var(--text2)', fontSize: 11.5 }
