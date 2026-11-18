'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { type Language, useChangeLanguage, useLanguage, useT } from '@/lib/i18n'
import {
  isNetworkErr,
  type AuditLog,
  type NotifSettings,
  type PedSettings,
  type SchoolInfo,
  type SecSettings,
} from './types'

interface UseSettingsGeneralParams {
  activeTab: number
  schoolInfo?: SchoolInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onLogoUpdate?: (url: string) => void
}

const DEFAULT_NOTIF: NotifSettings = {
  smsAbsences: true,
  smsPayments: true,
  smsBulletins: true,
  emailDigestAdmin: true,
  smsLowBalance: false,
}

const DEFAULT_SEC: SecSettings = {
  passwordMinLength: 8,
  passwordRequireUpper: false,
  passwordRequireDigit: true,
  sessionTimeoutMin: 60,
}

const DEFAULT_PED: PedSettings = {
  passMark: 10,
  councilPassMark: 9.5,
  gradesPerTerm: 2,
  termsPerYear: 3,
  maxAbsences: 30,
  attendanceLateAsAbsence: false,
  legalMaxContributionFirstCycle: 10000,
  legalMaxContributionSecondCycle: 15000,
  bulletinBlockOnUnpaidFees: true,
  schoolLanguageMode: 'FR',
  academicCalendarType: 'TRIMESTRE',
  cycles: ['PREMIER_CYCLE', 'SECOND_CYCLE'],
  smsEnabled: false,
  offlineModeEnabled: true,
  aiAlertsEnabled: true,
  messageModeration: false,
}

