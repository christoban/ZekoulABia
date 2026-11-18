'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ShieldAlert, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  fetchSuppressedOutboundMessages,
  type SuppressedOutboundMessageDto,
} from '../_api'
import type { MasterUserDto, SchoolDto } from '../_types'
import ModeTestGlobalCard from './modeTest/ModeTestGlobalCard'
import ModeTestSchoolsCard from './modeTest/ModeTestSchoolsCard'
import SuppressedMessagesCard from './modeTest/SuppressedMessagesCard'

interface Props {
  user: MasterUserDto | null
  schools?: SchoolDto[]
  onToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export default function SectionModeTest({ user, schools = [], onToast }: Props) {
  const t = useT('master')

  const isSuperAdmin = user?.role === 'super_admin'
  const hasGlobalSchoolView = isSuperAdmin || user?.role === 'platform_admin'
  const canManageSchools =
    hasGlobalSchoolView || user?.role === 'school_manager'

  const realSchools = useMemo(
    () =>
      schools.filter(
        (s) => s.subdomain !== 'system' && !s.subdomain.startsWith('fixture-'),
      ),
    [schools],
  )

  const [modeTest, setModeTest] = useState<boolean | null>(null)
  const [disabledSchoolIds, setDisabledSchoolIds] = useState<string[]>([])
  const [modeTestBusy, setModeTestBusy] = useState(false)
  const [schoolBusyId, setSchoolBusyId] = useState<string | null>(null)
  const [confirmDesactivation, setConfirmDesactivation] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [filtreEcoleMessages, setFiltreEcoleMessages] = useState<string>('')
  const [messagesSupprimes, setMessagesSupprimes] = useState<SuppressedOutboundMessageDto[]>([])
  const [messagesSupprimesLoading, setMessagesSupprimesLoading] = useState(false)

  const chargerMessagesSupprimes = useCallback(async (schoolIdFilter?: string) => {
    if (!canManageSchools) return
    const effectiveFilter = hasGlobalSchoolView
      ? schoolIdFilter || null
      : schoolIdFilter || realSchools[0]?.id || null
    if (!hasGlobalSchoolView && !effectiveFilter) {
      setMessagesSupprimes([])
      return
    }
    setMessagesSupprimesLoading(true)
    try {
      const rows = await fetchSuppressedOutboundMessages(100, effectiveFilter)
      setMessagesSupprimes(rows)
    } catch {
      setMessagesSupprimes([])
    } finally {
      setMessagesSupprimesLoading(false)
    }
  }, [canManageSchools, hasGlobalSchoolView, realSchools])

  const chargerModeTest = useCallback(async () => {
    if (!canManageSchools) return
    try {
      const settings = await fetchPlatformSettings()
      setModeTest(settings.outboundMessagingEnabled)
      setDisabledSchoolIds(settings.disabledSchoolIds ?? [])
      await chargerMessagesSupprimes(filtreEcoleMessages)
    } catch {
      setModeTest(null)
    }
  }, [canManageSchools, chargerMessagesSupprimes, filtreEcoleMessages])

  useEffect(() => {
    if (!hasGlobalSchoolView && !filtreEcoleMessages && realSchools.length > 0) {
      setFiltreEcoleMessages(realSchools[0].id)
    }
  }, [hasGlobalSchoolView, filtreEcoleMessages, realSchools])

  useEffect(() => {
    void chargerModeTest()
  }, [chargerModeTest])

  const basculerModeTestGlobal = async (prochainEtat: boolean) => {
    if (!isSuperAdmin) return
    setModeTestBusy(true)
    try {
      const updated = await updatePlatformSettings(prochainEtat)
      setModeTest(updated.outboundMessagingEnabled)
      setDisabledSchoolIds(updated.disabledSchoolIds ?? disabledSchoolIds)
      setConfirmDesactivation(false)
      window.dispatchEvent(
        new CustomEvent('zekoulabia:mode-test-changed', {
          detail: { outboundMessagingEnabled: updated.outboundMessagingEnabled },
        })
      )
      onToast(
        updated.outboundMessagingEnabled
          ? t('mode_test.statut_actif')
          : t('mode_test.statut_inactif'),
        updated.outboundMessagingEnabled ? 'success' : 'warning'
      )
      await chargerMessagesSupprimes(filtreEcoleMessages)
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erreur lors du changement de mode test', 'error')
    } finally {
      setModeTestBusy(false)
    }
  }

  const basculerModeTestEcole = async (schoolId: string, schoolName: string, prochainEtatEnvoiActif: boolean) => {
    if (!canManageSchools) return
    setSchoolBusyId(schoolId)
    try {
      const updated = await updatePlatformSettings(prochainEtatEnvoiActif, schoolId)
      setModeTest(updated.outboundMessagingEnabled)
      setDisabledSchoolIds(updated.disabledSchoolIds ?? [])
      window.dispatchEvent(new CustomEvent('zekoulabia:mode-test-changed'))
      onToast(
        prochainEtatEnvoiActif
          ? `${schoolName} : ${t('mode_test.statut_actif')}`
          : `${schoolName} : ${t('mode_test.active_badge')}`,
        prochainEtatEnvoiActif ? 'success' : 'warning'
      )
      await chargerMessagesSupprimes(filtreEcoleMessages)
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erreur lors de la mise à jour de l’établissement', 'error')
    } finally {
      setSchoolBusyId(null)
    }
  }

  const schoolNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of realSchools) {
      map.set(s.id, s.name)
    }
    return map
  }, [realSchools])

  const filteredSchools = useMemo(() => {
    const q = schoolSearch.trim().toLowerCase()
    const list = !q
      ? realSchools
      : realSchools.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.subdomain.toLowerCase().includes(q) ||
            (s.city ?? '').toLowerCase().includes(q)
        )
    return [...list].sort((a, b) => {
      const aInTest = disabledSchoolIds.includes(a.id) ? 0 : 1
      const bInTest = disabledSchoolIds.includes(b.id) ? 0 : 1
      if (aInTest !== bInTest) return aInTest - bInTest
      return a.name.localeCompare(b.name, 'fr')
    })
  }, [realSchools, schoolSearch, disabledSchoolIds])

  if (!canManageSchools) {
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            color: 'var(--text2)',
            fontSize: 13,
          }}
        >
          {t('mode_test.restricted_access')}
        </div>
      </div>
    )
  }

  return (
    <div
      className="px-3.5 pt-3.5 pb-6 md:px-6 md:pt-5 md:pb-12"
      style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="text-[18px] md:text-[20px]" style={{ margin: 0, fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
                {t('mode_test.titre')}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text3)' }}>
                {isSuperAdmin
                  ? t('mode_test.subtitle_super')
                  : t('mode_test.subtitle_operator')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void chargerModeTest()}
            aria-label={t('mode_test.rafraichir')}
            title={t('mode_test.rafraichir')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 12px',
              minHeight: 38,
              minWidth: 38,
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">{t('mode_test.rafraichir')}</span>
          </button>
        </div>

        {/* 1. Carte Interrupteur Global Plateforme */}
        {modeTest !== null && (
          <ModeTestGlobalCard
            modeTest={modeTest}
            isSuperAdmin={isSuperAdmin}
            modeTestBusy={modeTestBusy}
            confirmDesactivation={confirmDesactivation}
            reservedFounderLabel={t('mode_test.reserved_founder')}
            onRequestDisable={() => setConfirmDesactivation(true)}
            onCancelDisable={() => setConfirmDesactivation(false)}
            onToggleGlobal={(nextEnabled) => void basculerModeTestGlobal(nextEnabled)}
          />
        )}

        {/* 2. Mode Test par Établissement */}
        <ModeTestSchoolsCard
          schools={filteredSchools}
          modeTest={modeTest}
          disabledSchoolIds={disabledSchoolIds}
          schoolSearch={schoolSearch}
          schoolBusyId={schoolBusyId}
          onSearchChange={setSchoolSearch}
          onToggleSchool={(schoolId, schoolName, prochainEtat) =>
            void basculerModeTestEcole(schoolId, schoolName, prochainEtat)
          }
        />

        {/* 3. Journal des messages supprimés (7 derniers jours) */}
        <SuppressedMessagesCard
          messages={messagesSupprimes}
          loading={messagesSupprimesLoading}
          hasGlobalSchoolView={hasGlobalSchoolView}
          realSchools={realSchools}
          schoolNameById={schoolNameById}
          filtreEcoleMessages={filtreEcoleMessages}
          onFilterChange={(val) => {
            setFiltreEcoleMessages(val)
            void chargerMessagesSupprimes(val)
          }}
          onRefresh={() => void chargerMessagesSupprimes(filtreEcoleMessages)}
        />
      </div>
    </div>
  )
}
