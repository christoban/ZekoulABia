'use client'

import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import {
  isNetworkErr,
  type ActivityLog,
  type AIActionAuditEntry,
  type BackupInfo,
  type EmailLog,
  type SchoolInfo,
  type StructConfigShape,
  type TimelineEntry,
} from './types'

interface UseSettingsLogsAndStructureParams {
  activeTab: number
  schoolInfo?: SchoolInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function useSettingsLogsAndStructure({ activeTab, schoolInfo, onToast }: UseSettingsLogsAndStructureParams) {
  const t = useT('admin')

  // Activity logs (tab 5)
  const [actPage, setActPage] = useState(1)
  const [actSearchInput, setActSearchInput] = useState('')
  const [actSearch, setActSearch] = useState('')
  const [actData, setActData] = useState<{ logs: ActivityLog[]; page: number; pages: number; total: number } | null>(null)
  const [actLoading, setActLoading] = useState(false)

  // AI Security Audit (tab 5)
  const [aiAuditData, setAiAuditData] = useState<{ entries: AIActionAuditEntry[]; total: number } | null>(null)
  const [aiAuditLoading, setAiAuditLoading] = useState(false)
  const [aiAuditOutcome, setAiAuditOutcome] = useState<'' | 'SUCCES' | 'REFUSE' | 'ERREUR'>('')

  // Timeline (tab 5)
  const [timelineData, setTimelineData] = useState<TimelineEntry[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  // Email logs (tab 6)
  const [emlPage, setEmlPage] = useState(1)
  const [emlSearchInput, setEmlSearchInput] = useState('')
  const [emlSearch, setEmlSearch] = useState('')
  const [emlStatus, setEmlStatus] = useState('')
  const [emlData, setEmlData] = useState<{ logs: EmailLog[]; pagination: { total: number; page: number; pages: number; limit: number } } | null>(null)
  const [emlLoading, setEmlLoading] = useState(false)

  // Structure & Backup & RGPD (tab 7)
  const [structConfig, setStructConfig] = useState<StructConfigShape | null>(null)
  const [structEdit, setStructEdit] = useState<Record<string, number>>({})
  const [structSaving, setStructSaving] = useState(false)
  const [structResult, setStructResult] = useState<string[] | null>(null)
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [logRetentionDays, setLogRetentionDays] = useState<number>(90)
  const [logRetentionLoading, setLogRetentionLoading] = useState(false)
  const [logRetentionSaving, setLogRetentionSaving] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    if (activeTab !== 5) return
    const cacheKey = `admin:activities:${actPage}:${actSearch}`
    getCachedData<NonNullable<typeof actData>>(cacheKey).then(c => {
      if (c?.data) setActData(c.data)
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setActLoading(true)
    const params = new URLSearchParams({ page: String(actPage), limit: '10' })
    if (actSearch) params.set('search', actSearch)
    fetchApi(`/api/v2/activities?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const payload = { logs: d.logs ?? [], page: d.page ?? 1, pages: d.pages ?? 1, total: d.total ?? 0 }
        setActData(payload)
        putCachedData(cacheKey, payload).catch(() => {})
      })
      .catch((err) => { if (!isNetworkErr(err)) onToast('Erreur chargement activités', 'error') })
      .finally(() => setActLoading(false))
  }, [activeTab, actPage, actSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 5) return
    const cacheKey = `admin:ai-security-log:${aiAuditOutcome || 'ALL'}`
    getCachedData<NonNullable<typeof aiAuditData>>(cacheKey).then(c => {
      if (c?.data) setAiAuditData(c.data)
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setAiAuditLoading(true)
    const params = new URLSearchParams({ page: '1', limit: '20' })
    if (aiAuditOutcome) params.set('outcome', aiAuditOutcome)
    fetchApi(`/api/v2/security/audit-log?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const payload = { entries: d.data ?? [], total: d.pagination?.total ?? 0 }
        setAiAuditData(payload)
        putCachedData(cacheKey, payload).catch(() => {})
      })
      .catch((err) => { if (!isNetworkErr(err)) onToast('Erreur chargement du journal Sécurité IA', 'error') })
      .finally(() => setAiAuditLoading(false))
  }, [activeTab, aiAuditOutcome]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 5) return
    getCachedData<TimelineEntry[]>('admin:activities-timeline').then(c => {
      if (c?.data) setTimelineData(c.data)
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setTimelineLoading(true)
    fetchApi('/api/v2/activities/timeline?limit=20', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list = d.timeline ?? []
        setTimelineData(list)
        putCachedData('admin:activities-timeline', list).catch(() => {})
      })
      .catch((err) => { if (!isNetworkErr(err)) onToast('Erreur chargement frise unifiée', 'error') })
      .finally(() => setTimelineLoading(false))
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 6) return
    const cacheKey = `admin:email-logs:${emlPage}:${emlSearch}:${emlStatus}`
    getCachedData<NonNullable<typeof emlData>>(cacheKey).then(c => {
      if (c?.data) setEmlData(c.data)
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setEmlLoading(true)
    const params = new URLSearchParams({ page: String(emlPage), limit: '15' })
    if (emlSearch) params.set('search', emlSearch)
    if (emlStatus) params.set('status', emlStatus)
    fetchApi(`/api/v2/email-logs?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const payload = { logs: d.logs ?? [], pagination: d.pagination ?? { total: 0, page: 1, pages: 1, limit: 15 } }
        setEmlData(payload)
        putCachedData(cacheKey, payload).catch(() => {})
      })
      .catch((err) => { if (!isNetworkErr(err)) onToast('Erreur chargement emails', 'error') })
      .finally(() => setEmlLoading(false))
  }, [activeTab, emlPage, emlSearch, emlStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 7 || structConfig !== null || !schoolInfo?.id) return
    getCachedData<{ onboardingConfig?: StructConfigShape }>('admin:school:me').then(c => {
      const cfg = c?.data?.onboardingConfig
      if (cfg) {
        const parsed = {
          niveaux1erCycle: cfg.niveaux1erCycle ?? [],
          classesParNiveau: cfg.classesParNiveau ?? {},
          niveauxPrimaire: cfg.niveauxPrimaire ?? [],
          classesParNiveauPrimaire: cfg.classesParNiveauPrimaire ?? {},
        }
        setStructConfig(parsed)
        setStructEdit({ ...parsed.classesParNiveau, ...parsed.classesParNiveauPrimaire })
      }
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.data) putCachedData('admin:school:me', d.data).catch(() => {})
        const cfg = d.data?.onboardingConfig
        if (!cfg) return
        const parsed = {
          niveaux1erCycle: cfg.niveaux1erCycle ?? [],
          classesParNiveau: cfg.classesParNiveau ?? {},
          niveauxPrimaire: cfg.niveauxPrimaire ?? [],
          classesParNiveauPrimaire: cfg.classesParNiveauPrimaire ?? {},
        }
        setStructConfig(parsed)
        setStructEdit({ ...parsed.classesParNiveau, ...parsed.classesParNiveauPrimaire })
      })
      .catch((err) => { if (!isNetworkErr(err)) onToast('Erreur chargement structure', 'error') })
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 7 || backupInfo !== null || !schoolInfo?.id) return
    getCachedData<BackupInfo>('admin:school:last-backup').then(c => {
      if (c?.data) setBackupInfo(c.data)
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setBackupLoading(true)
    fetchApi('/api/v2/school/last-backup', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBackupInfo(d.data)
          putCachedData('admin:school:last-backup', d.data).catch(() => {})
        }
      })
      .catch((err) => { if (!isNetworkErr(err)) onToast('Erreur chargement dernière sauvegarde', 'error') })
      .finally(() => setBackupLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 7 || logRetentionLoading || !schoolInfo?.id) return
    getCachedData<{ logRetentionDays?: number }>('admin:school-settings').then(c => {
      if (c?.data?.logRetentionDays != null) setLogRetentionDays(Number(c.data.logRetentionDays))
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setLogRetentionLoading(true)
    fetchApi('/api/v2/school-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setLogRetentionDays(Number(d.data?.logRetentionDays ?? 90))
          putCachedData('admin:school-settings', d.data).catch(() => {})
        }
      })
      .catch((err) => { if (!isNetworkErr(err)) onToast('Erreur chargement rétention des logs', 'error') })
      .finally(() => setLogRetentionLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStructSave() {
    if (!schoolInfo?.id || !structConfig) return
    setStructSaving(true); setStructResult(null)
    try {
      const classesParNiveau: Record<string, number> = {}
      const classesParNiveauPrimaire: Record<string, number> = {}
      for (const n of structConfig.niveaux1erCycle) {
        const v = structEdit[n]
        if (v !== undefined) classesParNiveau[n] = Math.max(1, Math.min(26, v))
      }
      for (const n of structConfig.niveauxPrimaire) {
        const v = structEdit[n]
        if (v !== undefined) classesParNiveauPrimaire[n] = Math.max(1, Math.min(26, v))
      }
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/structure`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classesParNiveau, classesParNiveauPrimaire }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message ?? t('common.error'))
      setStructResult(d.data?.classesCreated ?? [])
      setStructConfig(null)
      onToast(d.message, 'success')
    } catch (e) { onToast(String(e), 'error') }
    finally { setStructSaving(false) }
  }

