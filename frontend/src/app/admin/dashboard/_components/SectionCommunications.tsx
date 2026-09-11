'use client'
import { useState, useEffect, useCallback } from 'react'
import { Smartphone, Mail, PenLine, ClipboardList, Eye, Upload, AlertTriangle, Paperclip, Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string; level: string }

interface BroadcastTarget {
  role?: string
  classId?: string
  level?: string
  paymentStatus?: string
}

interface BroadcastLog {
  id: string
  channel: string
  target: BroadcastTarget
  message: string
  recipientCount: number
  sentCount: number
  failedCount: number
  status: string
  createdAt: string
}

interface PreviewData { total: number; withPhone: number; withEmail: number }

const CANAL_LABEL: Record<string, string> = {
  SMS:   'SMS',
  EMAIL: 'Email',
  BOTH:  'SMS & Email',
}
const CANAL_ICON: Record<string, LucideIcon> = { SMS: Smartphone, EMAIL: Mail, BOTH: Smartphone }

const STATUS_STYLE: Record<string, { color: string; bg: string; labelKey: string }> = {
  completed: { color: 'var(--green)', bg: 'var(--green-light)', labelKey: 'completed' },
  partial:   { color: 'var(--amber)', bg: 'var(--amber-light)', labelKey: 'partial' },
  failed:    { color: 'var(--red)', bg: 'var(--red-light)', labelKey: 'failed' },
}

const ROLE_OPTIONS = [
  { value: '',        labelKey: 'empty' },
  { value: 'PARENT',  labelKey: 'parent' },
  { value: 'STUDENT', labelKey: 'student' },
  { value: 'TEACHER', labelKey: 'teacher' },
  { value: 'STAFF',   labelKey: 'staff' },
]

const PAYMENT_OPTIONS = [
  { value: '',        labelKey: 'empty' },
  { value: 'OVERDUE', labelKey: 'overdue' },
  { value: 'PENDING', labelKey: 'pending' },
  { value: 'PARTIAL', labelKey: 'partial' },
  { value: 'PAID',    labelKey: 'paid' },
]

const VARIABLES = ['{nom_eleve}', '{classe}', '{solde}']

