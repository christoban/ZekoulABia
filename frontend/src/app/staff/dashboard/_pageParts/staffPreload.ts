import { fetchApi } from '@/lib/fetchApi'
import { putCachedData } from '@/lib/offline/db'
import { mapDirectoryStudents } from '../_components/elevesFamilles/elevesFamillesUtils'

export async function preloadStaffData(
  userId: string | undefined,
  isCancelled: () => boolean,
): Promise<void> {
  try {
    // 1. Classes & Années scolaires
    const [clsRes, yearsRes, gridRes, lv2Res] = await Promise.allSettled([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-configs/current', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/teaching-assignments/subjects-lv2', { credentials: 'include' }).then(r => r.json()),
    ])

    if (isCancelled()) return

    let classesList: Array<{ id: string; name: string }> = []
    if (clsRes.status === 'fulfilled') {
      const raw = clsRes.value
      const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
      if (list.length > 0) {
        classesList = list
        await putCachedData('staff:classes', list).catch(() => {})
        await putCachedData('staff:classes:list', list).catch(() => {})
      }
    }

    if (yearsRes.status === 'fulfilled') {
      const raw = yearsRes.value
      const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
      if (list.length > 0) {
        await putCachedData('staff:academic-years', list).catch(() => {})
      }
    }

    if (gridRes.status === 'fulfilled' && gridRes.value?.data) {
      await putCachedData('staff:timetable-grid-config', gridRes.value.data).catch(() => {})
    }

    if (lv2Res.status === 'fulfilled' && lv2Res.value?.data) {
      await putCachedData('staff:subjects-lv2', lv2Res.value.data).catch(() => {})
    }

    // 2. Pour les classes disponibles, précharger les emplois du temps, affectations et annuaire
    if (classesList.length > 0) {
      const targetClasses = classesList.slice(0, 10)
      for (const c of targetClasses) {
        if (isCancelled()) return
        try {
          fetchApi(`/api/v2/timetables/class/${c.id}`, { credentials: 'include' })
            .then(r => r.json())
            .then(d => {
              if (d && (d.data || d.slots)) {
                putCachedData(`staff:timetables:${c.id}`, d.data || d.slots || d).catch(() => {})
              }
            })
            .catch(() => {})

          fetchApi(`/api/v2/teaching-assignments/class/${c.id}`, { credentials: 'include' })
            .then(r => r.json())
            .then(d => {
              if (d && (d.data || Array.isArray(d))) {
                putCachedData(`staff:teaching-assignments:${c.id}`, d.data || d).catch(() => {})
              }
            })
            .catch(() => {})

          fetchApi(`/api/v2/classes/${c.id}/students-directory`, { credentials: 'include' })
            .then(r => r.json())
            .then(d => {
              const rawList = Array.isArray(d?.data) ? d.data : []
              if (rawList.length > 0) {
                const mapped = mapDirectoryStudents(rawList, c.name)
                putCachedData(`staff:students-directory:${c.id}`, mapped).catch(() => {})
              }
            })
            .catch(() => {})
        } catch { /* ignore */ }
      }
    }

    // 3. Stats présences
    fetchApi('/api/v2/attendance/stats', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.data?.stats || d?.stats) {
          putCachedData('staff:attendance:stats', d.data?.stats || d.stats).catch(() => {})
        }
      })
      .catch(() => {})

    // 4. Validation des bulletins
    Promise.allSettled([
      fetchApi('/api/v2/bulletin-validations?status=SUBMITTED', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/bulletin-validations?status=VALIDATED', { credentials: 'include' }),
    ]).then(async ([subSettled, valSettled]) => {
      const subList = subSettled.status === 'fulfilled' && subSettled.value?.data ? subSettled.value.data : []
      let valList: unknown[] = []
      if (valSettled.status === 'fulfilled') {
        const vData = await valSettled.value.json().catch(() => null)
        valList = vData?.data || []
      }
      if (subList.length > 0 || valList.length > 0) {
        putCachedData('staff:bulletin-validations', { submitted: subList, validated: valList }).catch(() => {})
      }
    }).catch(() => {})

    // 5. Conseils de classe
    fetchApi('/api/v2/class-councils', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.sessions && Array.isArray(d.sessions)) {
          putCachedData('staff:class-councils', d.sessions).catch(() => {})
        }
      })
      .catch(() => {})

    // 6. Discipline
    fetchApi('/api/v2/discipline?limit=50&status=ACTIVE', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.data && Array.isArray(d.data)) {
          putCachedData('staff:discipline:ALL:ACTIVE', d.data).catch(() => {})
        }
      })
      .catch(() => {})

    fetchApi('/api/v2/discipline-council', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.data && Array.isArray(d.data)) {
          putCachedData('staff:discipline:council-sessions', d.data).catch(() => {})
        }
      })
      .catch(() => {})

    // 7. Finance
    fetchApi('/api/v2/finance/invoices?status=PENDING&page=1&limit=20', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.data && Array.isArray(d.data)) {
          putCachedData('staff:finance:invoices:PENDING:1', {
            invoices: d.data,
            pagination: d.pagination ?? { total: d.data.length, page: 1, pages: 1 },
          }).catch(() => {})
        }
      })
      .catch(() => {})

    // 8. Messagerie
    fetchApi('/api/v2/messagerie/conversations', { credentials: 'include' })
      .then(r => r.json())
      .then(async d => {
        if (d?.success && Array.isArray(d.data)) {
          if (userId) await putCachedData(`messagerie:conversations:${userId}`, d.data).catch(() => {})
          await putCachedData('messagerie:conversations', d.data).catch(() => {})
          for (const c of d.data.slice(0, 5)) {
            if (c?.id) {
              fetchApi(`/api/v2/messagerie/conversations/${c.id}/messages`, { credentials: 'include' })
                .then(r => r.json())
                .then(m => {
                  if (m?.success && Array.isArray(m.data)) {
                    putCachedData(`messagerie:messages:${c.id}`, m.data).catch(() => {})
                  }
                })
                .catch(() => {})
            }
          }
        }
      })
      .catch(() => {})

    // 9. Babillard officiel & compteurs
    fetchApi('/api/v2/babillard?tab=tous', { credentials: 'include' })
      .then(r => r.json())
      .then(async babRes => {
        const babItems = babRes?.data || babRes?.publications || []
        if (Array.isArray(babItems)) {
          await putCachedData('babillard:publications:all', babItems).catch(() => {})
          if (babRes?.counts) {
            const countsObj = {
              all: babRes.counts.tous ?? 0,
              pinned: babRes.counts.une ?? 0,
              for_me: babRes.counts.pourMoi ?? 0,
              unread: babRes.counts.nonLus ?? 0,
              archives: babRes.counts.archives ?? 0,
            }
            await putCachedData('babillard:counts', countsObj).catch(() => {})
          }
        }
      })
      .catch(() => {})
  } catch { /* ignorer */ }
}
