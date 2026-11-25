'use client'

import type React from 'react'
import { Mail, Search } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  btnSec,
  btnSecCls,
  cardHeader,
  cardHeaderCls,
  cardTitle,
  fieldInputCls,
  fieldSelectCls,
  fmtDate,
  tdLog,
  tdLogCls,
  thLog,
  thLogCls,
  type EmailLog,
} from './types'

interface SettingsEmailsTabProps {
  emlSearchInput: string
  setEmlSearchInput: (v: string) => void
  setEmlSearch: (v: string) => void
  emlStatus: string
  setEmlStatus: (v: string) => void
  setEmlPage: React.Dispatch<React.SetStateAction<number>>
  emlData: { logs: EmailLog[]; pagination: { total: number; page: number; pages: number; limit: number } } | null
  emlLoading: boolean
}

function getStatusBadge(status: string | undefined) {
  const s = (status ?? '').toLowerCase()
  if (s.includes('sent') || s.includes('envoy')) return { bg: 'rgba(5,150,105,0.12)', color: 'var(--green2)' }
  if (s.includes('fail') || s.includes('chec')) return { bg: 'rgba(220,38,38,0.12)', color: 'var(--red)' }
  if (s.includes('pend') || s.includes('attente')) return { bg: 'rgba(217,119,6,0.12)', color: 'var(--amber)' }
  return { bg: 'var(--bg2)', color: 'var(--text3)' }
}

export default function SettingsEmailsTab(props: SettingsEmailsTabProps) {
  const t = useT('admin')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder={t('settings.emails.search_placeholder')}
          value={props.emlSearchInput}
          onChange={e => props.setEmlSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { props.setEmlSearch(props.emlSearchInput); props.setEmlPage(1) } }}
          className={fieldInputCls}
          style={{ flex: 1, minWidth: 180, background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
        />
        <select
          value={props.emlStatus}
          onChange={e => { props.setEmlStatus(e.target.value); props.setEmlPage(1) }}
          className={fieldSelectCls}
          style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
        >
          <option value="">{t('settings.emails.status_all')}</option>
          <option value="SENT">{t('settings.emails.status_sent')}</option>
          <option value="FAILED">{t('settings.emails.status_failed')}</option>
          <option value="PENDING">{t('settings.emails.status_pending')}</option>
        </select>
        <button className={btnSecCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center' }} onClick={() => { props.setEmlSearch(props.emlSearchInput); props.setEmlPage(1) }}>
          <Search size={13} strokeWidth={2} />
        </button>
      </div>

      <div className="bg-transparent border-0 md:bg-[var(--surface)] md:border md:border-[var(--border)] rounded-none md:rounded-[12px]" style={{ overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Mail size={15} /> {t('settings.emails.title')}
          </span>
          {props.emlData && <span className="text-[11.5px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('settings.emails.count').replace('{count}', String(props.emlData.pagination.total))}</span>}
        </div>
        {props.emlLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
          </div>
        )}
        {!props.emlLoading && props.emlData && props.emlData.logs.length === 0 && (
          <div className="text-xs md:text-[13.5px]" style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)' }}>{t('settings.emails.no_emails')}</div>
        )}
        {!props.emlLoading && props.emlData && props.emlData.logs.length > 0 && (
          <>
            <div className="md:hidden flex flex-col gap-[6px] px-3.5 py-2.5">
              {props.emlData.logs.map(log => {
                const badge = getStatusBadge(log.status)
                return (
                  <div key={log.id} className="rounded-[10px] px-3 py-2" style={{ background: 'var(--surface)', boxShadow: '0 1px 2px rgba(20,20,15,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                      <div className="text-xs md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word', minWidth: 0, flex: 1 }}>{log.subject}</div>
                      <span className="text-[10px]" style={{ display: 'inline-block', flexShrink: 0, padding: '2px 8px', borderRadius: 12, fontWeight: 700, background: badge.bg, color: badge.color }}>{log.status}</span>
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text3)', marginTop: 2, wordBreak: 'break-word' }}>{log.to}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text3)', marginTop: 4 }}>{fmtDate(log.createdAt)}</div>
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th className={thLogCls} style={thLog}>{t('settings.emails.table_headers.0')}</th>
                    <th className={thLogCls} style={thLog}>{t('settings.emails.table_headers.1')}</th>
                    <th className={thLogCls} style={thLog}>{t('settings.emails.table_headers.2')}</th>
                    <th className={thLogCls} style={thLog}>{t('settings.emails.table_headers.3')}</th>
                  </tr>
                </thead>
                <tbody>
                  {props.emlData.logs.map((log, i) => {
                    const badge = getStatusBadge(log.status)
                    return (
                      <tr key={log.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                        <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                        <td className={tdLogCls} style={{ ...tdLog, maxWidth: 200, wordBreak: 'break-word' }}>{log.to}</td>
                        <td className={tdLogCls} style={{ ...tdLog, maxWidth: 280, wordBreak: 'break-word' }}>{log.subject}</td>
                        <td className={tdLogCls} style={tdLog}>
                          <span className="text-[10.5px] md:text-[11.5px]" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontWeight: 700, background: badge.bg, color: badge.color }}>{log.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {props.emlData && (
          <div className="px-3.5 py-2 md:px-4 md:py-2.5" style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span className="text-[11.5px] md:text-xs" style={{ color: 'var(--text3)' }}>
              {t('settings.emails.page_info').replace('{current}', String(props.emlData.pagination.page)).replace('{total}', String(props.emlData.pagination.pages))}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={btnSecCls} style={{ ...btnSec, opacity: props.emlData.pagination.page <= 1 ? 0.45 : 1 }} disabled={props.emlData.pagination.page <= 1} onClick={() => props.setEmlPage(p => p - 1)}>{t('settings.emails.btn_prev')}</button>
              <button className={btnSecCls} style={{ ...btnSec, opacity: props.emlData.pagination.page >= props.emlData.pagination.pages ? 0.45 : 1 }} disabled={props.emlData.pagination.page >= props.emlData.pagination.pages} onClick={() => props.setEmlPage(p => p + 1)}>{t('settings.emails.btn_next')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
