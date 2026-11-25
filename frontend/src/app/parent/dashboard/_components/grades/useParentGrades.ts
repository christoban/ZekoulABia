'use client'

import { useCallback, useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useT } from '@/lib/i18n'
import { getUserSession, getCachedData, putCachedData } from '@/lib/offline/db'
import type { BulletinData } from '@/components/bulletin/BulletinModalLight'
import type { ContinuousGradeItem, GradesData, SequenceItem } from './types'

interface UseParentGradesParams {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

export function useParentGrades({ onToast, userId }: UseParentGradesParams) {
  const t = useT('parent')
  const isOnline = useOnlineStatus()
  const [selectedChildIndex, setSelectedChildIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'continuous' | 'bulletins'>('continuous')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [selectedBulletin, setSelectedBulletin] = useState<BulletinData | null>(null)
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)
  const [sequences, setSequences] = useState<SequenceItem[]>([])
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('')

  useEffect(() => {
    if (userId) {
      getUserSession(userId)
        .then((s) => {
          if (s?.schoolInfo) setSchoolInfo(s.schoolInfo)
        })
        .catch(() => {})
    }
  }, [userId])

  const cacheKey = userId ? `parent:grades:${userId}` : ''
  const fetchFn = useCallback(async (): Promise<GradesData> => {
    const childrenRes = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then((r) => r.json())
    if (!childrenRes.success) throw new Error(t('errorLoad'))
    const rcRes = await fetchApi('/api/v2/report-cards', { credentials: 'include' }).then((r) => r.json())
    return { children: childrenRes.data ?? [], bulletins: rcRes.reportCards ?? [] }
  }, [userId, t])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<GradesData>(cacheKey, fetchFn)

  const children = data?.children ?? []
  const bulletins = data?.bulletins ?? []
  const selectedChild = children[selectedChildIndex] ?? null
  const selectedStudentId = selectedChild?.studentId
  const selectedName = selectedChild ? `${selectedChild.prenom} ${selectedChild.nom}` : ''
  const filteredBulletins = bulletins.filter((b) => b.student?.id === selectedStudentId)

  // Charger les séquences académiques (avec repli Dexie hors-connexion)
  useEffect(() => {
    let mounted = true

    interface AyYear {
      isCurrent?: boolean
      periods?: Array<{ sequences?: SequenceItem[] }>
    }

    const parseAcademicYears = (years: AyYear[]) => {
      if (!years?.length) return
      const curYear = years.find((y) => y.isCurrent) ?? years[0]
      if (!curYear?.periods) return

      const allSeqs: SequenceItem[] = []
      for (const period of curYear.periods) {
        for (const s of period.sequences ?? []) {
          allSeqs.push({ id: s.id, name: s.name, isCurrent: Boolean(s.isCurrent) })
        }
      }
      setSequences(allSeqs)
      if (allSeqs.length > 0) {
        setSelectedSequenceId((prev) => {
          if (prev && allSeqs.some((s) => s.id === prev)) return prev
          const active = allSeqs.find((s) => s.isCurrent) ?? allSeqs[allSeqs.length - 1]
          return active?.id || ''
        })
      }
    }

    if (navigator.onLine) {
      fetchApi('/api/v2/academic-years', { credentials: 'include' })
        .then((r) => r.json())
        .then(async (ayRes) => {
          if (!mounted || !ayRes.success || !ayRes.data?.length) return
          await putCachedData('parent:academic-years', ayRes.data)
          parseAcademicYears(ayRes.data)
        })
        .catch(async () => {
          const cached = await getCachedData<AyYear[]>('parent:academic-years')
          if (mounted && cached?.data) parseAcademicYears(cached.data)
        })
    } else {
      getCachedData<AyYear[]>('parent:academic-years')
        .then((cached) => {
          if (mounted && cached?.data) parseAcademicYears(cached.data)
        })
        .catch(() => {})
    }

    return () => {
      mounted = false
    }
  }, [])

  const cacheKeySeqGrades =
    selectedStudentId && selectedSequenceId ? `parent:grades:seq:${selectedStudentId}:${selectedSequenceId}` : ''

  const fetchSeqGradesFn = useCallback(async (): Promise<{ grades: ContinuousGradeItem[]; avg: number | null }> => {
    if (!selectedStudentId || !selectedSequenceId) return { grades: [], avg: null }
    const classId = selectedChild?.classeId
    const [gradesRes, avgRes] = await Promise.all([
      fetchApi(`/api/v2/grades?studentId=${selectedStudentId}&sequenceId=${selectedSequenceId}`, {
        credentials: 'include',
      })
        .then((r) => r.json())
        .catch(() => ({})),
      classId
        ? fetchApi(`/api/v2/grades/average/${selectedStudentId}?classId=${classId}&sequenceId=${selectedSequenceId}`, {
            credentials: 'include',
          })
            .then((r) => r.json())
            .catch(() => null)
        : Promise.resolve(null),
    ])
    return {
      grades: gradesRes.items ?? gradesRes.grades ?? [],
      avg: avgRes?.average ?? null,
    }
  }, [selectedStudentId, selectedSequenceId, selectedChild?.classeId])

  const { data: seqData, loading: seqLoading } = useCachedFetch<{ grades: ContinuousGradeItem[]; avg: number | null }>(
    cacheKeySeqGrades,
    fetchSeqGradesFn
  )

  const downloadPdf = async (id: string, label: string) => {
    if (!isOnline) {
      onToast(t('grades.downloadUnavailable'), 'warning')
      return
    }
    setDownloading(id)
    try {
      const res = await fetchApi(`/api/v2/report-cards/${id}/pdf`, { credentials: 'include' })
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { code?: string; message?: string } | null
        if (res.status === 403 && errBody?.code === 'BULLETIN_BLOCKED_UNPAID_FEES') {
          onToast(errBody.message || t('grades.downloadBlockedUnpaid'), 'error')
          return
        }
        onToast(t('grades.downloadError'), 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${t('grades.downloaded').replace(/\s/g, '_')}_${label.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onToast(t('grades.downloaded'), 'success')
    } catch {
      onToast(t('grades.downloadError'), 'error')
    } finally {
      setDownloading(null)
    }
  }

  return {
    isOnline,
    selectedChildIndex,
    setSelectedChildIndex,
    activeTab,
    setActiveTab,
    downloading,
    selectedBulletin,
    setSelectedBulletin,
    schoolInfo,
    sequences,
    selectedSequenceId,
    setSelectedSequenceId,
    loading,
    error,
    fromCache,
    cachedAt,
    refetch,
    children,
    selectedName,
    filteredBulletins,
    continuousGrades: seqData?.grades ?? [],
    continuousAverage: seqData?.avg ?? null,
    seqLoading,
    downloadPdf,
  }
}
