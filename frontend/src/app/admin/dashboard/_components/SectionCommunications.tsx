'use client'
import { useState, useEffect, useCallback } from 'react'
import { PenLine, ClipboardList } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import CommunicationsComposeTab from './communications/CommunicationsComposeTab'
import CommunicationsHistoryTab from './communications/CommunicationsHistoryTab'
import type { BroadcastLog, BroadcastTarget, ClassItem, PreviewData } from './communications/types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionCommunications({ onToast }: Props) {
  const t = useT('admin')
  const [classes, setClasses]           = useState<ClassItem[]>([])
  const [logs, setLogs]                 = useState<BroadcastLog[]>([])
  const [totalLogs, setTotalLogs]       = useState(0)
  const [loading, setLoading]           = useState(true)
  const [sending, setSending]           = useState(false)
  const [previewing, setPreviewing]     = useState(false)
  const [preview, setPreview]           = useState<PreviewData | null>(null)
  const [tab, setTab]                   = useState<'compose' | 'history'>('compose')

  // Form state
  const [channel, setChannel]       = useState<'SMS' | 'EMAIL' | 'BOTH'>('SMS')
  const [role, setRole]             = useState('')
  const [classId, setClassId]       = useState('')
  const [level, setLevel]           = useState('')
  const [paymentStatus, setPayment] = useState('')
  const [message, setMessage]       = useState('')

  const levels = [...new Set(classes.map((c) => c.level).filter(Boolean))].sort()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [clsRes, logsRes] = await Promise.all([
        fetchApi('/api/v2/classes?limit=200').then((r) => r.json()),
        fetchApi('/api/v2/communications/broadcasts?limit=20').then((r) => r.json()),
      ])
      if (clsRes.success) setClasses(clsRes.data ?? [])
      if (logsRes.success) {
        setLogs(logsRes.data?.logs ?? [])
        setTotalLogs(logsRes.data?.total ?? 0)
      }
    } catch {
      onToast(t('communications.load_error'), 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // Rafraîchissement temps réel quand l'assistant IA diffuse un message.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'broadcastLog') loadData()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [loadData])

  const buildTarget = (): BroadcastTarget => ({
    ...(role          ? { role }          : {}),
    ...(classId       ? { classId }       : {}),
    ...(level         ? { level }         : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
  })

  const handlePreview = async () => {
    const target = buildTarget()
    if (!role && !classId && !level && !paymentStatus) {
      onToast(t('communications.select_target_filter'), 'error'); return
    }
    setPreviewing(true)
    setPreview(null)
    try {
      const params = new URLSearchParams()
      if (target.role)          params.set('role', target.role)
      if (target.classId)       params.set('classId', target.classId)
      if (target.level)         params.set('level', target.level)
      if (target.paymentStatus) params.set('paymentStatus', target.paymentStatus)
      const r = await fetchApi(`/api/v2/communications/broadcasts/preview?${params.toString()}`)
      const d = await r.json()
      if (d.success) setPreview(d.data)
      else onToast(d.error ?? t('communications.preview_error'), 'error')
    } catch {
      onToast(t('communications.network_error'), 'error')
    } finally {
      setPreviewing(false)
    }
  }

  const handleSend = async () => {
    const target = buildTarget()
    if (!message.trim())                                     { onToast(t('communications.message_empty'), 'error'); return }
    if (!role && !classId && !level && !paymentStatus)       { onToast(t('communications.select_filter'), 'error'); return }
    if (!(await confirmAction(t('communications.confirm_send').replace('{channel}', channel).replace('{count}', String(preview?.total ?? '?'))))) return

    setSending(true)
    try {
      const r = await fetchApi('/api/v2/communications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, channel, message }),
      })
      const d = await r.json()
      if (d.success) {
        const { sent, failed, total } = d.data
        const msg = failed > 0
          ? t('communications.send_success_partial').replace('{sent}', String(sent)).replace('{total}', String(total)).replace('{failed}', String(failed))
          : t('communications.send_success').replace('{sent}', String(sent)).replace('{total}', String(total))
        onToast(msg, failed > 0 ? 'info' : 'success')
        setMessage('')
        setPreview(null)
        loadData()
        setTab('history')
      } else {
        onToast(d.error ?? t('communications.send_error'), 'error')
      }
    } catch {
      onToast(t('communications.network_error'), 'error')
    } finally {
      setSending(false)
    }
  }

  const insertVariable = (v: string) => {
    setMessage((prev) => prev + v)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text3)' }}>
      {t('communications.loading')}
    </div>
  )

  return (
    <div className="px-4 py-5 md:px-9 md:py-8" style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="mb-[16px] md:mb-[28px]">
        <h2 className="text-[15px] md:text-[17px]" style={{ margin: 0, fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('communications.title')}</h2>
        <p className="text-[11px] md:text-[12px]" style={{ margin: '6px 0 0', color: 'var(--text3)' }}>
          {t('communications.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-[16px] md:mb-[24px]" style={{ display: 'flex', gap: 4, background: 'var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['compose', 'history'] as const).map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className="text-[12.5px] md:text-[14px] px-[14px] md:px-[20px] py-[8px] md:py-[7px]"
            style={{
              borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700,
              background: tab === tb ? 'var(--surface)' : 'transparent',
              color: tab === tb ? 'var(--text)' : 'var(--text3)',
              boxShadow: tab === tb ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {tb === 'compose' ? <><PenLine size={14} /> {t('communications.tab_compose')}</> : <><ClipboardList size={14} /> {t('communications.tab_history')}{totalLogs > 0 ? ` (${totalLogs})` : ''}</>}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        <CommunicationsComposeTab
          channel={channel}
          role={role}
          classId={classId}
          level={level}
          paymentStatus={paymentStatus}
          message={message}
          classes={classes}
          levels={levels}
          preview={preview}
          previewing={previewing}
          sending={sending}
          onChangeChannel={setChannel}
          onChangeRole={(v) => { setRole(v); setPreview(null) }}
          onChangeClassId={(v) => { setClassId(v); setLevel(''); setPreview(null) }}
          onChangeLevel={(v) => { setLevel(v); setClassId(''); setPreview(null) }}
          onChangePaymentStatus={(v) => { setPayment(v); setPreview(null) }}
          onChangeMessage={setMessage}
          onInsertVariable={insertVariable}
          onPreview={handlePreview}
          onSend={handleSend}
        />
      )}

      {tab === 'history' && <CommunicationsHistoryTab logs={logs} />}
    </div>
  )
}
