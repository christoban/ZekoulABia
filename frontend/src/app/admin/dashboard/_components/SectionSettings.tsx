'use client'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { Smartphone, Mail, School, Search, Save, CheckCircle2, Info, ClipboardList } from 'lucide-react'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import MfaSettings from '@/components/MfaSettings'

interface SchoolInfo { id?: string; name: string; logoUrl: string | null; subdomain?: string; city?: string; phone?: string; email?: string; minesecSchoolCode?: string | null }
interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  schoolInfo?: SchoolInfo | null
  onLogoUpdate?: (url: string) => void
}
interface ActivityLog { id: string; createdAt: string; action: string; description: string; user?: { firstName?: string; lastName?: string } | null }
interface EmailLog { id: string; createdAt: string; to: string; subject: string; status: string }
interface AuditLog  { id: string; createdAt: string; action: string; description: string | null; user: { id: string; firstName: string; lastName: string } | null }
interface AIActionAuditEntry {
  id: string; timestamp: string; actorUserId: string; actorRole: string
  actionName: string; origin: 'UI_DIRECT' | 'AI_ASSISTANT'; outcome: 'SUCCES' | 'REFUSE' | 'ERREUR'
  refusalReason: string | null
}
interface BackupInfo { lastBackupAt: string | null; lastBackupFile: string | null; latestFileExists?: boolean }
interface NotifSettings { smsAbsences: boolean; smsPayments: boolean; smsBulletins: boolean; emailDigestAdmin: boolean; smsLowBalance: boolean }
interface SecSettings   { passwordMinLength: number; passwordRequireUpper: boolean; passwordRequireDigit: boolean; sessionTimeoutMin: number }

