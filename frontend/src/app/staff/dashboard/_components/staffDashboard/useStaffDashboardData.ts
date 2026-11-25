'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import type { StaffSection } from '../../_types'
import type { AdmissionsSummary, CenseurSummary, KpiData } from './staffDashboardTypes'

interface Params {
  allowedSections: Set<StaffSection>
  isSecretary: boolean
  isCenseur: boolean
}

const DEFAULT_KPI: KpiData = { openCouncils: 0, pendingInvoices: 0, attendanceRate: null, overdueBooks: 0 }

const DEFAULT_CENSEUR: CenseurSummary = {
  activeClassesCount: 0,
  classesWithoutPPCount: 0,
  unassignedSubjectsCount: 0,
  openCouncilsCount: 0,
  activeAnonymatSessionsCount: 0,
  studentsAtRiskCount: 0,
  gridConfigured: true,
}

const DEFAULT_ADMISSIONS: AdmissionsSummary = {
  activeEvent: null,
  aCompleter: 0,
  admisAFinaliser: 0,
  brouillons: 0,
  chezLaFamille: 0,
  enAttenteDirection: 0,
}

export function useStaffDashboardData({ allowedSections, isSecretary, isCenseur }: Params) {
  const fetchKpis = useCallback(async (): Promise<KpiData> => {
    const can = (s: StaffSection) => allowedSections.has(s)
    const results = await Promise.allSettled([
      can('council')    ? fetchApi('/api/v2/class-councils', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('finance')    ? fetchApi('/api/v2/finance/invoices?status=PENDING&limit=1', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('attendance') ? fetchApi('/api/v2/attendance/stats', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('library')    ? fetchApi('/api/v2/library/loans?status=OVERDUE&limit=1', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
    ])

    const [councilRes, financeRes, attendanceRes, libraryRes] = results

    return {
      openCouncils:    councilRes.status === 'fulfilled'    && councilRes.value?.sessions   != null ? councilRes.value.sessions.filter((s: Record<string, unknown>) => s.status !== 'LOCKED').length : 0,
      pendingInvoices: financeRes.status === 'fulfilled'    && financeRes.value?.pagination != null ? financeRes.value.pagination.total : 0,
      attendanceRate:  attendanceRes.status === 'fulfilled' && attendanceRes.value?.stats   != null ? attendanceRes.value.stats.attendanceRate : null,
      overdueBooks:    libraryRes.status === 'fulfilled'    && libraryRes.value?.pagination != null ? libraryRes.value.pagination.total : 0,
    }
  }, [allowedSections])

  const { data, loading, fromCache, cachedAt, refetch } = useCachedFetch<KpiData>('staff-dashboard-kpis', fetchKpis)
  const kpi: KpiData = data ?? DEFAULT_KPI

  const fetchCenseurSummary = useCallback(async (): Promise<CenseurSummary> => {
    const results = await Promise.allSettled([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/teaching-assignments/issues', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/class-councils', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/assessments/sessions', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/ai/students-health', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
    ])

    const [classesRes, issuesRes, councilRes, assessRes, healthRes, gridRes] = results

    let activeClassesCount = 0
    let classesWithoutPPCount = 0
    if (classesRes.status === 'fulfilled' && classesRes.value) {
      const clsList = Array.isArray(classesRes.value.data) ? classesRes.value.data : Array.isArray(classesRes.value) ? classesRes.value : []
      activeClassesCount = clsList.length
      classesWithoutPPCount = clsList.filter((c: Record<string, unknown>) => !c.mainTeacher).length
    }

    let unassignedSubjectsCount = 0
    if (issuesRes.status === 'fulfilled' && issuesRes.value?.data && Array.isArray(issuesRes.value.data)) {
      unassignedSubjectsCount = issuesRes.value.data.filter((i: Record<string, unknown>) => i.status !== 'RESOLVED').length
    }

    let openCouncilsCount = 0
    if (councilRes.status === 'fulfilled' && Array.isArray(councilRes.value?.sessions)) {
      openCouncilsCount = councilRes.value.sessions.filter((s: Record<string, unknown>) => s.status !== 'LOCKED').length
    }

    let activeAnonymatSessionsCount = 0
    if (assessRes.status === 'fulfilled' && Array.isArray(assessRes.value?.data)) {
      activeAnonymatSessionsCount = assessRes.value.data.filter((s: Record<string, unknown>) => s.isAnonymized || (s.anonymatStatus && s.anonymatStatus !== 'NONE')).length
    }

    let studentsAtRiskCount = 0
    if (healthRes.status === 'fulfilled' && healthRes.value?.summary) {
      studentsAtRiskCount = (Number(healthRes.value.summary.critical) || 0) + (Number(healthRes.value.summary.warning) || 0)
    }

    const gridConfigured = gridRes.status === 'fulfilled' && gridRes.value?.success && !!gridRes.value?.data?.config

    return {
      activeClassesCount,
      classesWithoutPPCount,
      unassignedSubjectsCount,
      openCouncilsCount,
      activeAnonymatSessionsCount,
      studentsAtRiskCount,
      gridConfigured,
    }
  }, [])

  const { data: censeurData } = useCachedFetch<CenseurSummary>(
    isCenseur ? 'staff:censeur-summary' : '',
    fetchCenseurSummary
  )
  const censeur: CenseurSummary = censeurData ?? DEFAULT_CENSEUR

  const [admissions, setAdmissions] = useState<AdmissionsSummary>(DEFAULT_ADMISSIONS)

  useEffect(() => {
    if (!isSecretary) return
    let mounted = true

    fetchApi('/api/v2/academic-events/active', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!mounted) return
        const events = Array.isArray(d?.data) ? d.data : []
        const examEvent = events.find((e: Record<string, unknown>) => e.type === 'CONCOURS_ENTREE' || String(e.name ?? '').toLowerCase().includes('concours'))
        if (examEvent) {
          setAdmissions(prev => ({
            ...prev,
            activeEvent: {
              title: String(examEvent.name ?? 'Session de concours'),
              phase: String(examEvent.currentPhase ?? 'INSCRIPTION'),
              candidatsCount: Number(examEvent.candidatsCount || 0),
              placesCount: Number(examEvent.placesCount || 0),
            },
          }))
        }
      })
      .catch(() => {})

    fetchApi('/api/v2/eleve-onboarding', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!mounted) return
        const dossiers = Array.isArray(d?.data) ? d.data : []
        let returned = 0
        let draft = 0
        let family = 0
        let pending = 0

        for (const item of dossiers) {
          if (item.status === 'RETURNED') returned++
          else if (item.status === 'DRAFT') draft++
          else if (item.status === 'LINK_SENT') family++
          else if (item.status === 'SUBMITTED') pending++
        }

        setAdmissions(prev => ({
          ...prev,
          aCompleter: returned,
          brouillons: draft,
          chezLaFamille: family,
          enAttenteDirection: pending,
        }))
      })
      .catch(() => {})

    return () => { mounted = false }
  }, [isSecretary])

  return { kpi, loading, fromCache, cachedAt, refetch, censeur, admissions }
}