export function useSettingsGeneral({ activeTab, schoolInfo, onToast, onLogoUpdate }: UseSettingsGeneralParams) {
  const t = useT('admin')
  const { lang } = useLanguage()
  const changeLanguage = useChangeLanguage()

  const [dashboardLanguage, setDashboardLanguage] = useState<Language>(lang)
  const [preferencesSaving, setPreferencesSaving] = useState(false)

  // Profil
  const [schoolName, setSchoolName] = useState('')
  const [schoolCity, setSchoolCity] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [minesecSchoolCode, setMinesecSchoolCode] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoLoading, setLogoLoading] = useState(false)

  // Sous-domaine
  const [subdomainInput, setSubdomainInput] = useState('')
  const [subdomainAvail, setSubdomainAvail] = useState<'checking' | 'available' | 'taken' | null>(null)
  const [subdomainSaving, setSubdomainSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Notifications
  const [notifData, setNotifData] = useState<NotifSettings | null>(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSaving, setNotifSaving] = useState<keyof NotifSettings | null>(null)

  // Sécurité & Audit
  const [secSettings, setSecSettings] = useState<SecSettings | null>(null)
  const [secLoading, setSecLoading] = useState(false)
  const [secModal, setSecModal] = useState(false)
  const [secEdit, setSecEdit] = useState<SecSettings>(DEFAULT_SEC)
  const [secSaving, setSecSaving] = useState(false)

  const [auditOpen, setAuditOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditPage, setAuditPage] = useState(1)
  const [auditPages, setAuditPages] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditLoad, setAuditLoad] = useState(false)
  const [auditAction, setAuditAction] = useState('')
  const [auditActInput, setAuditActInput] = useState('')
  const [auditFrom, setAuditFrom] = useState('')
  const [auditTo, setAuditTo] = useState('')

  // Pédagogie
  const [pedSettings, setPedSettings] = useState<PedSettings | null>(null)
  const [pedLoading, setPedLoading] = useState(false)
  const [pedSaving, setPedSaving] = useState(false)

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

  useEffect(() => {
    if (activeTab !== 1 || notifData !== null || !schoolInfo?.id) return
    getCachedData<NotifSettings>('admin:notification-settings').then(c => {
      if (c?.data) setNotifData(c.data)
      else if (typeof navigator !== 'undefined' && !navigator.onLine) setNotifData(DEFAULT_NOTIF)
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setNotifLoading(true)
    fetchApi(`/api/v2/schools/${schoolInfo.id}/notification-settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setNotifData(d.data)
          putCachedData('admin:notification-settings', d.data).catch(() => {})
        }
      })
      .catch((err) => {
        if (!isNetworkErr(err)) onToast('Erreur chargement notifications', 'error')
        setNotifData(prev => prev ?? DEFAULT_NOTIF)
      })
      .finally(() => setNotifLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 2 || secSettings !== null || !schoolInfo?.id) return
    getCachedData<SecSettings>('admin:security-settings').then(c => {
      if (c?.data) { setSecSettings(c.data); setSecEdit(c.data) }
      else if (typeof navigator !== 'undefined' && !navigator.onLine) { setSecSettings(DEFAULT_SEC); setSecEdit(DEFAULT_SEC) }
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setSecLoading(true)
    fetchApi(`/api/v2/schools/${schoolInfo.id}/security-settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSecSettings(d.data)
          setSecEdit(d.data)
          putCachedData('admin:security-settings', d.data).catch(() => {})
        }
      })
      .catch((err) => {
        if (!isNetworkErr(err)) onToast(t('settings.security.load_error'), 'error')
        setSecSettings(prev => prev ?? DEFAULT_SEC)
        setSecEdit(prev => prev ?? DEFAULT_SEC)
      })
      .finally(() => setSecLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!auditOpen || !schoolInfo?.id) return
    const cacheKey = `admin:audit-logs:${auditPage}:${auditAction}`
    getCachedData<{ logs?: AuditLog[]; total?: number; pages?: number }>(cacheKey).then(c => {
      if (c?.data) {
        setAuditLogs(c.data.logs || [])
        setAuditTotal(c.data.total || 0)
        setAuditPages(c.data.pages || 1)
      }
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setAuditLoad(true)
    const params = new URLSearchParams({ page: String(auditPage), limit: '20' })
    if (auditAction) params.set('action', auditAction)
    if (auditFrom) params.set('from', auditFrom)
    if (auditTo) params.set('to', auditTo)
    fetchApi(`/api/v2/schools/${schoolInfo.id}/audit-logs?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAuditLogs(d.logs); setAuditPage(d.page); setAuditPages(d.pages); setAuditTotal(d.total)
          putCachedData(cacheKey, { logs: d.logs, total: d.total, pages: d.pages }).catch(() => {})
        }
      })
      .catch((err) => { if (!isNetworkErr(err)) onToast('Erreur chargement journaux', 'error') })
      .finally(() => setAuditLoad(false))
  }, [auditOpen, auditPage, auditAction, auditFrom, auditTo, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 3 || pedSettings) return
    getCachedData<PedSettings>('admin:school-settings').then(c => {
      if (c?.data) setPedSettings(c.data)
      else if (typeof navigator !== 'undefined' && !navigator.onLine) setPedSettings(DEFAULT_PED)
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setPedLoading(true)
    fetchApi('/api/v2/school-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPedSettings(d.data)
          putCachedData('admin:school-settings', d.data).catch(() => {})
        }
      })
      .catch((err) => {
        if (!isNetworkErr(err)) onToast(t('settings.pedagogy.load_error'), 'error')
        setPedSettings(prev => prev ?? DEFAULT_PED)
      })
      .finally(() => setPedLoading(false))
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

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
      } catch (err: unknown) {
        onToast(err instanceof Error ? err.message : t('common.error'), 'error')
        setLogoPreview(schoolInfo?.logoUrl ?? null)
      } finally { setLogoLoading(false) }
    }
    reader.readAsDataURL(file)
  }

  async function handleLogoDelete() {
    setLogoLoading(true)
    try {
      const res = await fetchApi('/api/v2/school/logo', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoBase64: '' }) })
      const data = await res.json()
      if (data.success) { setLogoPreview(null); onLogoUpdate?.(''); onToast(t('settings.profile.toast_deleted'), 'success') }
      else throw new Error(data.message)
    } catch (err: unknown) { onToast(err instanceof Error ? err.message : t('common.error'), 'error') }
    finally { setLogoLoading(false) }
  }

  async function handleProfileSave() {
    try {
      const res = await fetchApi('/api/v2/school/profile', {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: schoolName, city: schoolCity, phone: schoolPhone, email: schoolEmail, minesecSchoolCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('common.error'))
      onToast(t('settings.profile.toast_saved'), 'success')
    } catch (err: unknown) { onToast(err instanceof Error ? err.message : t('common.error'), 'error') }
  }

  async function handleSubdomainSave() {
    const val = subdomainInput.trim()
    if (!val || !schoolInfo?.id) return
    if (!/^[a-z0-9-]+$/.test(val)) { onToast(t('settings.profile.invalid_format'), 'error'); return }
    if (val.length < 3) { onToast(t('settings.profile.too_short'), 'error'); return }
    setSubdomainSaving(true)
    try {
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/subdomain`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSubdomain: val }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('common.error'))
      onToast(t('settings.profile.toast_updated'), 'success')
      setSubdomainAvail(null)
    } catch (err: unknown) { onToast(err instanceof Error ? err.message : t('common.error'), 'error') }
    finally { setSubdomainSaving(false) }
  }

  async function handleNotifToggle(key: keyof NotifSettings) {
    if (!notifData || !schoolInfo?.id || notifSaving) return
    const prev = notifData[key]
    setNotifData({ ...notifData, [key]: !prev })
    setNotifSaving(key)
    try {
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/notification-settings`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: !prev }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('settings.notifications.toast_saved'), 'success')
    } catch (err: unknown) {
      setNotifData(notifData)
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setNotifSaving(null) }
  }

  function retryNotifLoad() {
    setNotifData(null); setNotifLoading(true)
    fetchApi(`/api/v2/schools/${schoolInfo?.id}/notification-settings`, { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setNotifData(d.data) }).finally(() => setNotifLoading(false))
  }

  async function handleSecSave() {
    if (!schoolInfo?.id) return
    setSecSaving(true)
    try {
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/security-settings`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(secEdit),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('common.error'))
      setSecSettings(data.data); setSecModal(false)
      onToast(t('settings.security.toast_updated'), 'success')
    } catch (err: unknown) { onToast(err instanceof Error ? err.message : t('common.error'), 'error') }
    finally { setSecSaving(false) }
  }

  async function handlePedSave() {
    if (!pedSettings) return
    setPedSaving(true)
    try {
      const res = await fetchApi('/api/v2/school-settings', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passMark: pedSettings.passMark, councilPassMark: pedSettings.councilPassMark, maxAbsences: pedSettings.maxAbsences,
          attendanceLateAsAbsence: pedSettings.attendanceLateAsAbsence,
          legalMaxContributionFirstCycle: pedSettings.legalMaxContributionFirstCycle,
          legalMaxContributionSecondCycle: pedSettings.legalMaxContributionSecondCycle,
          bulletinBlockOnUnpaidFees: pedSettings.bulletinBlockOnUnpaidFees,
          schoolLanguageMode: pedSettings.schoolLanguageMode, academicCalendarType: pedSettings.academicCalendarType,
          smsEnabled: pedSettings.smsEnabled, offlineModeEnabled: pedSettings.offlineModeEnabled,
          aiAlertsEnabled: pedSettings.aiAlertsEnabled, messageModeration: pedSettings.messageModeration,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('common.error'))
      onToast(t('settings.pedagogy.toast_saved'), 'success')
    } catch (err: unknown) { onToast(err instanceof Error ? err.message : t('common.error'), 'error') }
    finally { setPedSaving(false) }
  }

  async function handleSavePreferences() {
    setPreferencesSaving(true)
    try {
      await changeLanguage(dashboardLanguage)
      onToast(t('settings.preferences.toast_saved'), 'success')
    } finally { setPreferencesSaving(false) }
  }

  return {
    schoolName, setSchoolName, schoolCity, setSchoolCity, schoolPhone, setSchoolPhone,
    schoolEmail, setSchoolEmail, minesecSchoolCode, setMinesecSchoolCode,
    logoPreview, logoLoading, handleLogoChange, handleLogoDelete, handleProfileSave,
    subdomainInput, setSubdomainInput, subdomainAvail, setSubdomainAvail, subdomainSaving, handleSubdomainSave,
    subdomainChanged: subdomainInput.trim() !== (schoolInfo?.subdomain ?? ''),
    subdomainValid: /^[a-z0-9-]+$/.test(subdomainInput.trim()) && subdomainInput.trim().length >= 3,
    notifData, notifLoading, notifSaving, handleNotifToggle, retryNotifLoad,
    secSettings, secLoading, secModal, setSecModal, secEdit, setSecEdit, secSaving, handleSecSave,
    auditOpen, setAuditOpen, auditLogs, auditPage, setAuditPage, auditPages, auditTotal, auditLoad,
    auditAction, setAuditAction, auditActInput, setAuditActInput, auditFrom, setAuditFrom, auditTo, setAuditTo,
    pedSettings, setPedSettings, pedLoading, pedSaving, handlePedSave,
    dashboardLanguage, setDashboardLanguage, preferencesSaving, handleSavePreferences,
  }
}
