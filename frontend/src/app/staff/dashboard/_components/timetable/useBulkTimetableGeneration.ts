'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import type { TimetableClassItem as ClassItem } from '@/features/timetable/timetableShared'
import type {
  ProposalPreviewGroupSession,
  ProposalPreviewMissingHours,
  ProposalPreviewSession,
} from '../TimetableProposalPreview'
import {
  type Assignment,
  type BulkResult,
  GLOBAL_RUN_STORAGE_KEY,
  type GenerationRunData,
  lireReponseJson,
} from './timetableStaffTypes'

interface UseBulkTimetableGenerationParams {
  classes: ClassItem[]
  loadingClasses: boolean
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export function useBulkTimetableGeneration({
  classes,
  loadingClasses,
  onToast,
  t,
}: UseBulkTimetableGenerationParams) {
  const [bulkPropose, setBulkPropose] = useState<{ current: number; total: number; className: string; errors: string[]; warnings: string[] } | null>(null)
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([])
  const [previewResult, setPreviewResult] = useState<BulkResult | null>(null)
  const [previewAssignments, setPreviewAssignments] = useState<Assignment[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [selectedPartialIds, setSelectedPartialIds] = useState<Set<string>>(new Set())
  const [applyingAll, setApplyingAll] = useState(false)
  const mountedRef = useRef(true)

  const pollGlobalRun = useCallback(async (runId: string) => {
    if (!mountedRef.current) return
    const terminal = new Set(['PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED'])
    try {
      while (mountedRef.current) {
        const runResponse = await fetchApi(`/api/v2/timetables/generation-runs/${runId}`, { credentials: 'include' })
        if (runResponse.status === 404) {
          localStorage.removeItem(GLOBAL_RUN_STORAGE_KEY)
          return
        }
        const runData = await lireReponseJson<{ data?: GenerationRunData }>(runResponse)
        if (!runResponse.ok || !runData.data) throw new Error(t('timetable.bulkProposeError'))
        const progress = runData.data.progress
        const targetTimetableIds = new Map((progress?.targets ?? []).map(target => [target.classId, target.timetableId]))
        const rawResults = (runData.data.results ?? []).filter(item => typeof item.classId === 'string') as Array<{
          classId: string
          className: string
          status: string
          timetableId?: string
          seances?: ProposalPreviewSession[]
          seancesGroupes?: ProposalPreviewGroupSession[]
          heuresNonPlacees?: ProposalPreviewMissingHours[]
          diagnostic?: { relaxedPedagogicalRules?: boolean; relaxedProblems?: string[]; problems?: string[] }
          warnings?: string[]
          error?: string
        }>
        setBulkResults(rawResults.map(item => {
          const normalizedStatus: BulkResult['status'] = item.status === 'success' || item.status === 'SUCCESS_WITH_WARNINGS' ? 'success' : item.status === 'PARTIEL' ? 'PARTIEL' : item.status === 'DEGRADE' ? 'DEGRADE' : item.status === 'IGNORE_EDT_VERROUILLE' ? 'IGNORE_EDT_VERROUILLE' : 'error'
          return {
            classId: item.classId,
            className: item.className,
            timetableId: item.timetableId ?? targetTimetableIds.get(item.classId),
            status: normalizedStatus,
            warnings: item.warnings ?? [],
            heuresNonPlacees: item.heuresNonPlacees ?? [],
            diagnostic: item.diagnostic,
            degradeDetails: item.status === 'DEGRADE' ? item.diagnostic?.relaxedProblems ?? [] : [],
            error: item.error,
            proposal: item.seances ? { seances: item.seances, seancesGroupes: item.seancesGroupes ?? [] } : undefined,
          }
        }))
        setBulkPropose({ current: progress?.current ?? 0, total: progress?.total ?? classes.length, className: progress?.className ?? '', errors: [], warnings: [] })
        if (terminal.has(runData.data.status)) {
          onToast(t('timetable.bulkProposeSuccess'), 'success')
          return
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      if (mountedRef.current) onToast(error instanceof Error ? error.message : t('timetable.bulkProposeError'), 'error')
    } finally {
      if (mountedRef.current) setBulkPropose(null)
    }
  }, [classes.length, onToast, t])

  useEffect(() => {
    mountedRef.current = true
    const academicYearId = classes[0]?.academicYearId
    if (loadingClasses || !academicYearId) return
    let cancelled = false
    const resume = async () => {
      const storedValue = localStorage.getItem(GLOBAL_RUN_STORAGE_KEY)
      const stored = storedValue ? JSON.parse(storedValue) as { runId?: string; academicYearId?: string } : null
      if (stored?.runId && stored.academicYearId === academicYearId) {
        await pollGlobalRun(stored.runId)
        return
      }
      if (stored) localStorage.removeItem(GLOBAL_RUN_STORAGE_KEY)
      const response = await fetchApi(`/api/v2/timetables/generation-runs/active?academicYearId=${encodeURIComponent(academicYearId)}`, { credentials: 'include' })
      if (cancelled || !response.ok) return
      const data = await lireReponseJson<{ data?: GenerationRunData | null }>(response)
      if (cancelled || !data.data?.id) return
      localStorage.setItem(GLOBAL_RUN_STORAGE_KEY, JSON.stringify({ runId: data.data.id, academicYearId: data.data.academicYearId }))
      await pollGlobalRun(data.data.id)
    }
    resume().catch(() => undefined)
    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [classes[0]?.academicYearId, loadingClasses, pollGlobalRun])

  const handleProposeAll = async () => {
    if (classes.length === 0 || !(await confirmAction(t('timetable.bulkProposeConfirm')))) return
    setBulkResults([])
    setSelectedPartialIds(new Set())
    setBulkPropose({ current: 0, total: classes.length, className: '', errors: [], warnings: [] })
    try {
      const academicYearId = classes[0]?.academicYearId
      if (!academicYearId) throw new Error(t('timetable.bulkProposeError'))
      const response = await fetchApi('/api/v2/timetables/propose-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId }),
      })
      const data = await lireReponseJson<{ data?: { runId: string; academicYearId?: string } }>(response)
      if (!response.ok || !data.data?.runId) throw new Error(t('timetable.bulkProposeError'))
      localStorage.setItem(GLOBAL_RUN_STORAGE_KEY, JSON.stringify({ runId: data.data.runId, academicYearId: data.data.academicYearId ?? academicYearId }))
      await pollGlobalRun(data.data.runId)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.bulkProposeError'), 'error')
    }
  }

  const openPreview = async (result: BulkResult) => {
    if (!result.proposal) return
    setPreviewResult(result)
    setPreviewAssignments([])
    setPreviewLoading(true)
    try {
      const response = await fetchApi(`/api/v2/teaching-assignments?classId=${result.classId}`, { credentials: 'include' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || t('timetable.bulkPreviewError'))
      setPreviewAssignments(data.data ?? [])
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.bulkPreviewError'), 'error')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleApplyAll = async () => {
    const applicable = bulkResults.filter(result => (result.status === 'success' || result.status === 'DEGRADE') && result.timetableId && result.proposal)
    if (applicable.length === 0) {
      onToast(t('timetable.bulkNoApplicable'), 'error')
      return
    }
    if (!(await confirmAction(t('timetable.bulkApplyConfirm', { count: applicable.length })))) return
    setApplyingAll(true)
    try {
      const response = await fetchApi('/api/v2/timetables/apply-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propositions: applicable.map(result => ({ timetableId: result.timetableId!, statut: result.status === 'DEGRADE' ? 'DEGRADE' : 'SUCCESS', seances: result.proposal!.seances, seancesGroupes: result.proposal!.seancesGroupes })) }),
      })
      const data = await lireReponseJson<{ message?: string }>(response)
      if (!response.ok) throw new Error(data.message || t('timetable.planning.applyError'))
      setBulkResults(bulkResults.map(result => applicable.includes(result) ? { ...result, status: 'applied' } : result))
      onToast(t('timetable.bulkApplyDone'), 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.planning.applyError'), 'error')
    } finally {
      setApplyingAll(false)
    }
  }

  const handleApplySelectedPartials = async () => {
    const selected = bulkResults.filter(result => result.status === 'PARTIEL' && selectedPartialIds.has(result.classId) && result.timetableId && result.proposal)
    if (selected.length === 0) {
      onToast(t('timetable.bulkPartialSelectionRequired'), 'error')
      return
    }
    if (!(await confirmAction(t('timetable.bulkApplyPartialConfirm', { count: selected.length })))) return
    setApplyingAll(true)
    try {
      const response = await fetchApi('/api/v2/timetables/apply-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propositions: selected.map(result => ({ timetableId: result.timetableId!, statut: 'PARTIEL', confirmationPartiel: true, seances: result.proposal!.seances, seancesGroupes: result.proposal!.seancesGroupes })) }),
      })
      const data = await lireReponseJson<{ message?: string }>(response)
      if (!response.ok) throw new Error(data.message || t('timetable.planning.applyError'))
      setBulkResults(bulkResults.map(result => selected.includes(result) ? { ...result, status: 'applied' } : result))
      setSelectedPartialIds(new Set())
      onToast(t('timetable.bulkApplyPartialDone'), 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('timetable.planning.applyError'), 'error')
    } finally {
      setApplyingAll(false)
    }
  }

  const clearBulkResults = () => {
    localStorage.removeItem(GLOBAL_RUN_STORAGE_KEY)
    setBulkResults([])
    setPreviewResult(null)
    setPreviewAssignments([])
    setSelectedPartialIds(new Set())
    setBulkPropose(null)
  }

  return {
    bulkPropose,
    bulkResults,
    previewResult,
    setPreviewResult,
    previewAssignments,
    setPreviewAssignments,
    previewLoading,
    selectedPartialIds,
    setSelectedPartialIds,
    applyingAll,
    handleProposeAll,
    openPreview,
    handleApplyAll,
    handleApplySelectedPartials,
    clearBulkResults,
  }
}
