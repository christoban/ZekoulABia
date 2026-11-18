'use client'

import { useCallback, useState, useEffect } from 'react'
import type { ChildWithStats } from '../../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useT } from '@/lib/i18n'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import type { CellSlots, GridConfigShape, RawSlot, TimetableData } from './types'
import { buildSlots, resolveGridConfig } from './timetableHelpers'

export function useParentTimetable(userId?: string) {
  const t = useT('parent')
  const [selectedChild, setSelectedChild] = useState(0)

  const currentDayIdx = () => {
    const d = new Date().getDay()
    return d >= 1 && d <= 5 ? d - 1 : 0
  }
  const [selectedDay, setSelectedDay] = useState(currentDayIdx)

  const cacheKey = userId ? `parent:timetable:v2:${userId}` : ''
  const fetchFn = useCallback(async (): Promise<TimetableData> => {
    let children: ChildWithStats[] = []
    let gridData: GridConfigShape | null = null

    try {
      const [childrenRes, gridRes] = await Promise.all([
        fetchApi('/api/v2/parent/children', { credentials: 'include' }).then((r) => r.json()),
        fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then((r) => r.json()).catch(() => ({ success: false })),
      ])

      if (childrenRes?.success && Array.isArray(childrenRes.data)) {
        children = childrenRes.data
      }
      if (gridRes?.success && gridRes.data) {
        gridData = gridRes.data
        putCachedData('parent:timetable-grid-config', gridData).catch(() => {})
      }
    } catch {
      // Erreur réseau : tentative de repli local
    }

    if (!children.length && userId) {
      const cachedKids = await getCachedData<ChildWithStats[]>(`parent:children:${userId}`)
      if (cachedKids?.data && cachedKids.data.length > 0) {
        children = cachedKids.data
      }
    }

    if (!children.length) {
      throw new Error(t('children.errorLoadChildren'))
    }

    if (!gridData) {
      const cachedGrid = await getCachedData<GridConfigShape>('parent:timetable-grid-config')
      gridData = cachedGrid?.data ?? null
    }

    const { squelette, joursActifs, squeletteParJour } = resolveGridConfig(gridData)
    const slotsByChild: Record<string, Record<string, CellSlots>> = {}
    const classNames: Record<string, string> = {}

    await Promise.all(
      children.map(async (child) => {
        if (!child.classeId) {
          slotsByChild[child.studentId] = {}
          classNames[child.studentId] = child.classeNom || '—'
          return
        }
        classNames[child.studentId] = child.classeNom || ''
        try {
          const ttRes = await fetchApi(`/api/v2/timetables?classId=${child.classeId}`, { credentials: 'include' }).then((r) => r.json())
          if (ttRes?.success && ttRes.data) {
            slotsByChild[child.studentId] = buildSlots(ttRes.data, child.groupIds ?? [], t('timetable.notAssignedToGroup'))
            putCachedData(`parent:timetables:class:${child.classeId}`, ttRes.data).catch(() => {})
          } else {
            throw new Error('API timetables failed')
          }
        } catch {
          const cachedTT = await getCachedData<Array<{ slots?: RawSlot[] }>>(`parent:timetables:class:${child.classeId}`)
          slotsByChild[child.studentId] = cachedTT?.data
            ? buildSlots(cachedTT.data, child.groupIds ?? [], t('timetable.notAssignedToGroup'))
            : {}
        }
      })
    )

    return { children, slotsByChild, classNames, squelette, joursActifs, squeletteParJour }
  }, [userId, t])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<TimetableData>(cacheKey, fetchFn)
  const [fallbackData, setFallbackData] = useState<TimetableData | null>(null)

  useEffect(() => {
    if (error === 'OFFLINE_NO_CACHE' && !data && userId) {
      getCachedData<ChildWithStats[]>(`parent:children:${userId}`)
        .then(async (cachedKids) => {
          const kids = cachedKids?.data || []
          if (kids.length === 0) return

          const cachedGrid = await getCachedData<GridConfigShape>('parent:timetable-grid-config')
          const gridData = cachedGrid?.data ?? null
          const { squelette, joursActifs, squeletteParJour } = resolveGridConfig(gridData)

          const slotsByChild: Record<string, Record<string, CellSlots>> = {}
          const classNames: Record<string, string> = {}

          for (const c of kids) {
            classNames[c.studentId] = c.classeNom || ''
            if (c.classeId) {
              const cachedTT = await getCachedData<Array<{ slots?: RawSlot[] }>>(`parent:timetables:class:${c.classeId}`)
              slotsByChild[c.studentId] = cachedTT?.data
                ? buildSlots(cachedTT.data, c.groupIds ?? [], t('timetable.notAssignedToGroup'))
                : {}
            } else {
              slotsByChild[c.studentId] = {}
            }
          }

          const resolved: TimetableData = { children: kids, slotsByChild, classNames, squelette, joursActifs, squeletteParJour }
          setFallbackData(resolved)
          if (cacheKey) putCachedData(cacheKey, resolved).catch(() => {})
        })
        .catch(() => {})
    }
  }, [error, data, userId, cacheKey, t])

  return {
    timetable: data ?? fallbackData,
    loading,
    error,
    fromCache,
    cachedAt,
    refetch,
    selectedChild,
    setSelectedChild,
    selectedDay,
    setSelectedDay,
  }
}