  async function handleLogRetentionSave() {
    if (!schoolInfo?.id) return
    setLogRetentionSaving(true)
    try {
      const res = await fetchApi('/api/v2/school-settings', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logRetentionDays }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || t('common.error'))
      onToast(t('settings.structure.toast_retention_saved'), 'success')
    } catch (e) { onToast(String(e), 'error') }
    finally { setLogRetentionSaving(false) }
  }

  async function handleRgpdExport() {
    if (!schoolInfo?.id) return
    setExportLoading(true)
    try {
      const res = await fetchApi('/api/v2/school/export', { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || t('settings.structure.export_error'))
      }
      const blob = await res.blob()
      const contentDisposition = res.headers.get('content-disposition') || ''
      const match = contentDisposition.match(/filename="?([^";]+)"?/i)
      const fileName = match?.[1] ?? 'zekoulabia-rgpd.json'
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      onToast(t('settings.structure.toast_exported'), 'success')
    } catch (e) { onToast(String(e), 'error') }
    finally { setExportLoading(false) }
  }

  return {
    actPage, setActPage, actSearchInput, setActSearchInput, actSearch, setActSearch, actData, actLoading,
    aiAuditData, aiAuditLoading, aiAuditOutcome, setAiAuditOutcome,
    timelineData, timelineLoading,
    emlPage, setEmlPage, emlSearchInput, setEmlSearchInput, emlSearch, setEmlSearch, emlStatus, setEmlStatus, emlData, emlLoading,
    structConfig, structEdit, setStructEdit, structSaving, structResult, handleStructSave,
    backupInfo, backupLoading,
    logRetentionDays, setLogRetentionDays, logRetentionLoading, logRetentionSaving, exportLoading,
    handleLogRetentionSave, handleRgpdExport,
  }
}
