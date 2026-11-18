'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, KeyRound, Shield, Zap, Bot, type LucideIcon } from 'lucide-react'
import type { AuditLogDto } from '../_types'
import type { EmailLogDto, AIActionAuditLogDto } from '../_api'
import { fetchLogs, fetchEmailLogs, fetchAIActionAuditLog } from '../_api'
import { useT } from '@/lib/i18n'
import type { LogTab } from './logs/logsConstants'
import { LogsAuthTab, LogsActionsTab } from './logs/LogsSystemAuditTabs'
import LogsEmailsTab from './logs/LogsEmailsTab'
import LogsAiSecurityTab from './logs/LogsAiSecurityTab'
import LogsSecurityTab from './logs/LogsSecurityTab'
import LogsMfaResetPanel from './logs/LogsMfaResetPanel'

interface Props {
  logs: AuditLogDto[]
  loading: boolean
  onChangePwd: () => void
  mfaEnabled: boolean
}

export default function SectionLogs({ logs: initialLogs, loading: initialLoading, onChangePwd, mfaEnabled }: Props) {
  const t = useT('master')
  const [tab, setTab] = useState<LogTab>('auth')

  const [actionLogs, setActionLogs] = useState<AuditLogDto[]>([])
  const [actionLoading, setActionLoading] = useState(false)

  const [emailLogs, setEmailLogs] = useState<EmailLogDto[]>([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSearch, setEmailSearch] = useState('')

  const [aiLogs, setAiLogs] = useState<AIActionAuditLogDto[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiOutcomeFilter, setAiOutcomeFilter] = useState<'' | AIActionAuditLogDto['outcome']>('REFUSE')
  const [aiOriginFilter, setAiOriginFilter] = useState<'' | AIActionAuditLogDto['origin']>('')

  const loadAiLogs = useCallback(async (outcome: '' | AIActionAuditLogDto['outcome'], origin: '' | AIActionAuditLogDto['origin']) => {
    setAiLoading(true)
    try {
      const res = await fetchAIActionAuditLog({ outcome: outcome || undefined, origin: origin || undefined, limit: 100 })
      setAiLogs(res.data)
    } catch { /* silencieux */ }
    finally { setAiLoading(false) }
  }, [])

  const loadActionLogs = useCallback(async () => {
    setActionLoading(true)
    try {
      const res = await fetchLogs({ type: 'actions', limit: 100 })
      setActionLogs(res.data)
    } catch { /* silencieux */ }
    finally { setActionLoading(false) }
  }, [])

  const loadEmailLogs = useCallback(async (search?: string) => {
    setEmailLoading(true)
    try {
      const res = await fetchEmailLogs({ search: search?.trim() || undefined, limit: 100 })
      setEmailLogs(res.data)
    } catch { /* silencieux */ }
    finally { setEmailLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'actions' && actionLogs.length === 0) loadActionLogs()
    if (tab === 'emails' && emailLogs.length === 0) loadEmailLogs()
    if (tab === 'ai-security' && aiLogs.length === 0) loadAiLogs(aiOutcomeFilter, aiOriginFilter)
  }, [tab, actionLogs.length, emailLogs.length, aiLogs.length, loadActionLogs, loadEmailLogs, loadAiLogs, aiOutcomeFilter, aiOriginFilter])

  const authLogs = initialLogs.filter(l => !l.action.startsWith('action:'))

  const tabs: { id: LogTab; label: string; icon: LucideIcon }[] = [
    { id: 'auth',        label: t('logs.tab_auth'),     icon: KeyRound },
    { id: 'actions',     label: t('logs.tab_actions'),  icon: Zap },
    { id: 'emails',      label: t('logs.tab_emails'),   icon: Mail },
    { id: 'ai-security', label: t('logs.tab_ai'),       icon: Bot },
    { id: 'security',    label: t('logs.tab_security'), icon: Shield },
  ]

  return (
    <div
      className="px-3.5 pt-3.5 pb-6 md:px-6 md:pt-5 md:pb-12"
      style={{ overflowY: 'auto', height: '100%', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div className="text-[18px] md:text-[20px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
            {t('logs.title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{t('logs.subtitle')}</div>
        </div>
      </div>

      {/* Horizontally scrollable tabs on small screens */}
      <div style={{
        display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 10, marginBottom: 16,
        maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
        {tabs.map(tb => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: tab === tb.id ? 'var(--surface)' : 'transparent',
              color: tab === tb.id ? 'var(--text)' : 'var(--text3)',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: tab === tb.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.12s',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            <tb.icon size={15} />
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'auth' && <LogsAuthTab logs={authLogs} loading={initialLoading} />}
      {tab === 'actions' && <LogsActionsTab logs={actionLogs} loading={actionLoading} />}
      {tab === 'emails' && (
        <LogsEmailsTab
          emailLogs={emailLogs}
          loading={emailLoading}
          search={emailSearch}
          onSearchChange={setEmailSearch}
          onSearchSubmit={loadEmailLogs}
        />
      )}
      {tab === 'ai-security' && (
        <LogsAiSecurityTab
          aiLogs={aiLogs}
          loading={aiLoading}
          outcomeFilter={aiOutcomeFilter}
          originFilter={aiOriginFilter}
          onOutcomeChange={v => { setAiOutcomeFilter(v); loadAiLogs(v, aiOriginFilter) }}
          onOriginChange={v => { setAiOriginFilter(v); loadAiLogs(aiOutcomeFilter, v) }}
        />
      )}
      {tab === 'security' && (
        <>
          <LogsSecurityTab
            mfaEnabled={mfaEnabled}
            onChangePwd={onChangePwd}
            onMfaChange={() => { window.location.reload() }}
          />
          <LogsMfaResetPanel />
        </>
      )}
    </div>
  )
}
