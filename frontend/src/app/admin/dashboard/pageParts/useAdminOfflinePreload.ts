'use client'

import { useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { putCachedData } from '@/lib/offline/db'
import type { SessionUser } from './types'

export function useAdminOfflinePreload(sessionUser: SessionUser | null) {
  useEffect(() => {
    if (!sessionUser || typeof navigator === 'undefined' || !navigator.onLine) return

    let cancelled = false

    const preloadAdminData = async () => {
      try {
        fetchApi('/api/v2/dashboard/stats', { credentials: 'include' })
          .then(r => r.json())
          .then(d => {
            if (d?.stats) putCachedData('admin:dashboard-stats', d.stats).catch(() => {})
          })
          .catch(() => {})

        const [clsRes, yearsRes, gridRes, titlesRes] = await Promise.allSettled([
          fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
          fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
          fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
          fetchApi('/api/v2/school/staff-titles').then(r => r.json()),
        ])

        if (cancelled) return

        let classesList: Array<{ id: string; name: string }> = []
        if (clsRes.status === 'fulfilled') {
          const raw = clsRes.value
          const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
          if (list.length > 0) {
            classesList = list
            await putCachedData('admin:classes', list).catch(() => {})
            await putCachedData('staff:classes', list).catch(() => {})
          }
        }

        if (yearsRes.status === 'fulfilled') {
          const raw = yearsRes.value
          const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
          if (list.length > 0) {
            await putCachedData('admin:academic-years', list).catch(() => {})
            await putCachedData('staff:academic-years', list).catch(() => {})
          }
        }

        if (gridRes.status === 'fulfilled' && gridRes.value?.data) {
          await putCachedData('admin:timetable-grid-config', gridRes.value.data).catch(() => {})
          await putCachedData('staff:timetable-grid-config', gridRes.value.data).catch(() => {})
        }

        if (titlesRes.status === 'fulfilled' && titlesRes.value?.data) {
          await putCachedData('admin:staff-titles', titlesRes.value.data).catch(() => {})
        }

        fetchApi('/api/v2/users?limit=100', { credentials: 'include' })
          .then(r => r.json())
          .then(d => {
            if (d?.data && Array.isArray(d.data)) {
              putCachedData('admin:users:ALL', d.data).catch(() => {})
              if (d.roleCounts) {
                putCachedData('admin:users:role-counts', d.roleCounts).catch(() => {})
              }
            }
          })
          .catch(() => {})

        fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' })
          .then(r => r.json())
          .then(d => {
            if (d?.data && Array.isArray(d.data)) {
              putCachedData('admin:finance:fee-plans', d.data).catch(() => {})
            }
          })
          .catch(() => {})

        fetchApi('/api/v2/finance/invoices?status=PENDING&page=1&limit=20', { credentials: 'include' })
          .then(r => r.json())
          .then(d => {
            if (d?.data && Array.isArray(d.data)) {
              putCachedData('admin:finance:invoices:PENDING:1', {
                invoices: d.data,
                pagination: d.pagination ?? { total: d.data.length, page: 1, pages: 1 },
              }).catch(() => {})
            }
          })
          .catch(() => {})

        if (classesList.length > 0) {
          const targetClasses = classesList.slice(0, 25)
          for (const c of targetClasses) {
            if (cancelled) return
            fetchApi(`/api/v2/timetables?classId=${c.id}`, { credentials: 'include' })
              .then(r => r.json())
              .then(d => {
                const list = d?.data || []
                if (list[0]) {
                  putCachedData(`admin:timetables:${c.id}`, list[0]).catch(() => {})
                  putCachedData(`staff:timetables:${c.id}`, list[0]).catch(() => {})
                }
              })
              .catch(() => {})

            fetchApi(`/api/v2/subjects?classId=${c.id}`, { credentials: 'include' })
              .then(r => r.json())
              .then(d => {
                if (d?.data) putCachedData(`admin:subjects:class:${c.id}`, d.data).catch(() => {})
              })
              .catch(() => {})

            fetchApi(`/api/v2/report-cards?classId=${c.id}&limit=100`, { credentials: 'include' })
              .then(r => r.json())
              .then(rd => {
                const cards = rd?.reportCards ?? rd?.data ?? []
                if (Array.isArray(cards) && cards.length > 0) {
                  putCachedData(`admin:report-cards:${c.id}`, cards).catch(() => {})
                }
              })
              .catch(() => {})

            fetchApi(`/api/v2/report-cards/check/${c.id}`, { credentials: 'include' })
              .then(r => r.json())
              .then(cd => {
                if (cd) putCachedData(`admin:report-cards:check:${c.id}`, cd).catch(() => {})
              })
              .catch(() => {})
          }
        }

        fetchApi('/api/v2/academic-events', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:academic-events', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/subjects', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:subjects', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/departments', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:departments', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/users?role=TEACHER&limit=200', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data && Array.isArray(d.data)) putCachedData('admin:users:TEACHER', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/statistics/classes-comparison', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:stats-comparison:', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/statistics/students-distribution?criteria=gender', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:stats-distribution:gender', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/statistics/grades-evolution', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:stats-evolution::', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/hr/employees', { credentials: 'include' })
          .then(r => r.json())
          .then(d => {
            if (d?.data && Array.isArray(d.data)) {
              putCachedData('admin:hr:employees', d.data).catch(() => {})
              if (d.data[0]?.id) {
                fetchApi(`/api/v2/hr/employees/${d.data[0].id}`, { credentials: 'include' })
                  .then(dr => dr.json())
                  .then(dd => { if (dd?.data) putCachedData(`admin:hr:employee:${d.data[0].id}`, dd.data).catch(() => {}) })
                  .catch(() => {})
              }
            }
          })
          .catch(() => {})

        fetchApi('/api/v2/hr/leave-requests', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:hr:leave-requests', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/statistical-campaign/supplement', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:minesec:supplement', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/statistical-campaign/submissions', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:minesec:submissions', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/statistical-campaign/meta', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:minesec:meta', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/class-councils', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.sessions) putCachedData('admin:class-councils', { sessions: d.sessions }).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/eleve-onboarding', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:eleve-onboarding', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/ai/students-health', { credentials: 'include' })
          .then(r => r.json())
          .then(d => {
            if (d?.students) putCachedData('admin:ai-health:', { students: d.students, summary: d.summary ?? null }).catch(() => {})
          })
          .catch(() => {})

        fetchApi('/api/v2/pedagogie/programmes', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:pedagogie:programmes', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/pedagogie/alertes-retard', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:pedagogie:alertes', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/school/me', { credentials: 'include' })
          .then(r => r.json())
          .then(d => {
            if (d?.data) {
              putCachedData('admin:school:me', d.data).catch(() => {})
              const sid = d.data.id
              if (sid) {
                fetchApi(`/api/v2/schools/${sid}/notification-settings`, { credentials: 'include' })
                  .then(nr => nr.json())
                  .then(nd => { if (nd?.data) putCachedData('admin:notification-settings', nd.data).catch(() => {}) })
                  .catch(() => {})

                fetchApi(`/api/v2/schools/${sid}/security-settings`, { credentials: 'include' })
                  .then(sr => sr.json())
                  .then(sd => { if (sd?.data) putCachedData('admin:security-settings', sd.data).catch(() => {}) })
                  .catch(() => {})
              }
            }
          })
          .catch(() => {})

        fetchApi('/api/v2/school/last-backup', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:school:last-backup', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/school-settings', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:school-settings', d.data).catch(() => {}) })
          .catch(() => {})

        fetchApi('/api/v2/corbeille', { credentials: 'include' })
          .then(r => r.json())
          .then(d => { if (d?.data) putCachedData('admin:corbeille', d.data).catch(() => {}) })
          .catch(() => {})

        try {
          const rawU = typeof window !== 'undefined' ? localStorage.getItem('zekoulabia_user') : null
          const parsed = rawU ? JSON.parse(rawU) : null
          const uid = parsed?.userId || parsed?.id || ''
          fetchApi('/api/v2/messagerie/conversations')
            .then(r => r.json())
            .then(d => {
              if (d?.data && Array.isArray(d.data)) {
                if (uid) putCachedData(`messagerie:conversations:${uid}`, d.data).catch(() => {})
                putCachedData('messagerie:conversations', d.data).catch(() => {})

                for (const conv of d.data.slice(0, 5)) {
                  fetchApi(`/api/v2/messagerie/conversations/${conv.id}/messages`)
                    .then(mr => mr.json())
                    .then(md => {
                      if (md?.data && Array.isArray(md.data)) {
                        putCachedData(`messagerie:messages:${conv.id}`, md.data).catch(() => {})
                      }
                    })
                    .catch(() => {})
                }
              }
            })
            .catch(() => {})
        } catch { /* ignorer */ }
      } catch { /* ignorer */ }
    }

    preloadAdminData()
    return () => { cancelled = true }
  }, [sessionUser])
}
