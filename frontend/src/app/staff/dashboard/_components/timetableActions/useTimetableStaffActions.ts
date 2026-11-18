'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import {
  attendre,
  lireReponseJson,
  RUN_STORAGE_PREFIX,
  type Assignment,
  type AsyncGenerationRun,
  type BusyAction,
  type GroupSet,
  type Proposal,
  type Room,
  type SimulationResult,
  type TimetableLike,
} from './timetableActionsTypes'

interface Params {
  classId: string
  academicYearId?: string
  timetable: TimetableLike | null
  assignments: Assignment[]
  gridConfigured: boolean
  onRefresh: () => void
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export function useTimetableStaffActions({
  classId,
  academicYearId,
  timetable,
  assignments,
  gridConfigured,
  onRefresh,
  onToast,
}: Params) {
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
      const [roomData, groupData, roomAssignmentData] = await Promise.all([
        roomRes.json(),
        groupRes.json(),
        roomAssignmentRes?.json() ?? Promise.resolve(null),
      ])
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
  }, [academicYearId, classId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!(await confirmAction(t('timetable.planning.applyConfirm')))) return
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
    if (!(await confirmAction(t('timetable.planning.adjustConfirm')))) return
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
    if (!(await confirmAction(t('timetable.planning.groupConfirm')))) return
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

  return {
    rooms,
    activeRooms,
    assignedCount,
    assignedTeachers,
    groupSets,
    selectedGroupSet,
    roomId,
    setRoomId,
    groupSetId,
    setGroupSetId,
    groupDay,
    setGroupDay,
    groupStart,
    setGroupStart,
    groupEnd,
    setGroupEnd,
    whatIfOpen,
    setWhatIfOpen,
    unavailableRooms,
    toggleRoom,
    hoursToRemove,
    setHoursToRemove,
    teacherUnavailableId,
    setTeacherUnavailableId,
    teacherDay,
    setTeacherDay,
    teacherStart,
    setTeacherStart,
    teacherEnd,
    setTeacherEnd,
    adjustInstruction,
    setAdjustInstruction,
    adjustResult,
    proposal,
    setProposal,
    simulation,
    busy,
    canEdit,
    canPropose,
    canSimulate,
    canAdjust,
    handlePropose,
    handleApply,
    handleWhatIf,
    handleAdjust,
    saveRoomAssignment,
    generateGroupSessions,
  }
}