function targetSummary(target: BroadcastTarget, translate: (key: string) => string): string {
  const parts: string[] = []
  if (target.role)          parts.push(translate(`communications.target_role.${target.role}`))
  if (target.classId)       parts.push(translate('communications.target_class'))
  if (target.level)         parts.push(translate('communications.target_level').replace('{level}', target.level))
  if (target.paymentStatus) parts.push(translate(`communications.target_payment.${target.paymentStatus}`))
  return parts.join(' · ') || '—'
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
      if (clsRes.success)  setClasses(clsRes.data ?? [])
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
    if (!window.confirm(t('communications.confirm_send').replace('{channel}', channel).replace('{count}', String(preview?.total ?? '?')))) return

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
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
      <div className="mb-[16px] md:mb-[18px]">
        <h2 className="text-[18px] md:text-[18px]" style={{ margin: 0, fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('communications.title')}</h2>
        <p className="text-[12px] md:text-[12px]" style={{ margin: '6px 0 0', color: 'var(--text3)' }}>
          {t('communications.subtitle')}
        </p>
      </div>

      <div className="mb-[16px] md:mb-[18px]" style={{ display: 'flex', gap: 4, background: 'var(--border)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {(['compose', 'history'] as const).map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className="text-[12.5px] md:text-[12px] px-[14px] md:px-3.5 py-[8px] md:py-[7px]"
            style={{
              borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700,
              background: tab === tb ? 'white' : 'transparent',
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
        <div className="grid grid-cols-1 md:[grid-template-columns:1fr_300px] gap-3 md:gap-4">
          <div className="rounded-[10px] md:rounded-[10px] p-3 md:p-4 shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-[0_1px_4px_rgba(0,0,0,0.06)]" style={{ background: 'var(--surface)' }}>
            <h3 className="text-[12.5px] md:text-[13px]" style={{ margin: '0 0 12px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase' }}>1. Canal d'envoi</h3>
            <div className="gap-[8px] md:gap-[10px] mb-[18px] md:mb-[20px]" style={{ display: 'flex' }}>
              {(['SMS', 'EMAIL', 'BOTH'] as const).map((c) => {
                const Icon = CANAL_ICON[c]
                return (
                <button key={c} onClick={() => setChannel(c)}
                  className="rounded-[10px] py-[10px] px-0 text-[12.5px] md:text-[13px]"
                  style={{
                    flex: 1, border: channel === c ? '1.5px solid var(--blue)' : '1.5px solid var(--border)',
                    background: channel === c ? 'var(--blue-light)' : 'white', color: channel === c ? 'var(--blue)' : 'var(--text3)',
                    fontWeight: 800, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  <Icon size={14} /> {CANAL_LABEL[c]}
                </button>
                )
              })}
            </div>

            <h3 className="text-[12.5px] md:text-[13px]" style={{ margin: '0 0 14px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase' }}>{t('communications.target_section')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] md:gap-3 mb-[20px] md:mb-[20px]">
              <div>
                <label className="text-[11px] md:text-[12px]" style={{ fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{t('communications.role_label')}</label>
                <select value={role} onChange={(e) => { setRole(e.target.value); setPreview(null) }}
                  className="text-[13px] md:text-[13px] px-[11px] py-[8px] md:px-[12px] md:py-[9px]"
                  style={{ width: '100%', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(`communications.role_options.${o.labelKey}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] md:text-[12px]" style={{ fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{t('communications.class_label')}</label>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setLevel(''); setPreview(null) }}
                  className="text-[13px] md:text-[13px] px-[11px] py-[8px] md:px-[12px] md:py-[9px]"
                  style={{ width: '100%', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                  <option value="">{t('communications.all_classes')}</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] md:text-[12px]" style={{ fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{t('communications.level_label')}</label>
                <select value={level} onChange={(e) => { setLevel(e.target.value); setClassId(''); setPreview(null) }}
                  className="text-[13px] md:text-[13px] px-[11px] py-[8px] md:px-[12px] md:py-[9px]"
                  style={{ width: '100%', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                  <option value="">{t('communications.all_levels')}</option>
                  {levels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] md:text-[12px]" style={{ fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{t('communications.payment_label')}</label>
                <select value={paymentStatus} onChange={(e) => { setPayment(e.target.value); setPreview(null) }}
                  className="text-[13px] md:text-[13px] px-[11px] py-[8px] md:px-[12px] md:py-[9px]"
                  style={{ width: '100%', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                  {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(`communications.payment_options.${o.labelKey}`)}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-wrap gap-y-[8px]" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="text-[12.5px] md:text-[13px]" style={{ margin: 0, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase' }}>{t('communications.message_section')}</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {VARIABLES.map((v) => (
                  <button key={v} onClick={() => insertVariable(v)}
                    className="text-[10px] md:text-[11px]"
                    style={{
                      padding: '3px 10px', borderRadius: 6, border: '1px solid var(--purple-light)', background: 'var(--purple-light)',
                      color: 'var(--purple)', fontWeight: 700, cursor: 'pointer',
                    }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('communications.message_placeholder')}
              rows={5}
              className="text-[12.5px] md:text-[13px]"
              style={{
                width: '100%', padding: '12px 11px', borderRadius: 8, border: '1.5px solid var(--border)',
                resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
            <div className="text-[10.5px] md:text-[11px]" style={{ marginTop: 6, color: 'var(--text3)', textAlign: 'right' }}>
              {t('communications.char_count').replace('{count}', String(message.length))}
              {message.length > 160 && channel !== 'EMAIL' && (
                <span style={{ color: 'var(--amber)', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} /> {t('communications.sms_count').replace('{count}', String(Math.ceil(message.length / 160)))}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={handlePreview} disabled={previewing}
                className="text-[13px] md:text-[12px]"
                style={{
                  flex: 1, padding: '11px', borderRadius: 8, border: '2px solid var(--blue)',
                  background: 'var(--surface)', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer',
                  opacity: previewing ? 0.6 : 1,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {previewing ? t('communications.btn_preview_loading') : <><Eye size={15} /> {t('communications.btn_preview')}</>}
              </button>
              <button onClick={handleSend} disabled={sending || !preview}
                className="text-[13px] md:text-[12px]"
                style={{
                  flex: 2, padding: '11px', borderRadius: 8, border: 'none',
                  background: !preview || sending ? 'var(--text3)' : 'var(--blue)',
                  color: 'white', fontWeight: 700, cursor: !preview || sending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {sending ? t('communications.btn_send_loading') : <><Upload size={15} /> {t('communications.btn_send').replace('{channel}', channel)}</>}
              </button>
            </div>
          </div>

          <div>
            <div className="rounded-[10px] p-3 md:p-4" style={{ background: 'var(--surface)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 12 }}>
              <h4 className="text-[13px] md:text-[12px]" style={{ margin: '0 0 14px', fontWeight: 700, color: 'var(--text2)' }}>{t('communications.preview_title')}</h4>
              {!preview ? (
                <div className="text-[12.5px] md:text-[13px]" style={{ textAlign: 'center', padding: '14px', color: 'var(--text3)' }}>
                  {t('communications.preview_empty_line1')}<br />{t('communications.preview_empty_line2')}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: t('communications.preview_total'), value: preview.total, color: 'var(--text)' },
                      { label: t('communications.preview_with_phone'),     value: preview.withPhone, color: 'var(--blue)' },
                      { label: t('communications.preview_with_email'),  value: preview.withEmail, color: 'var(--green)' },
                    ].map((item) => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                        <span className="text-[12.5px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{item.label}</span>
                        <span className="text-[13px] md:text-[16px]" style={{ fontWeight: 800, color: item.color }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {preview.total === 0 && (
                    <div className="text-[11.5px] md:text-[12px]" style={{ marginTop: 12, padding: '10px 11px', background: 'var(--amber-light)', borderRadius: 8, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={13} /> {t('communications.preview_no_recipients')}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ background: 'var(--blue-light)', borderRadius: 8, padding: 14, border: '1px solid var(--blue-light)' }}>
              <h4 className="text-[12.5px] md:text-[13px]" style={{ margin: '0 0 10px', fontWeight: 700, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 6 }}><Paperclip size={14} /> {t('communications.variables_title')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { var: '{nom_eleve}', desc: t('communications.var_student_name') },
                  { var: '{classe}',    desc: t('communications.var_class') },
                  { var: '{solde}',     desc: t('communications.var_balance') },
                ].map((v) => (
                  <div key={v.var} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <code className="text-[10.5px] md:text-[11px]" style={{ background: 'var(--blue-light)', padding: '2px 6px', borderRadius: 4, color: 'var(--blue)', whiteSpace: 'nowrap' }}>{v.var}</code>
                    <span className="text-[11.5px] md:text-[12px]" style={{ color: 'var(--blue)', paddingTop: 1 }}>{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ background: 'var(--surface)', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {logs.length === 0 ? (
            <div style={{ padding: 31, textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Inbox size={16} className="md:hidden" />
                <Inbox size={16} className="hidden md:block" />
              </div>
              <div className="text-[13px] md:text-[13px]" style={{ fontWeight: 600 }}>{t('communications.history_empty_title')}</div>
              <div className="text-[12px] md:text-[13px]" style={{ marginTop: 6 }}>{t('communications.history_empty_sub')}</div>
            </div>
          ) : (
            <>
            <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
              {logs.map((log) => {
                const s = STATUS_STYLE[log.status] ?? STATUS_STYLE['partial']
                return (
                  <div key={log.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{CANAL_LABEL[log.channel] ?? log.channel}</span>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                          {new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} · {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 6, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {t(`communications.status_labels.${s.labelKey}`)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>{targetSummary(log.target, t)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message}>
                      {log.message}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 8 }}>
                      <span style={{ color: 'var(--green)', fontWeight: 700 }}>{t('communications.sent_label').replace('{count}', String(log.sentCount))}</span>
                      {log.failedCount > 0 && <span style={{ color: 'var(--red)', marginLeft: 6 }}>· {t('communications.failed_label').replace('{count}', String(log.failedCount))}</span>}
                      <span style={{ color: 'var(--text3)', marginLeft: 6 }}>· {t('communications.recipients_label').replace('{count}', String(log.recipientCount))}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t(`communications.table_headers.${i}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const s = STATUS_STYLE[log.status] ?? STATUS_STYLE['partial']
                    return (
                      <tr key={log.id} style={{ borderTop: '1px solid var(--bg2)', background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                          {new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          <br />
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>{CANAL_LABEL[log.channel] ?? log.channel}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>
                          {targetSummary(log.target, t)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text2)', maxWidth: 260 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message}>
                            {log.message}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12 }}>
                          <span style={{ color: 'var(--green)', fontWeight: 700 }}>{t('communications.sent_label').replace('{count}', String(log.sentCount))}</span>
                          {log.failedCount > 0 && (
                            <span style={{ color: 'var(--red)', marginLeft: 6 }}>· {t('communications.failed_label').replace('{count}', String(log.failedCount))}</span>
                          )}
                          <br />
                          <span style={{ color: 'var(--text3)' }}>{t('communications.recipients_label').replace('{count}', String(log.recipientCount))}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 6, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
                            {t(`communications.status_labels.${s.labelKey}`)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