export default function SectionSettings({ onToast, schoolInfo, onLogoUpdate }: Props) {
  const t = useT('admin')
  const [activeTab, setActiveTab] = useState(0)

  const TABS = [
    t('settings.tabs.0'), t('settings.tabs.1'), t('settings.tabs.2'),
    t('settings.tabs.3'), t('settings.tabs.4'), t('settings.tabs.5'),
    t('settings.tabs.6'), t('settings.tabs.7'),
  ]

  const NOTIF_ROWS: Array<{ key: keyof NotifSettings; icon: React.ReactNode; label: string; sub: string }> = [
    { key: 'smsAbsences',      icon: <Smartphone size={16} strokeWidth={2} />, label: t('settings.notifications.rows.0.label'), sub: t('settings.notifications.rows.0.sub') },
    { key: 'smsPayments',      icon: <Smartphone size={16} strokeWidth={2} />, label: t('settings.notifications.rows.1.label'), sub: t('settings.notifications.rows.1.sub') },
    { key: 'smsBulletins',     icon: <Smartphone size={16} strokeWidth={2} />, label: t('settings.notifications.rows.2.label'), sub: t('settings.notifications.rows.2.sub') },
    { key: 'emailDigestAdmin', icon: <Mail size={16} strokeWidth={2} />, label: t('settings.notifications.rows.3.label'), sub: t('settings.notifications.rows.3.sub') },
    { key: 'smsLowBalance',    icon: <Smartphone size={16} strokeWidth={2} />, label: t('settings.notifications.rows.4.label'), sub: t('settings.notifications.rows.4.sub') },
  ]

  const SESSION_OPTIONS = [
    { value: 15, label: t('settings.security.session_options.0.label') },
    { value: 30, label: t('settings.security.session_options.1.label') },
    { value: 60, label: t('settings.security.session_options.2.label') },
    { value: 120, label: t('settings.security.session_options.3.label') },
    { value: 240, label: t('settings.security.session_options.4.label') },
    { value: 480, label: t('settings.security.session_options.5.label') },
  ]

  // ── Profil ──────────────────────────────────────────────────────────────
  const [schoolName, setSchoolName] = useState('')
  const [schoolCity, setSchoolCity] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [minesecSchoolCode, setMinesecSchoolCode] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // ── Sous-domaine ────────────────────────────────────────────────────────
  const [subdomainInput, setSubdomainInput]   = useState('')
  const [subdomainAvail, setSubdomainAvail]   = useState<'checking' | 'available' | 'taken' | null>(null)
  const [subdomainSaving, setSubdomainSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Notifications ───────────────────────────────────────────────────────
  const [notifData, setNotifData]     = useState<NotifSettings | null>(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSaving, setNotifSaving] = useState<keyof NotifSettings | null>(null)

  // ── Sécurité ────────────────────────────────────────────────────────────
  const [secSettings, setSecSettings] = useState<SecSettings | null>(null)
  const [secLoading, setSecLoading]   = useState(false)
  const [secModal, setSecModal]       = useState(false)
  const [secEdit, setSecEdit]         = useState<SecSettings>({ passwordMinLength: 8, passwordRequireUpper: false, passwordRequireDigit: true, sessionTimeoutMin: 60 })
  const [secSaving, setSecSaving]     = useState(false)

  // ── Audit logs ──────────────────────────────────────────────────────────
  const [auditOpen, setAuditOpen]   = useState(false)
  const [auditLogs, setAuditLogs]   = useState<AuditLog[]>([])
  const [auditPage, setAuditPage]   = useState(1)
  const [auditPages, setAuditPages] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditLoad, setAuditLoad]   = useState(false)
  const [auditAction, setAuditAction]   = useState('')
  const [auditActInput, setAuditActInput] = useState('')
  const [auditFrom, setAuditFrom]   = useState('')
  const [auditTo, setAuditTo]       = useState('')

  // ── Pédagogie ───────────────────────────────────────────────────────────
  const [pedSettings, setPedSettings] = useState<{
    passMark: number; councilPassMark: number; gradesPerTerm: number; termsPerYear: number
    maxAbsences: number; attendanceLateAsAbsence: boolean
    legalMaxContributionFirstCycle: number; legalMaxContributionSecondCycle: number
    bulletinBlockOnUnpaidFees: boolean
    schoolLanguageMode: string; academicCalendarType: string; cycles: string[]
    smsEnabled: boolean; offlineModeEnabled: boolean; aiAlertsEnabled: boolean; messageModeration: boolean
  } | null>(null)
  const [pedLoading, setPedLoading] = useState(false)
  const [pedSaving, setPedSaving]   = useState(false)

  // ── Activity logs ────────────────────────────────────────────────────────
  const [actPage, setActPage]               = useState(1)
  const [actSearchInput, setActSearchInput] = useState('')
  const [actSearch, setActSearch]           = useState('')
  const [actData, setActData]               = useState<{ logs: ActivityLog[]; page: number; pages: number; total: number } | null>(null)
  const [actLoading, setActLoading]         = useState(false)

  // ── Journal Sécurité IA ─────────────────────────────────────────────────
  const [aiAuditData, setAiAuditData]       = useState<{ entries: AIActionAuditEntry[]; total: number } | null>(null)
  const [aiAuditLoading, setAiAuditLoading] = useState(false)
  const [aiAuditOutcome, setAiAuditOutcome] = useState<'' | 'SUCCES' | 'REFUSE' | 'ERREUR'>('')

  // ── Frise chronologique unifiée (V3.6) ─────────────────────────────────────
  const [timelineData, setTimelineData] = useState<{ id: string; type: string; timestamp: string; title: string; details: string | null }[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  // ── Structure ────────────────────────────────────────────────────────────
  const [structConfig, setStructConfig] = useState<{
    niveaux1erCycle: string[]; classesParNiveau: Record<string, number>
    niveauxPrimaire: string[]; classesParNiveauPrimaire: Record<string, number>
  } | null>(null)
  const [structEdit, setStructEdit]   = useState<Record<string, number>>({})
  const [structSaving, setStructSaving] = useState(false)
  const [structResult, setStructResult] = useState<string[] | null>(null)
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [logRetentionDays, setLogRetentionDays] = useState<number>(90)
  const [logRetentionLoading, setLogRetentionLoading] = useState(false)
  const [logRetentionSaving, setLogRetentionSaving] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // ── Email logs ────────────────────────────────────────────────────────────
  const [emlPage, setEmlPage]               = useState(1)
  const [emlSearchInput, setEmlSearchInput] = useState('')
  const [emlSearch, setEmlSearch]           = useState('')
  const [emlStatus, setEmlStatus]           = useState('')
  const [emlData, setEmlData]               = useState<{ logs: EmailLog[]; pagination: { total: number; page: number; pages: number; limit: number } } | null>(null)
  const [emlLoading, setEmlLoading]         = useState(false)

  // ── Structure load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 7 || structConfig !== null || !schoolInfo?.id) return
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
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
      .catch(() => onToast('Erreur chargement structure', 'error'))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 7 || backupInfo !== null || !schoolInfo?.id) return
    setBackupLoading(true)
    fetchApi('/api/v2/school/last-backup', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setBackupInfo(d.data) })
      .catch(() => onToast('Erreur chargement dernière sauvegarde', 'error'))
      .finally(() => setBackupLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 7 || logRetentionLoading || !schoolInfo?.id) return
    setLogRetentionLoading(true)
    fetchApi('/api/v2/school-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setLogRetentionDays(Number(d.data?.logRetentionDays ?? 90))
        }
      })
      .catch(() => onToast('Erreur chargement rétention des logs', 'error'))
      .finally(() => setLogRetentionLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStructSave = async () => {
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
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classesParNiveau, classesParNiveauPrimaire }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message ?? t('common.error'))
      setStructResult(d.data?.classesCreated ?? [])
      setStructConfig(null) // forcer rechargement
      onToast(d.message, 'success')
    } catch (e) {
      onToast(String(e), 'error')
    } finally {
      setStructSaving(false)
    }
  }

  const handleLogRetentionSave = async () => {
    if (!schoolInfo?.id) return
    setLogRetentionSaving(true)
    try {
      const res = await fetchApi('/api/v2/school-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logRetentionDays }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || t('common.error'))
      onToast(t('settings.structure.toast_retention_saved'), 'success')
    } catch (e) {
      onToast(String(e), 'error')
    } finally {
      setLogRetentionSaving(false)
    }
  }

  const handleRgpdExport = async () => {
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
    } catch (e) {
      onToast(String(e), 'error')
    } finally {
      setExportLoading(false)
    }
  }

  // ── Init profil from schoolInfo ─────────────────────────────────────────
  useEffect(() => {
    if (!schoolInfo) return
    setSchoolName(schoolInfo.name || '')
    setSchoolCity(schoolInfo.city || '')
    setSchoolPhone(schoolInfo.phone || '')
    setSchoolEmail(schoolInfo.email || '')
    setMinesecSchoolCode(schoolInfo.minesecSchoolCode || '')
    setLogoPreview(schoolInfo.logoUrl || null)
    setSubdomainInput(schoolInfo.subdomain || '')
  }, [schoolInfo])

  // ── Subdomain availability check (debounced 500ms) ─────────────────────
  useEffect(() => {
    const val = subdomainInput.trim()
    if (!val || val === schoolInfo?.subdomain) { setSubdomainAvail(null); return }
    if (!/^[a-z0-9-]+$/.test(val) || val.length < 3 || val.length > 30) { setSubdomainAvail(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSubdomainAvail('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetchApi(`/api/v2/schools/check-subdomain?value=${encodeURIComponent(val)}`, { credentials: 'include' })
        const d = await r.json()
        setSubdomainAvail(d.available ? 'available' : 'taken')
      } catch { setSubdomainAvail(null) }
    }, 500)
  }, [subdomainInput, schoolInfo?.subdomain])

  // ── Notifications load ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 1 || notifData !== null || !schoolInfo?.id) return
    setNotifLoading(true)
    fetchApi(`/api/v2/schools/${schoolInfo.id}/notification-settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setNotifData(d.data) })
      .catch(() => onToast('Erreur chargement notifications', 'error'))
      .finally(() => setNotifLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Security settings load ──────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 2 || secSettings !== null || !schoolInfo?.id) return
    setSecLoading(true)
    fetchApi(`/api/v2/schools/${schoolInfo.id}/security-settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setSecSettings(d.data); setSecEdit(d.data) } })
      .catch(() => onToast(t('settings.security.load_error'), 'error'))
      .finally(() => setSecLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audit logs load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!auditOpen || !schoolInfo?.id) return
    setAuditLoad(true)
    const params = new URLSearchParams({ page: String(auditPage), limit: '20' })
    if (auditAction) params.set('action', auditAction)
    if (auditFrom)   params.set('from',   auditFrom)
    if (auditTo)     params.set('to',     auditTo)
    fetchApi(`/api/v2/schools/${schoolInfo.id}/audit-logs?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setAuditLogs(d.logs); setAuditPage(d.page); setAuditPages(d.pages); setAuditTotal(d.total) } })
      .catch(() => onToast('Erreur chargement journaux', 'error'))
      .finally(() => setAuditLoad(false))
  }, [auditOpen, auditPage, auditAction, auditFrom, auditTo, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pédagogie load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 3 || pedSettings) return
    setPedLoading(true)
    fetchApi('/api/v2/school-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPedSettings(d.data) })
      .catch(() => onToast(t('settings.pedagogy.load_error'), 'error'))
      .finally(() => setPedLoading(false))
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Activity logs load ───────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 5) return
    setActLoading(true)
    const params = new URLSearchParams({ page: String(actPage), limit: '10' })
    if (actSearch) params.set('search', actSearch)
    fetchApi(`/api/v2/activities?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setActData({ logs: d.logs ?? [], page: d.page ?? 1, pages: d.pages ?? 1, total: d.total ?? 0 }))
      .catch(() => onToast('Erreur chargement activités', 'error'))
      .finally(() => setActLoading(false))
  }, [activeTab, actPage, actSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Journal Sécurité IA (copilot + équivalents UI) — scopé à cet établissement ─────────────
  useEffect(() => {
    if (activeTab !== 5) return
    setAiAuditLoading(true)
    const params = new URLSearchParams({ page: '1', limit: '20' })
    if (aiAuditOutcome) params.set('outcome', aiAuditOutcome)
    fetchApi(`/api/v2/security/audit-log?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setAiAuditData({ entries: d.data ?? [], total: d.pagination?.total ?? 0 }))
      .catch(() => onToast('Erreur chargement du journal Sécurité IA', 'error'))
      .finally(() => setAiAuditLoading(false))
  }, [activeTab, aiAuditOutcome]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Frise unifiée (V3.6) — 3 journaux fusionnés, triés chronologiquement ─────────
  useEffect(() => {
    if (activeTab !== 5) return
    setTimelineLoading(true)
    fetchApi('/api/v2/activities/timeline?limit=20', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setTimelineData(d.timeline ?? []))
      .catch(() => onToast('Erreur chargement frise unifiée', 'error'))
      .finally(() => setTimelineLoading(false))
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Email logs load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 6) return
    setEmlLoading(true)
    const params = new URLSearchParams({ page: String(emlPage), limit: '15' })
    if (emlSearch) params.set('search', emlSearch)
    if (emlStatus) params.set('status', emlStatus)
    fetchApi(`/api/v2/email-logs?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setEmlData({ logs: d.logs ?? [], pagination: d.pagination ?? { total: 0, page: 1, pages: 1, limit: 15 } }))
      .catch(() => onToast('Erreur chargement emails', 'error'))
      .finally(() => setEmlLoading(false))
  }, [activeTab, emlPage, emlSearch, emlStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) { onToast(t('settings.profile.logo_too_large'), 'error'); return }
    const reader = new FileReader()
    reader.onload = async () => {
      const logoBase64 = reader.result as string
      setLogoPreview(logoBase64)
      setLogoLoading(true)
      try {
        const res = await fetchApi('/api/v2/school/logo', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoBase64 }) })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || t('common.error'))
        onLogoUpdate?.(logoBase64)
        onToast(t('settings.profile.toast_logo_updated'), 'success')
      } catch (err: any) {
        onToast(err.message || t('common.error'), 'error')
        setLogoPreview(schoolInfo?.logoUrl ?? null)
      } finally { setLogoLoading(false) }
    }
    reader.readAsDataURL(file)
  }

  async function handleSubdomainSave() {
    const val = subdomainInput.trim()
    if (!val || !schoolInfo?.id) return
    if (!/^[a-z0-9-]+$/.test(val)) { onToast(t('settings.profile.invalid_format'), 'error'); return }
    if (val.length < 3) { onToast(t('settings.profile.too_short'), 'error'); return }
    setSubdomainSaving(true)
    try {
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/subdomain`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSubdomain: val }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('common.error'))
      onToast(t('settings.profile.toast_updated'), 'success')
      setSubdomainAvail(null)
    } catch (err: any) {
      onToast(err.message || t('common.error'), 'error')
    } finally { setSubdomainSaving(false) }
  }

  async function handleNotifToggle(key: keyof NotifSettings) {
    if (!notifData || !schoolInfo?.id || notifSaving) return
    const prev = notifData[key]
    const next = { ...notifData, [key]: !prev }
    setNotifData(next)
    setNotifSaving(key)
    try {
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/notification-settings`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: !prev }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('settings.notifications.toast_saved'), 'success')
    } catch (err: any) {
      setNotifData(notifData)
      onToast(err.message || 'Erreur', 'error')
    } finally { setNotifSaving(null) }
  }

  async function handleSecSave() {
    if (!schoolInfo?.id) return
    setSecSaving(true)
    try {
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/security-settings`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(secEdit),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('common.error'))
      setSecSettings(data.data)
      setSecModal(false)
      onToast(t('settings.security.toast_updated'), 'success')
    } catch (err: any) {
      onToast(err.message || t('common.error'), 'error')
    } finally { setSecSaving(false) }
  }

  const subdomainChanged = subdomainInput.trim() !== (schoolInfo?.subdomain ?? '')
  const subdomainValid   = /^[a-z0-9-]+$/.test(subdomainInput.trim()) && subdomainInput.trim().length >= 3

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-settings-spin { to { transform: rotate(360deg); } }`}</style>
      <div className="mb-[16px] md:mb-[26px]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('settings.title')}</div>
          <div className="text-[13px] md:text-[14px]" style={sSub}>{t('settings.subtitle')}</div>
        </div>
      </div>

      {/* Tabs — mobile : puces défilables avec indicateur glissant, fondu de bord (maquette,
          8 onglets ne tiennent pas dans le segmented control desktop sur mobile). */}
      <div className="relative md:hidden mb-[16px] -mr-4">
        <div className="flex gap-[6px] overflow-x-auto" style={{ scrollbarWidth: 'none', padding: '2px 20px 4px' }}>
          {TABS.map((tab, i) => {
            const active = activeTab === i
            return (
              <button key={i} onClick={() => setActiveTab(i)}
                className="relative flex-shrink-0 rounded-full px-[14px] py-[9px] whitespace-nowrap border-0"
                style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                {active && (
                  <motion.div layoutId="settings-tab-pill" className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--sidebar)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10 text-[12px]" style={{ fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text3)' }}>{tab}</span>
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute top-0 right-0 bottom-[4px] w-7" style={{ background: 'linear-gradient(90deg,transparent,var(--bg) 65%)' }} />
      </div>

      {/* Tabs — desktop : segmented control inchangé */}
      <div className="hidden md:flex" style={{ gap: 2, background: 'var(--bg2)', padding: 5, borderRadius: 8, marginBottom: 15, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: activeTab === i ? 'white' : 'transparent', color: activeTab === i ? 'var(--text)' : 'var(--text3)', boxShadow: activeTab === i ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB 0: PROFIL ── */}
      {activeTab === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {/* Logo */}
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.profile.logo_section')}</span></div>
            <div className="px-[16px] py-3 md:px-[26px] md:py-[22px] gap-3 md:gap-[24px]" style={{ display: 'flex', alignItems: 'center' }}>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
              <div onClick={() => !logoLoading && logoInputRef.current?.click()}
                className="w-[64px] h-[64px] md:w-[88px] md:h-[88px]"
                style={{ borderRadius: 10, border: `2px dashed ${logoPreview ? 'var(--green)' : 'var(--border2)'}`, background: logoPreview ? 'transparent' : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: logoLoading ? 'wait' : 'pointer', overflow: 'hidden', flexShrink: 0, transition: 'all 0.15s', position: 'relative' }}>
                {logoLoading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    <div style={{ width: 22, height: 22, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
                  </div>
                )}
                {logoPreview ? <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <School size={16} strokeWidth={1.5} className="md:hidden" />}
                {!logoPreview && <School size={16} strokeWidth={1.5} className="hidden md:block" />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="text-[12px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {logoPreview ? t('settings.profile.current_logo') : t('settings.profile.no_logo')}
                </div>
                <div className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>
                  {t('settings.profile.logo_desc')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className={btnSecCls} style={btnSec} onClick={() => logoInputRef.current?.click()} disabled={logoLoading}>
                    {logoPreview ? t('settings.profile.btn_change') : t('settings.profile.btn_upload')}
                  </button>
                  {logoPreview && (
                    <button className={btnSecCls} style={{ ...btnSec, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)' }} disabled={logoLoading}
                      onClick={async () => {
                        setLogoLoading(true)
                        try {
                          const res = await fetchApi('/api/v2/school/logo', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoBase64: '' }) })
                          const data = await res.json()
                          if (data.success) { setLogoPreview(null); onLogoUpdate?.(''); onToast(t('settings.profile.toast_deleted'), 'success') }
                          else throw new Error(data.message)
                        } catch (err: any) { onToast(err.message || t('common.error'), 'error') }
                        finally { setLogoLoading(false) }
                      }}>
                      {t('settings.profile.btn_delete')}
                    </button>
                  )}
                </div>
                <div className="text-[10.5px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 6 }}>{t('settings.profile.logo_hint')}</div>
              </div>
            </div>
          </div>

          {/* Identité */}
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.profile.identity_section')}</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 px-[16px] py-3 md:px-[26px] md:py-[22px] gap-[14px] md:gap-3.5" style={{}}>
              {[
                { label: t('settings.profile.name_label'), val: schoolName, set: setSchoolName, type: 'text' },
                { label: t('settings.profile.city_label'), val: schoolCity, set: setSchoolCity, type: 'text' },
                { label: t('settings.profile.phone_label'), val: schoolPhone, set: setSchoolPhone, type: 'tel' },
              ].map((f, i) => (
                <div key={i}>
                  <div className={fieldLabelCls} style={fieldLabel}>{f.label}</div>
                  <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} className={fieldInputCls} style={fieldInput}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.profile.email_label')}</div>
                <input type="email" value={schoolEmail} onChange={e => setSchoolEmail(e.target.value)} className={fieldInputCls} style={fieldInput}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.profile.minesec_code_label')}</div>
                <input value={minesecSchoolCode} onChange={e => setMinesecSchoolCode(e.target.value)} className={fieldInputCls} style={fieldInput}
                  placeholder={t('settings.profile.minesec_code_placeholder')}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }} />
                <div className="text-[10.5px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 6 }}>{t('settings.profile.minesec_code_hint')}</div>
              </div>
            </div>
            <div className="px-[16px] py-2.5 md:px-[26px] md:py-3" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className={`${btnPrimCls} w-full md:w-auto justify-center`} style={{ ...btnPrim, display: 'flex' }} onClick={async () => {
                try {
                  const res = await fetchApi('/api/v2/school/profile', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: schoolName, city: schoolCity, phone: schoolPhone, email: schoolEmail, minesecSchoolCode }) })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.message || t('common.error'))
                  onToast(t('settings.profile.toast_saved'), 'success')
                } catch (err: any) { onToast(err.message || t('common.error'), 'error') }
              }}>{t('settings.profile.btn_save')}</button>
            </div>
          </div>

          {/* Sous-domaine */}
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.profile.subdomain_section')}</span></div>
            <div className="px-[16px] py-3 md:px-[26px] md:py-[22px]">
              {schoolInfo?.subdomain && (
                <div className="text-[13px] md:text-[13px]" style={{ color: 'var(--text2)', marginBottom: 12, fontWeight: 500 }}>
                  {t('settings.profile.subdomain_desc')}{' '}
                  <strong style={{ color: 'var(--green)' }}>https://{schoolInfo.subdomain}.zekoulabia.cm</strong>
                </div>
              )}

              {/* Warning */}
              <div className="text-[12.5px] md:text-[12px] px-[12px] py-[10px] md:px-[15px] md:py-[11px]" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, marginBottom: 12, color: 'var(--amber)', lineHeight: 1.5 }}>
                {t('settings.profile.subdomain_warning')}
              </div>

              <div className={fieldLabelCls} style={fieldLabel}>{t('settings.profile.subdomain_label')}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)', whiteSpace: 'nowrap', fontWeight: 600 }}>https://</span>
                <input
                  value={subdomainInput}
                  onChange={e => { setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSubdomainAvail(null) }}
                  className={fieldInputCls}
                  style={{ ...fieldInput, flex: 1, minWidth: 100 }}
                  placeholder={t('settings.profile.subdomain_placeholder')}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
                />
                <span className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)', whiteSpace: 'nowrap', fontWeight: 600 }}>.zekoulabia.cm</span>
              </div>

              <div className="text-[11.5px] md:text-[13px]" style={{ marginBottom: 4, fontWeight: 600, minHeight: 20 }}>
                {subdomainAvail === 'checking'  && <span style={{ color: 'var(--text3)' }}>{t('settings.profile.checking')}</span>}
                {subdomainAvail === 'available' && <span style={{ color: 'var(--green)' }}>{t('settings.profile.available')}</span>}
                {subdomainAvail === 'taken'     && <span style={{ color: 'var(--red)' }}>{t('settings.profile.taken')}</span>}
                {!subdomainAvail && subdomainInput.trim() && subdomainInput.trim().length < 3 && (
                  <span style={{ color: 'var(--amber)' }}>{t('settings.profile.too_short')}</span>
                )}
              </div>
              <div className="text-[10.5px] md:text-[12px]" style={{ color: 'var(--text3)' }}>{t('settings.profile.hint')}</div>
            </div>
            <div className="px-[16px] py-2.5 md:px-[26px] md:py-3" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className={`${btnPrimCls} w-full md:w-auto justify-center`} style={{ ...btnPrim, display: 'flex', opacity: subdomainSaving || !subdomainChanged || !subdomainValid || subdomainAvail === 'taken' || subdomainAvail === 'checking' ? 0.5 : 1 }}
                disabled={subdomainSaving || !subdomainChanged || !subdomainValid || subdomainAvail === 'taken' || subdomainAvail === 'checking'}
                onClick={handleSubdomainSave}>
                {subdomainSaving ? t('settings.profile.updating') : t('settings.profile.btn_update')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: NOTIFICATIONS ── */}
      {activeTab === 1 && (
        <div className="bg-transparent border-0 md:bg-[var(--surface)] md:border-[1.5px] md:border-[var(--border)]" style={{ borderRadius: 10, overflow: 'hidden' }}>
          <div className={`${cardHeaderCls} hidden md:flex`} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.notifications.title')}</span></div>

          {notifLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 39 }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
            </div>
          )}

          {!notifLoading && !notifData && (
            <div style={{ padding: '26px 14px', textAlign: 'center', color: 'var(--text3)' }}>
              {t('settings.notifications.load_error')}
              <button className={btnSecCls} style={{ ...btnSec, marginLeft: 12 }} onClick={() => { setNotifData(null); setNotifLoading(true); fetchApi(`/api/v2/schools/${schoolInfo?.id}/notification-settings`, { credentials: 'include' }).then(r => r.json()).then(d => { if (d.success) setNotifData(d.data) }).finally(() => setNotifLoading(false)) }}>{t('settings.notifications.btn_retry')}</button>
            </div>
          )}

          {!notifLoading && notifData && (
            <div className="flex flex-col gap-[8px] md:gap-0">
              <div className="rounded-[10px] md:rounded-none shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:border-b md:border-[var(--bg)]">
                <PushNotificationToggle style={{ border: 'none', borderRadius: 0, padding: '14px 18px' }} />
              </div>
              {NOTIF_ROWS.map((n, i) => {
                const on = notifData[n.key]
                const saving = notifSaving === n.key
                return (
                  <div key={n.key}
                    className={`rounded-[10px] md:rounded-none shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] px-[16px] py-2.5 md:px-[26px] md:py-[18px] ${i < NOTIF_ROWS.length - 1 ? 'md:border-b md:border-[var(--bg)]' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                    <div>
                      <div className="text-[13.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>{n.icon} {n.label}</div>
                      <div className="text-[11.5px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 3 }}>{n.sub}</div>
                    </div>
                    <div onClick={() => !saving && handleNotifToggle(n.key)}
                      style={{ width: 50, height: 28, borderRadius: 8, background: on ? 'var(--green)' : 'var(--border2)', cursor: saving ? 'wait' : 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: saving ? 0.6 : 1 }}>
                      <div style={{ position: 'absolute', top: 3, left: on ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: SÉCURITÉ ── */}
      {activeTab === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>

          {/* Double authentification (compte personnel) */}
          <MfaSettings />

          {/* Politique de mot de passe */}
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.security.password_policy')}</span></div>
            {secLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 26 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
              </div>
            )}
            {!secLoading && secSettings && (
              <div className="px-[16px] py-3 md:px-[26px] md:py-[22px]" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { label: t('settings.security.min_length'),     val: t('settings.security.characters').replace('{count}', String(secSettings.passwordMinLength)) },
                  { label: t('settings.security.require_upper'), val: secSettings.passwordRequireUpper ? t('settings.security.yes') : t('settings.security.no') },
                  { label: t('settings.security.require_digit'), val: secSettings.passwordRequireDigit ? t('settings.security.yes') : t('settings.security.no') },
                  { label: t('settings.security.session_duration'), val: SESSION_OPTIONS.find(o => o.value === secSettings.sessionTimeoutMin)?.label ?? `${secSettings.sessionTimeoutMin} min` },
                ].map((f, i, arr) => (
                  <div key={i} className="py-[11px] md:py-[13px]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < arr.length - 1 ? '1px solid var(--bg)' : 'none' }}>
                    <div className="text-[13.5px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{f.label}</div>
                    <div className="text-[13.5px] md:text-[13px]" style={{ color: 'var(--text2)', fontWeight: 600 }}>{f.val}</div>
                  </div>
                ))}
              </div>
            )}
            {!secLoading && !secSettings && (
              <div className="px-[16px] py-3 md:px-[26px] md:py-[22px] text-[13.5px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('settings.security.load_error')}</div>
            )}
            <div className="px-[16px] py-2.5 md:px-[26px] md:py-3" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className={`${btnSecCls} w-full md:w-auto justify-center`} style={{ ...btnSec, display: 'flex' }} onClick={() => { if (secSettings) setSecEdit(secSettings); setSecModal(true) }}>{t('settings.security.btn_edit')}</button>
            </div>
          </div>

          {/* Journaux d'audit */}
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.security.audit_logs')}</span></div>
            <div className="px-[16px] py-3 md:px-[26px] md:py-[22px]">
              <div className="text-[13.5px] md:text-[13px]" style={{ color: 'var(--text2)', marginBottom: 12, lineHeight: 1.7 }}>
                {t('settings.security.audit_desc')}
              </div>
              {!auditOpen && (
                <button className={`${btnSecCls} w-full md:w-auto justify-center`} style={{ ...btnSec, display: 'flex' }} onClick={() => { setAuditOpen(true); setAuditPage(1) }}>{t('settings.security.btn_view')}</button>
              )}
            </div>

            {auditOpen && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {/* Filters */}
                <div style={{ padding: '11px 15px', display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid var(--bg2)' }}>
                  <input
                    placeholder={t('settings.security.filter_placeholder')}
                    value={auditActInput}
                    onChange={e => setAuditActInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setAuditAction(auditActInput); setAuditPage(1) } }}
                    style={{ flex: 1, minWidth: 140, padding: '8px 12px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
                  />
                  <input type="date" value={auditFrom} onChange={e => { setAuditFrom(e.target.value); setAuditPage(1) }}
                    style={{ padding: '8px 10px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }} />
                  <input type="date" value={auditTo} onChange={e => { setAuditTo(e.target.value); setAuditPage(1) }}
                    style={{ padding: '8px 10px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }} />
                  <button className={btnSecCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center' }} onClick={() => { setAuditAction(auditActInput); setAuditPage(1) }}><Search size={14} strokeWidth={2} /></button>
                  <button className={btnSecCls} style={{ ...btnSec, marginLeft: 'auto' }} onClick={() => setAuditOpen(false)}>{t('settings.security.btn_close')}</button>
                </div>

                {/* Total */}
                <div style={{ padding: '8px 15px', fontSize: 13, color: 'var(--text3)' }}>{t('settings.security.entries_count').replace('{count}', String(auditTotal))}</div>

                {auditLoad && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 26 }}>
                    <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
                  </div>
                )}

                {!auditLoad && auditLogs.length === 0 && (
                  <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('settings.security.no_logs')}</div>
                )}

                {!auditLoad && auditLogs.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th className={thLogCls} style={thLog}>{t('settings.security.table_headers.0')}</th>
                          <th className={thLogCls} style={thLog}>{t('settings.security.table_headers.1')}</th>
                          <th className={thLogCls} style={thLog}>{t('settings.security.table_headers.2')}</th>
                          <th className={thLogCls} style={thLog}>{t('settings.security.table_headers.3')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log, i) => (
                          <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                            <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                            <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>
                              {log.user ? `${log.user.firstName} ${log.user.lastName}` : <span style={{ color: 'var(--border2)' }}>—</span>}
                            </td>
                            <td className={tdLogCls} style={tdLog}><span style={{ fontWeight: 700, color: 'var(--text)' }}>{log.action}</span></td>
                            <td className={tdLogCls} style={{ ...tdLog, maxWidth: 280, wordBreak: 'break-word' }}>{log.description ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>{t('settings.security.page_info').replace('{current}', String(auditPage)).replace('{total}', String(auditPages))}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={btnSecCls} style={{ ...btnSec, opacity: auditPage <= 1 ? 0.45 : 1 }} disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>{t('settings.security.btn_prev')}</button>
                    <button className={btnSecCls} style={{ ...btnSec, opacity: auditPage >= auditPages ? 0.45 : 1 }} disabled={auditPage >= auditPages} onClick={() => setAuditPage(p => p + 1)}>{t('settings.security.btn_next')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: PÉDAGOGIE ── */}
      {activeTab === 3 && (
        <>
          {pedLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 52 }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
            </div>
          )}
          {!pedLoading && pedSettings && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.pedagogy.academic_rules')}</span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 px-[16px] py-3 md:px-[26px] md:py-[22px] gap-[14px] md:gap-3.5">
                  <div>
                    <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.pass_mark')}</div>
                    <input type="number" min="0" max="20" step="0.5" className={fieldInputCls} style={fieldInput} value={pedSettings.passMark}
                      onChange={e => setPedSettings(s => s ? { ...s, passMark: parseFloat(e.target.value) || 0 } : s)} />
                  </div>
                  <div>
                    <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.council_pass_mark')}</div>
                    <input type="number" min="0" max="20" step="0.5" className={fieldInputCls} style={fieldInput} value={pedSettings.councilPassMark}
                      onChange={e => setPedSettings(s => s ? { ...s, councilPassMark: parseFloat(e.target.value) || 0 } : s)} />
                  </div>
                  <div>
                    <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.grades_per_term')}</div>
                    <div className="text-[13.5px] md:text-[13px] px-[12px] py-[10px] md:px-[14px] md:py-[11px]" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text3)', fontWeight: 600 }}>{pedSettings.gradesPerTerm}</div>
                  </div>
                  <div>
                    <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.terms_per_year')}</div>
                    <div className="text-[13.5px] md:text-[13px] px-[12px] py-[10px] md:px-[14px] md:py-[11px]" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text3)', fontWeight: 600 }}>{pedSettings.termsPerYear}</div>
                  </div>
                  <div>
                    <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.calendar_type')}</div>
                    <select className={fieldSelectCls} style={fieldSelect} value={pedSettings.academicCalendarType}
                      onChange={e => setPedSettings(s => s ? { ...s, academicCalendarType: e.target.value } : s)}>
                      <option value="trimester">{t('settings.pedagogy.calendar_options.trimester')}</option>
                      <option value="semester">{t('settings.pedagogy.calendar_options.semester')}</option>
                    </select>
                  </div>
                  <div>
                    <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.language_mode')}</div>
                    <select className={fieldSelectCls} style={fieldSelect} value={pedSettings.schoolLanguageMode}
                      onChange={e => setPedSettings(s => s ? { ...s, schoolLanguageMode: e.target.value } : s)}>
                      <option value="francophone">{t('settings.pedagogy.language_options.francophone')}</option>
                      <option value="anglophone">{t('settings.pedagogy.language_options.anglophone')}</option>
                      <option value="bilingual">{t('settings.pedagogy.language_options.bilingual')}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.pedagogy.attendance_section')}</span></div>
                <div className="px-[16px] py-3 md:px-[26px] md:py-[22px]" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.max_absences')}</div>
                    <input type="number" min="0" className={fieldInputCls} style={{ ...fieldInput, maxWidth: 200 }} value={pedSettings.maxAbsences}
                      onChange={e => setPedSettings(s => s ? { ...s, maxAbsences: parseInt(e.target.value) || 0 } : s)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 50, height: 28, borderRadius: 8, background: pedSettings.attendanceLateAsAbsence ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                      onClick={() => setPedSettings(s => s ? { ...s, attendanceLateAsAbsence: !s.attendanceLateAsAbsence } : s)}>
                      <div style={{ position: 'absolute', top: 3, left: pedSettings.attendanceLateAsAbsence ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </div>
                    <div>
                      <div className="text-[13.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('settings.pedagogy.late_label')}</div>
                      <div className="text-[11.5px] md:text-[12px]" style={{ color: 'var(--text3)' }}>{t('settings.pedagogy.late_sub')}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.pedagogy.contributions_section')}</span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 px-[16px] py-3 md:px-[26px] md:py-[22px] gap-[14px] md:gap-3.5">
                  <div>
                    <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.max_first_cycle')}</div>
                    <input type="number" min="0" className={fieldInputCls} style={fieldInput} value={pedSettings.legalMaxContributionFirstCycle}
                      onChange={e => setPedSettings(s => s ? { ...s, legalMaxContributionFirstCycle: parseInt(e.target.value) || 0 } : s)} />
                  </div>
                  <div>
                    <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.max_second_cycle')}</div>
                    <input type="number" min="0" className={fieldInputCls} style={fieldInput} value={pedSettings.legalMaxContributionSecondCycle}
                      onChange={e => setPedSettings(s => s ? { ...s, legalMaxContributionSecondCycle: parseInt(e.target.value) || 0 } : s)} />
                  </div>
                </div>
                <div className="px-[16px] pb-[16px] md:px-[26px] md:pb-[22px]" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 50, height: 28, borderRadius: 8, background: pedSettings.bulletinBlockOnUnpaidFees ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                    onClick={() => setPedSettings(s => s ? { ...s, bulletinBlockOnUnpaidFees: !s.bulletinBlockOnUnpaidFees } : s)}>
                    <div style={{ position: 'absolute', top: 3, left: pedSettings.bulletinBlockOnUnpaidFees ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </div>
                    <div>
                      <div className="text-[13.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('settings.pedagogy.block_bulletin_label')}</div>
                      <div className="text-[11.5px] md:text-[12px]" style={{ color: 'var(--text3)' }}>{t('settings.pedagogy.block_bulletin_sub')}</div>
                    </div>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.pedagogy.features_section')}</span></div>
                <div className="px-[16px] py-3 md:px-[26px] md:py-[22px]" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { key: 'smsEnabled', label: t('settings.pedagogy.sms_label'), sub: t('settings.pedagogy.sms_sub') },
                    { key: 'offlineModeEnabled', label: t('settings.pedagogy.offline_label'), sub: t('settings.pedagogy.offline_sub') },
                    { key: 'aiAlertsEnabled', label: t('settings.pedagogy.ai_label'), sub: t('settings.pedagogy.ai_sub') },
                    { key: 'messageModeration', label: t('settings.pedagogy.moderation_label'), sub: t('settings.pedagogy.moderation_sub') },
                  ].map(({ key, label, sub }) => {
                    const on = pedSettings[key as keyof typeof pedSettings] as boolean
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px', borderBottom: '1px solid var(--bg)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <div>
                          <div className="text-[13.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{label}</div>
                          <div className="text-[11.5px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 3 }}>{sub}</div>
                        </div>
                        <div style={{ width: 50, height: 28, borderRadius: 8, background: on ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                          onClick={() => setPedSettings(s => s ? { ...s, [key]: !on } : s)}>
                          <div style={{ position: 'absolute', top: 3, left: on ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className={`${btnPrimCls} w-full md:w-auto justify-center`} style={{ ...btnPrim, display: 'flex', opacity: pedSaving ? 0.7 : 1 }} disabled={pedSaving}
                  onClick={async () => {
                    if (!pedSettings) return
                    setPedSaving(true)
                    try {
                      const res = await fetchApi('/api/v2/school-settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passMark: pedSettings.passMark, councilPassMark: pedSettings.councilPassMark, maxAbsences: pedSettings.maxAbsences, attendanceLateAsAbsence: pedSettings.attendanceLateAsAbsence, legalMaxContributionFirstCycle: pedSettings.legalMaxContributionFirstCycle, legalMaxContributionSecondCycle: pedSettings.legalMaxContributionSecondCycle, bulletinBlockOnUnpaidFees: pedSettings.bulletinBlockOnUnpaidFees, schoolLanguageMode: pedSettings.schoolLanguageMode, academicCalendarType: pedSettings.academicCalendarType, smsEnabled: pedSettings.smsEnabled, offlineModeEnabled: pedSettings.offlineModeEnabled, aiAlertsEnabled: pedSettings.aiAlertsEnabled, messageModeration: pedSettings.messageModeration }) })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.message || t('common.error'))
                      onToast(t('settings.pedagogy.toast_saved'), 'success')
                    } catch (err: any) { onToast(err.message || t('common.error'), 'error') }
                    finally { setPedSaving(false) }
                  }}>
                  {pedSaving ? t('settings.pedagogy.saving') : t('settings.pedagogy.btn_save')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 4: PRÉFÉRENCES ── */}
      {activeTab === 4 && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.preferences.title')}</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 px-[16px] py-3 md:px-[26px] md:py-[22px] gap-[14px] md:gap-3.5">
            {[
              { label: t('settings.preferences.language_label'), optKey: 'language_options' },
              { label: t('settings.preferences.timezone_label'), optKey: 'timezone_options' },
              { label: t('settings.preferences.date_format_label'), optKey: 'date_format_options' },
              { label: t('settings.preferences.grading_system_label'), optKey: 'grading_system_options' },
            ].map((f, i) => (
              <div key={i}>
                <div className={fieldLabelCls} style={fieldLabel}>{f.label}</div>
                <select className={fieldSelectCls} style={fieldSelect}>
                  {[0, 1, 2].map(j => <option key={j}>{t(`settings.preferences.${f.optKey}.${j}`)}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="px-[16px] py-2.5 md:px-[26px] md:py-3" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className={`${btnPrimCls} w-full md:w-auto justify-center`} style={{ ...btnPrim, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => onToast(t('settings.preferences.toast_saved'), 'success')}><Save size={15} strokeWidth={2} /> {t('settings.preferences.btn_save')}</button>
          </div>
        </div>
      )}

      {/* ── TAB 5: ACTIVITÉS ── */}
      {activeTab === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ── Frise chronologique unifiée (V3.6) — 3 journaux fusionnés ────────────────── */}
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}>
              <span className="text-[12px] md:text-[14px]" style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 8 }}><ClipboardList size={16} /> Frise chronologique — Activités · IA · Emails</span>
            </div>
            {timelineLoading && (<div style={{ display: 'flex', justifyContent: 'center', padding: 26 }}><div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} /></div>)}
            {!timelineLoading && timelineData && timelineData.length === 0 && (<div className="text-[13.5px] md:text-[13px]" style={{ padding: '19px 14px', textAlign: 'center', color: 'var(--text3)' }}>Aucun événement récent</div>)}
            {!timelineLoading && timelineData && timelineData.length > 0 && (
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {timelineData.map((entry, i) => (
                  <div key={entry.id} style={{ display: 'flex', gap: 8, padding: '10px 12px', borderBottom: i < timelineData.length - 1 ? '1px solid var(--bg)' : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: entry.type === 'ACTIVITY' ? 'var(--green)' : entry.type === 'AI_ACTION' ? 'var(--amber)' : 'var(--blue)', minWidth: 56 }}>{entry.type}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', minWidth: 110 }}>{new Date(entry.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.details ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder={t('settings.activities.search_placeholder')} value={actSearchInput}
              onChange={e => setActSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setActSearch(actSearchInput); setActPage(1) } }}
              className={fieldInputCls}
              style={{ flex: 1, background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }} />
            <button className={btnSecCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center' }} onClick={() => { setActSearch(actSearchInput); setActPage(1) }}><Search size={14} strokeWidth={2} /></button>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}>
              <span className="text-[12px] md:text-[14px]" style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 8 }}><ClipboardList size={16} /> {t('settings.activities.title')}</span>
              {actData && <span className="text-[12px] md:text-[12px]" style={{ color: 'var(--text3)' }}>{t('settings.activities.entries_count').replace('{count}', String(actData.total))}</span>}
            </div>
            {actLoading && (<div style={{ display: 'flex', justifyContent: 'center', padding: 39 }}><div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} /></div>)}
            {!actLoading && actData && actData.logs.length === 0 && (<div className="text-[13.5px] md:text-[13px]" style={{ padding: '26px 14px', textAlign: 'center', color: 'var(--text3)' }}>{t('settings.activities.no_activities')}</div>)}
            {!actLoading && actData && actData.logs.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th className={thLogCls} style={thLog}>{t('settings.activities.table_headers.0')}</th>
                    <th className={thLogCls} style={thLog}>{t('settings.activities.table_headers.1')}</th>
                    <th className={thLogCls} style={thLog}>{t('settings.activities.table_headers.2')}</th>
                    <th className={thLogCls} style={thLog}>{t('settings.activities.table_headers.3')}</th>
                  </tr></thead>
                  <tbody>
                    {actData.logs.map((log, i) => (
                      <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                        <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                        <td className={tdLogCls} style={tdLog}><span style={{ fontWeight: 700, color: 'var(--text)' }}>{log.action}</span></td>
                        <td className={tdLogCls} style={{ ...tdLog, maxWidth: 320, wordBreak: 'break-word' }}>{log.description}</td>
                        <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{log.user ? (`${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`).trim() || '—' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {actData && (
              <div className="px-[14px] py-[12px] md:px-3.5 md:py-2.5" style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span className="text-[12px] md:text-[12px]" style={{ color: 'var(--text3)' }}>{t('settings.activities.page_info').replace('{current}', String(actData.page)).replace('{total}', String(actData.pages))}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={btnSecCls} style={{ ...btnSec, opacity: actData.page <= 1 ? 0.45 : 1 }} disabled={actData.page <= 1} onClick={() => setActPage(p => p - 1)}>{t('settings.activities.btn_prev')}</button>
                  <button className={btnSecCls} style={{ ...btnSec, opacity: actData.page >= actData.pages ? 0.45 : 1 }} disabled={actData.page >= actData.pages} onClick={() => setActPage(p => p + 1)}>{t('settings.activities.btn_next')}</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Journal Sécurité IA — actions du copilot et de leurs équivalents en interface classique ── */}
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={{ ...cardHeader, flexWrap: 'wrap', gap: 10 }}>
              <span className="text-[12px] md:text-[14px]" style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 8 }}><ClipboardList size={16} /> Journal Sécurité IA</span>
              <select value={aiAuditOutcome} onChange={e => setAiAuditOutcome(e.target.value as typeof aiAuditOutcome)}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border2)', fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit', background: 'var(--bg2)' }}>
                <option value="">Tous les résultats</option>
                <option value="REFUSE">Refusées</option>
                <option value="ERREUR">Erreurs</option>
                <option value="SUCCES">Réussies</option>
              </select>
            </div>
            <div className="px-[14px] py-[10px] md:px-3.5" style={{ fontSize: 13, color: 'var(--text3)' }}>
              Actions sensibles exécutées via le copilot IA ou leur équivalent en interface classique, pour cet établissement uniquement.
            </div>
            {aiAuditLoading && (<div style={{ display: 'flex', justifyContent: 'center', padding: 39 }}><div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} /></div>)}
            {!aiAuditLoading && aiAuditData && aiAuditData.entries.length === 0 && (<div className="text-[13.5px] md:text-[13px]" style={{ padding: '26px 14px', textAlign: 'center', color: 'var(--text3)' }}>Aucune entrée pour ce filtre</div>)}
            {!aiAuditLoading && aiAuditData && aiAuditData.entries.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th className={thLogCls} style={thLog}>Date</th>
                    <th className={thLogCls} style={thLog}>Action</th>
                    <th className={thLogCls} style={thLog}>Origine</th>
                    <th className={thLogCls} style={thLog}>Résultat</th>
                    <th className={thLogCls} style={thLog}>Rôle</th>
                    <th className={thLogCls} style={thLog}>Motif</th>
                  </tr></thead>
                  <tbody>
                    {aiAuditData.entries.map((log, i) => (
                      <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                        <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.timestamp)}</td>
                        <td className={tdLogCls} style={tdLog}><span style={{ fontWeight: 700, color: 'var(--text)' }}>{log.actionName}</span></td>
                        <td className={tdLogCls} style={tdLog}>{log.origin === 'AI_ASSISTANT' ? 'Copilot IA' : 'Interface classique'}</td>
                        <td className={tdLogCls} style={tdLog}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 800,
                            background: log.outcome === 'SUCCES' ? 'var(--green-light)' : log.outcome === 'REFUSE' ? 'var(--red-light)' : 'var(--orange-light)',
                            color: log.outcome === 'SUCCES' ? 'var(--green)' : log.outcome === 'REFUSE' ? 'var(--red)' : 'var(--orange)',
                          }}>
                            {log.outcome === 'SUCCES' ? 'Réussie' : log.outcome === 'REFUSE' ? 'Refusée' : 'Erreur'}
                          </span>
                        </td>
                        <td className={tdLogCls} style={tdLog}>{log.actorRole}</td>
                        <td className={tdLogCls} style={{ ...tdLog, maxWidth: 260, wordBreak: 'break-word', color: 'var(--text3)', fontSize: 13 }}>{log.refusalReason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 6: EMAILS ── */}
      {activeTab === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder={t('settings.emails.search_placeholder')} value={emlSearchInput}
              onChange={e => setEmlSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setEmlSearch(emlSearchInput); setEmlPage(1) } }}
              className={fieldInputCls}
              style={{ flex: 1, minWidth: 200, background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }} />
            <select value={emlStatus} onChange={e => { setEmlStatus(e.target.value); setEmlPage(1) }}
              className={fieldSelectCls}
              style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
              <option value="">{t('settings.emails.status_all')}</option>
              <option value="SENT">{t('settings.emails.status_sent')}</option>
              <option value="FAILED">{t('settings.emails.status_failed')}</option>
              <option value="PENDING">{t('settings.emails.status_pending')}</option>
            </select>
            <button className={btnSecCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center' }} onClick={() => { setEmlSearch(emlSearchInput); setEmlPage(1) }}><Search size={14} strokeWidth={2} /></button>
          </div>
          <div className="bg-transparent border-0 md:bg-[var(--surface)] md:border-[1.5px] md:border-[var(--border)] rounded-none md:rounded-[10px]" style={{ overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}>
              <span className="text-[12px] md:text-[14px]" style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mail size={16} /> {t('settings.emails.title')}</span>
              {emlData && <span className="text-[12px] md:text-[12px]" style={{ color: 'var(--text3)' }}>{t('settings.emails.count').replace('{count}', String(emlData.pagination.total))}</span>}
            </div>
            {emlLoading && (<div style={{ display: 'flex', justifyContent: 'center', padding: 39 }}><div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} /></div>)}
            {!emlLoading && emlData && emlData.logs.length === 0 && (<div className="text-[13.5px] md:text-[13px]" style={{ padding: '26px 14px', textAlign: 'center', color: 'var(--text3)' }}>{t('settings.emails.no_emails')}</div>)}
            {!emlLoading && emlData && emlData.logs.length > 0 && (
              <>
                {/* Mobile : cartes empilées (une table serait illisible/étroite sur un écran de téléphone) */}
                <div className="md:hidden flex flex-col gap-[8px] px-[16px] py-[12px]">
                  {emlData.logs.map(log => {
                    const s = (log.status ?? '').toLowerCase()
                    const badge = s.includes('sent') || s.includes('envoy') ? { bg: 'rgba(5,150,105,0.12)', color: 'var(--green2)' }
                      : s.includes('fail') || s.includes('chec') ? { bg: 'rgba(220,38,38,0.12)', color: 'var(--red)' }
                      : s.includes('pend') || s.includes('attente') ? { bg: 'rgba(217,119,6,0.12)', color: 'var(--amber)' }
                      : { bg: 'var(--bg2)', color: 'var(--text3)' }
                    return (
                      <div key={log.id} className="rounded-[10px] px-[14px] py-[12px]" style={{ background: 'var(--surface)', boxShadow: '0 1px 2px rgba(20,20,15,0.05),0 1px 6px rgba(20,20,15,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div className="text-[13px]" style={{ fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word', minWidth: 0, flex: 1 }}>{log.subject}</div>
                          <span className="text-[10px]" style={{ display: 'inline-block', flexShrink: 0, padding: '3px 9px', borderRadius: 10, fontWeight: 700, background: badge.bg, color: badge.color }}>{log.status}</span>
                        </div>
                        <div className="text-[11.5px]" style={{ color: 'var(--text3)', marginTop: 3, wordBreak: 'break-word' }}>{log.to}</div>
                        <div className="text-[10.5px]" style={{ color: 'var(--text3)', marginTop: 6 }}>{fmtDate(log.createdAt)}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop : tableau classique */}
                <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th className={thLogCls} style={thLog}>{t('settings.emails.table_headers.0')}</th>
                      <th className={thLogCls} style={thLog}>{t('settings.emails.table_headers.1')}</th>
                      <th className={thLogCls} style={thLog}>{t('settings.emails.table_headers.2')}</th>
                      <th className={thLogCls} style={thLog}>{t('settings.emails.table_headers.3')}</th>
                    </tr></thead>
                    <tbody>
                      {emlData.logs.map((log, i) => {
                        const s = (log.status ?? '').toLowerCase()
                        const badge = s.includes('sent') || s.includes('envoy') ? { bg: 'rgba(5,150,105,0.12)', color: 'var(--green2)' }
                          : s.includes('fail') || s.includes('chec') ? { bg: 'rgba(220,38,38,0.12)', color: 'var(--red)' }
                          : s.includes('pend') || s.includes('attente') ? { bg: 'rgba(217,119,6,0.12)', color: 'var(--amber)' }
                          : { bg: 'var(--bg2)', color: 'var(--text3)' }
                        return (
                          <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                            <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                            <td className={tdLogCls} style={{ ...tdLog, maxWidth: 200, wordBreak: 'break-word' }}>{log.to}</td>
                            <td className={tdLogCls} style={{ ...tdLog, maxWidth: 280, wordBreak: 'break-word' }}>{log.subject}</td>
                            <td className={tdLogCls} style={tdLog}><span className="text-[10.5px] md:text-[12px]" style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 10, fontWeight: 700, background: badge.bg, color: badge.color }}>{log.status}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {emlData && (
              <div className="px-[14px] py-[12px] md:px-3.5 md:py-2.5" style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span className="text-[12px] md:text-[12px]" style={{ color: 'var(--text3)' }}>{t('settings.emails.page_info').replace('{current}', String(emlData.pagination.page)).replace('{total}', String(emlData.pagination.pages))}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={btnSecCls} style={{ ...btnSec, opacity: emlData.pagination.page <= 1 ? 0.45 : 1 }} disabled={emlData.pagination.page <= 1} onClick={() => setEmlPage(p => p - 1)}>{t('settings.emails.btn_prev')}</button>
                  <button className={btnSecCls} style={{ ...btnSec, opacity: emlData.pagination.page >= emlData.pagination.pages ? 0.45 : 1 }} disabled={emlData.pagination.page >= emlData.pagination.pages} onClick={() => setEmlPage(p => p + 1)}>{t('settings.emails.btn_next')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Onglet Structure ── */}
      {activeTab === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.structure.backup_title')}</span></div>
            {backupLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 23 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
              </div>
            )}
            {!backupLoading && !backupInfo && (
              <div className="px-[16px] py-3 md:px-[26px] md:py-[20px] text-[13.5px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('settings.structure.no_backup')}</div>
            )}
            {!backupLoading && backupInfo && (
              <div className="grid grid-cols-1 md:grid-cols-2 px-[16px] py-3 md:px-[26px] md:py-[20px] gap-[12px] md:gap-[14px]">
                <div>
                  <div className={fieldLabelCls} style={fieldLabel}>{t('settings.structure.date_label')}</div>
                  <div className="text-[13.5px] md:text-[13px] px-[12px] py-[10px] md:px-[14px] md:py-[11px]" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontWeight: 600 }}>
                    {backupInfo.lastBackupAt ? new Date(backupInfo.lastBackupAt).toLocaleString('fr-FR') : '—'}
                  </div>
                </div>
                <div>
                  <div className={fieldLabelCls} style={fieldLabel}>{t('settings.structure.file_label')}</div>
                  <div className="text-[13.5px] md:text-[13px] px-[12px] py-[10px] md:px-[14px] md:py-[11px]" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontWeight: 600, wordBreak: 'break-word' }}>
                    {backupInfo.lastBackupFile ?? '—'}
                  </div>
                </div>
                <div className="text-[11.5px] md:text-[13px]" style={{ gridColumn: '1 / -1', color: 'var(--text3)' }}>
                  {backupInfo.latestFileExists ? t('settings.structure.backup_file_available') : t('settings.structure.backup_file_missing')}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}><span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.structure.rgpd_title')}</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 px-[16px] py-3 md:px-[26px] md:py-[20px] gap-[12px] md:gap-[14px]">
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.structure.log_retention')}</div>
                {logRetentionLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48 }}>
                    <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
                  </div>
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={logRetentionDays}
                    onChange={e => setLogRetentionDays(Math.max(1, parseInt(e.target.value || '90', 10) || 90))}
                    className={fieldInputCls} style={fieldInput}
                  />
                )}
                <div className="text-[10.5px] md:text-[12px]" style={{ marginTop: 6, color: 'var(--text3)' }}>{t('settings.structure.log_retention_hint')}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div className={fieldLabelCls} style={fieldLabel}>{t('settings.structure.export_label')}</div>
                  <div className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)', lineHeight: 1.6 }}>{t('settings.structure.export_desc')}</div>
                </div>
                <button className={btnSecCls} style={btnSec} onClick={handleRgpdExport} disabled={exportLoading}>
                  {exportLoading ? t('settings.structure.exporting') : t('settings.structure.btn_export')}
                </button>
              </div>
            </div>
            <div className="px-[16px] py-2.5 md:px-[26px] md:py-3" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className={`${btnPrimCls} w-full md:w-auto justify-center`} style={{ ...btnPrim, display: 'flex' }} onClick={handleLogRetentionSave} disabled={logRetentionSaving || logRetentionLoading}>
                {logRetentionSaving ? t('settings.structure.saving_retention') : t('settings.structure.btn_save_retention')}
              </button>
            </div>
          </div>

          <div className="px-[14px] py-[12px] md:px-3.5 md:py-2.5 text-[12.5px] md:text-[12px]" style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 8, color: 'var(--amber)', fontWeight: 600 }}>
            {t('settings.structure.structure_warning')}
          </div>

          {!structConfig && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 39 }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
            </div>
          )}

          {structConfig && (
            <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              <div className={cardHeaderCls} style={cardHeader}>
                <span className="text-[12px] md:text-[14px]" style={cardTitle}>{t('settings.structure.classes_per_level')}</span>
              </div>
              <div className="px-[16px] py-3 md:px-[26px] md:py-[20px]" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...structConfig.niveaux1erCycle, ...structConfig.niveauxPrimaire].length === 0 && (
                  <div className="text-[13.5px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('settings.structure.no_levels')}</div>
                )}
                {[...structConfig.niveaux1erCycle, ...structConfig.niveauxPrimaire].map(niveau => (
                  <div key={niveau} style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
                    <span className="text-[13.5px] md:text-[13px]" style={{ minWidth: 60, fontWeight: 800, color: 'var(--text)' }}>{niveau}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setStructEdit(e => ({ ...e, [niveau]: Math.max(1, (e[niveau] ?? structConfig.classesParNiveau[niveau] ?? structConfig.classesParNiveauPrimaire[niveau] ?? 1) - 1) }))}
                        className="w-[30px] h-[30px] md:w-[34px] md:h-[34px] text-[13px] md:text-[18px]"
                        style={{ borderRadius: 8, border: '1.5px solid var(--border2)', background: 'var(--surface)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontFamily: 'inherit' }}>−</button>
                      <span className="text-[13px] md:text-[18px]" style={{ minWidth: 32, textAlign: 'center', fontWeight: 800, color: 'var(--green)' }}>
                        {structEdit[niveau] ?? structConfig.classesParNiveau[niveau] ?? structConfig.classesParNiveauPrimaire[niveau] ?? 1}
                      </span>
                      <button onClick={() => setStructEdit(e => ({ ...e, [niveau]: Math.min(26, (e[niveau] ?? structConfig.classesParNiveau[niveau] ?? structConfig.classesParNiveauPrimaire[niveau] ?? 1) + 1) }))}
                        className="w-[30px] h-[30px] md:w-[34px] md:h-[34px] text-[13px] md:text-[18px]"
                        style={{ borderRadius: 8, border: '1.5px solid var(--border2)', background: 'var(--surface)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontFamily: 'inherit' }}>+</button>
                    </div>
                    <span className="text-[11.5px] md:text-[13px]" style={{ color: 'var(--text3)' }}>
                      {(() => {
                        const current = structConfig.classesParNiveau[niveau] ?? structConfig.classesParNiveauPrimaire[niveau] ?? 1
                        const next = structEdit[niveau] ?? current
                        const diff = next - current
                        if (diff > 0) return t('settings.structure.classes_to_create').replace('{count}', String(diff))
                        if (diff < 0) return t('settings.structure.reduction_ignored')
                        return t('settings.structure.current_classes').replace('{count}', String(current))
                      })()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {structResult !== null && structResult.length > 0 && (
            <div className="px-[14px] py-[12px] md:px-3.5 md:py-2.5" style={{ background: 'var(--green-light)', border: '1.5px solid var(--green)', borderRadius: 8 }}>
              <div className="text-[13.5px] md:text-[13px]" style={{ fontWeight: 800, color: 'var(--green2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={15} strokeWidth={2} /> {t('settings.structure.classes_created_title')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {structResult.map(n => (
                  <span key={n} className="text-[12.5px] md:text-[12px]" style={{ padding: '4px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--green)', fontWeight: 700, color: 'var(--green2)' }}>{n}</span>
                ))}
              </div>
            </div>
          )}
          {structResult !== null && structResult.length === 0 && (
            <div className="text-[12.5px] md:text-[12px] px-[14px] py-[12px] md:px-3.5 md:py-2.5" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={15} strokeWidth={2} /> {t('settings.structure.no_new_classes')}
            </div>
          )}

          {structConfig && (
            <button className={`${btnPrimCls} w-full md:w-auto justify-center md:self-start`} onClick={handleStructSave} disabled={structSaving}
              style={{ ...btnPrim, display: 'flex', opacity: structSaving ? 0.7 : 1, cursor: structSaving ? 'wait' : 'pointer' }}>
              {structSaving ? t('settings.structure.applying') : t('settings.structure.btn_apply')}
            </button>
          )}
        </div>
      )}

      {/* ── MODAL: Politique de sécurité ── */}
      {secModal && (
        <div onClick={() => !secSaving && setSecModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8"
            style={{ background: 'var(--surface)', borderRadius: 10, width: 460, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
              {t('settings.security.modal.title')}
            </div>

            <div style={{ marginBottom: 13 }}>
              <div className={fieldLabelCls} style={fieldLabel}>{t('settings.security.modal.min_length_label')}</div>
              <select className={fieldSelectCls} style={fieldSelect} value={secEdit.passwordMinLength}
                onChange={e => setSecEdit(s => ({ ...s, passwordMinLength: parseInt(e.target.value) }))}>
                {[6,7,8,9,10,12,14,16].map(v => <option key={v} value={v}>{t('settings.security.characters').replace('{count}', String(v))}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 13 }}>
              {[
                { key: 'passwordRequireUpper' as const, label: t('settings.security.modal.require_upper_label') },
                { key: 'passwordRequireDigit' as const, label: t('settings.security.modal.require_digit_label') },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 26, borderRadius: 8, background: secEdit[key] ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                    onClick={() => setSecEdit(s => ({ ...s, [key]: !s[key] }))}>
                    <div style={{ position: 'absolute', top: 2, left: secEdit[key] ? 22 : 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </div>
                  <span className="text-[13.5px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 15 }}>
              <div className={fieldLabelCls} style={fieldLabel}>{t('settings.security.modal.session_label')}</div>
              <select className={fieldSelectCls} style={fieldSelect} value={secEdit.sessionTimeoutMin}
                onChange={e => setSecEdit(s => ({ ...s, sessionTimeoutMin: parseInt(e.target.value) }))}>
                {SESSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="text-[13px] md:text-[13px]" onClick={() => setSecModal(false)} disabled={secSaving}
                style={{ flex: 1, padding: '11px', borderRadius: 11, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('settings.security.modal.btn_cancel')}
              </button>
              <button className="text-[13px] md:text-[13px]" onClick={handleSecSave} disabled={secSaving}
                style={{ flex: 2, padding: '11px', borderRadius: 11, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: secSaving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: secSaving ? 0.7 : 1 }}>
                {secSaving ? t('settings.security.modal.saving') : t('settings.security.modal.btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnPrimCls = 'text-[13px] md:text-[13px] px-[16px] py-[10px] md:px-3.5 md:py-[10px]'
const btnPrim: React.CSSProperties = { borderRadius: 11, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecCls = 'text-[13px] md:text-[13px] px-[14px] py-[9px] md:px-3.5 md:py-[10px]'
const btnSec: React.CSSProperties = { borderRadius: 8, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const cardHeaderCls = 'px-[16px] py-[12px] md:px-[26px] md:py-3 flex-wrap gap-[6px]'
const cardHeader: React.CSSProperties = { borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const cardTitle: React.CSSProperties = { fontWeight: 800, color: 'var(--text)' }
const fieldLabelCls = 'text-[10.5px] md:text-[13px]'
const fieldLabel: React.CSSProperties = { fontWeight: 800, color: 'var(--text2)', marginBottom: 7, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }
const fieldInputCls = 'text-[13.5px] md:text-[13px] px-[12px] py-[10px] md:px-[14px] md:py-[11px]'
const fieldInput: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }
const fieldSelectCls = 'text-[13.5px] md:text-[13px] px-[12px] py-[10px] md:px-[14px] md:py-[11px]'
const fieldSelect: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }
const thLogCls = 'text-[10.5px] md:text-[12px] px-[10px] py-[8px] md:px-[14px] md:py-[10px]'
const thLog: React.CSSProperties = { textAlign: 'left', fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdLogCls = 'text-[12.5px] md:text-[12px] px-[10px] py-[8px] md:px-[14px] md:py-[10px]'
const tdLog: React.CSSProperties = { color: 'var(--text2)', border: '1px solid var(--bg2)', verticalAlign: 'top' }

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}
