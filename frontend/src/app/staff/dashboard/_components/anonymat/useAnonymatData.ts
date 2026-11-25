'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import type { RefItem, SequenceItem, SessionRow } from './anonymatTypes'

type OnToast = (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void

export function useAnonymatData(onToast: OnToast) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SessionRow | null>(null)
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [scopeId, setScopeId] = useState('')
  const [academicSequenceId, setAcademicSequenceId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [isAnonymized, setIsAnonymized] = useState(true)
  const [correctionMode, setCorrectionMode] = useState<'OWN_CLASS' | 'CROSSED'>('OWN_CLASS')
  const [teamEmails, setTeamEmails] = useState('')
  const [crossAssignments, setCrossAssignments] = useState<{ classId: string; correcteurUserId: string }[]>([])
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([])
  const [classes, setClasses] = useState<RefItem[]>([])
  const [subjects, setSubjects] = useState<RefItem[]>([])
  const [sequences, setSequences] = useState<SequenceItem[]>([])
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [designating, setDesignating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [teamProgress, setTeamProgress] = useState<{ total: number; done: number } | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/assessments/sessions', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setSessions(data.data ?? [])
      else onToast(data.message || 'Erreur chargement sessions', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
    ]).then(([cls, sub, ay]) => {
      type IdName = { id: string; name: string }
      type AyYear = { name: string; periods?: Array<{ name: string; sequences?: IdName[] }> }
      if (cls.data) setClasses((cls.data as IdName[]).map((c) => ({ id: c.id, name: c.name })))
      if (sub.data) setSubjects((sub.data as IdName[]).map((s) => ({ id: s.id, name: s.name })))
      if (ay.data) {
        const seqs = ((ay.data ?? []) as AyYear[]).flatMap((year) =>
          (year.periods ?? []).flatMap((p) =>
            (p.sequences ?? []).map((s) => ({
              id: s.id,
              label: `${year.name} · ${p.name} · ${s.name}`,
            })),
          ),
        )
        setSequences(seqs)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (selected?.anonymatStatus === 'ANONYMISATION_TERMINEE' && selected.correctionMode === 'CROSSED' && teachers.length === 0) {
      fetchApi('/api/v2/users?role=TEACHER', { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setTeachers((d.data as Array<{ id: string; firstName: string; lastName: string }>).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })))
          }
        })
        .catch(() => {})
    }
  }, [selected?.anonymatStatus, selected?.correctionMode, teachers.length])

  useEffect(() => {
    if (!selected || !['CODES_GENERES', 'EQUIPE_DESIGNEE', 'ANONYMISATION_EN_COURS', 'ANONYMISATION_TERMINEE'].includes(selected.anonymatStatus)) {
      setTeamProgress(null)
      return
    }
    fetchApi(`/api/v2/assessments/sessions/${selected.id}/anonymat/team-progress`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setTeamProgress(d.data) })
      .catch(() => {})
  }, [selected])

  const createSession = async () => {
    if (!scopeId || !subjectId || !classId || !scheduledDate || !academicSequenceId) {
      onToast('Tous les champs sont requis (incl. séquence académique)', 'error')
      return
    }
    setCreating(true)
    try {
      const res = await fetchApi('/api/v2/assessments/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentScopeId: scopeId,
          subjectId,
          classId,
          academicSequenceId,
          scheduledDate,
          isAnonymized,
          correctionMode: isAnonymized ? correctionMode : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onToast('Session créée', 'success')
        loadSessions()
        setScopeId('')
        setSubjectId('')
        setClassId('')
        setAcademicSequenceId('')
        setScheduledDate('')
      } else onToast(data.message || data.error || 'Échec', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setCreating(false)
    }
  }

  const generateCodes = async (sessionId: string, classIds: string[]) => {
    setGenerating(sessionId)
    try {
      const res = await fetchApi(`/api/v2/assessments/sessions/${sessionId}/anonymat/codes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classIds }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(`${data.data.codesCount} codes générés`, 'success')
        loadSessions()
      } else onToast(data.message || data.error || 'Échec codes', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setGenerating(null)
    }
  }

  const designateTeam = async (session: SessionRow) => {
    const emails = teamEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) {
      onToast('Au moins un email requis', 'error')
      return
    }
    setDesignating(true)
    try {
      const members = emails.map(email => ({ type: 'EMAIL' as const, email }))
      const schoolRes = await fetchApi('/api/v2/school/me', { credentials: 'include' })
      const school = await schoolRes.json()
      const res = await fetchApi(`/api/v2/assessments/sessions/${session.id}/anonymat/team`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members,
          classIds: [session.classId],
          schoolName: school?.data?.name ?? 'Établissement',
        }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(`${data.data.membersCreated} membre(s) notifié(s)`, 'success')
        setTeamEmails('')
        loadSessions()
      } else onToast(data.message || data.error || 'Échec équipe', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setDesignating(false)
    }
  }

  const assignCorrection = async (session: SessionRow) => {
    if (session.correctionMode === 'CROSSED' && crossAssignments.length === 0) {
      onToast('Ajoutez au moins un correcteur (mode croisé)', 'warning')
      return
    }
    if (session.correctionMode === 'CROSSED' && crossAssignments.some(a => !a.correcteurUserId)) {
      onToast('Tous les correcteurs doivent être sélectionnés', 'warning')
      return
    }
    setAssigning(true)
    try {
      const body =
        session.correctionMode === 'CROSSED'
          ? { classIds: [session.classId], assignments: crossAssignments }
          : { classIds: [session.classId] }
      const res = await fetchApi(
        `/api/v2/assessments/sessions/${session.id}/anonymat/correction-assignments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const data = await res.json()
      if (data.success) {
        onToast('Correcteurs assignés', 'success')
        loadSessions()
      } else onToast(data.message || data.error || 'Échec assignation', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setAssigning(false)
    }
  }

  const reconcile = async (sessionId: string) => {
    setReconciling(true)
    try {
      const res = await fetchApi(`/api/v2/assessments/sessions/${sessionId}/anonymat/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        onToast(
          `Réconciliation : ${data.data.reconciled} note(s)` +
            (data.data.locked ? ' (verrouillées)' : ' (brouillon)'),
          'success',
        )
        loadSessions()
      } else onToast(data.message || data.error || 'Échec réconciliation', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setReconciling(false)
    }
  }

  return {
    sessions,
    loading,
    selected,
    setSelected,
    classId,
    setClassId,
    subjectId,
    setSubjectId,
    scopeId,
    setScopeId,
    academicSequenceId,
    setAcademicSequenceId,
    scheduledDate,
    setScheduledDate,
    isAnonymized,
    setIsAnonymized,
    correctionMode,
    setCorrectionMode,
    teamEmails,
    setTeamEmails,
    crossAssignments,
    setCrossAssignments,
    teachers,
    classes,
    subjects,
    sequences,
    creating,
    generating,
    designating,
    assigning,
    reconciling,
    teamProgress,
    loadSessions,
    createSession,
    generateCodes,
    designateTeam,
    assignCorrection,
    reconcile,
  }
}
