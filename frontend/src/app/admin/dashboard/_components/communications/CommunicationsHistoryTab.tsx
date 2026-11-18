'use client'

import { Inbox } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { CANAL_LABEL, STATUS_STYLE, targetSummary, type BroadcastLog } from './types'

interface CommunicationsHistoryTabProps {
  logs: BroadcastLog[]
}

export default function CommunicationsHistoryTab({ logs }: CommunicationsHistoryTabProps) {
  const t = useT('admin')

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {logs.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Inbox size={32} className="md:hidden" />
            <Inbox size={40} className="hidden md:block" />
          </div>
          <div className="text-[13.5px] md:text-[15px]" style={{ fontWeight: 600 }}>{t('communications.history_empty_title')}</div>
          <div className="text-[12px] md:text-[13px]" style={{ marginTop: 6 }}>{t('communications.history_empty_sub')}</div>
        </div>
      ) : (
        <>
          {/* ── Cartes empilées — mobile ── */}
          <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
            {logs.map((log) => {
              const s = STATUS_STYLE[log.status] ?? STATUS_STYLE['partial']
              return (
                <div key={log.id} className="rounded-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 14 }}>
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
                  <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 8 }}>{targetSummary(log.target, t)}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message}>
                    {log.message}
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 8 }}>
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>{t('communications.sent_label').replace('{count}', String(log.sentCount))}</span>
                    {log.failedCount > 0 && <span style={{ color: 'var(--red)', marginLeft: 6 }}>· {t('communications.failed_label').replace('{count}', String(log.failedCount))}</span>}
                    <span style={{ color: 'var(--text3)', marginLeft: 6 }}>· {t('communications.recipients_label').replace('{count}', String(log.recipientCount))}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Tableau — desktop ── */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <th key={i} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <br />
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>{CANAL_LABEL[log.channel] ?? log.channel}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)' }}>
                        {targetSummary(log.target, t)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)', maxWidth: 260 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message}>
                          {log.message}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12 }}>
                        <span style={{ color: 'var(--green)', fontWeight: 700 }}>{t('communications.sent_label').replace('{count}', String(log.sentCount))}</span>
                        {log.failedCount > 0 && (
                          <span style={{ color: 'var(--red)', marginLeft: 6 }}>· {t('communications.failed_label').replace('{count}', String(log.failedCount))}</span>
                        )}
                        <br />
                        <span style={{ color: 'var(--text3)' }}>{t('communications.recipients_label').replace('{count}', String(log.recipientCount))}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
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
  )
}
