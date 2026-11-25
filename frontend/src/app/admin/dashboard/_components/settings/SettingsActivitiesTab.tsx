'use client'

import type React from 'react'
import { ClipboardList, Search } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  btnSec,
  btnSecCls,
  cardHeader,
  cardHeaderCls,
  cardTitle,
  fieldInputCls,
  fmtDate,
  tdLog,
  tdLogCls,
  thLog,
  thLogCls,
  type ActivityLog,
  type AIActionAuditEntry,
  type TimelineEntry,
} from './types'

interface SettingsActivitiesTabProps {
  timelineData: TimelineEntry[] | null
  timelineLoading: boolean
  actSearchInput: string
  setActSearchInput: (v: string) => void
  setActSearch: (v: string) => void
  setActPage: React.Dispatch<React.SetStateAction<number>>
  actData: { logs: ActivityLog[]; page: number; pages: number; total: number } | null
  actLoading: boolean
  aiAuditData: { entries: AIActionAuditEntry[]; total: number } | null
  aiAuditLoading: boolean
  aiAuditOutcome: '' | 'SUCCES' | 'REFUSE' | 'ERREUR'
  setAiAuditOutcome: (v: '' | 'SUCCES' | 'REFUSE' | 'ERREUR') => void
}

export default function SettingsActivitiesTab(props: SettingsActivitiesTabProps) {
  const t = useT('admin')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Frise chronologique unifiée */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <ClipboardList size={15} /> Frise chronologique — Activités · IA · Emails
          </span>
        </div>
        {props.timelineLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
            <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
          </div>
        )}
        {!props.timelineLoading && props.timelineData && props.timelineData.length === 0 && (
          <div className="text-xs md:text-[13.5px]" style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)' }}>Aucun événement récent</div>
        )}
        {!props.timelineLoading && props.timelineData && props.timelineData.length > 0 && (
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {props.timelineData.map((entry, i) => (
              <div key={entry.id} style={{ display: 'flex', gap: 10, padding: '7px 12px', borderBottom: i < props.timelineData!.length - 1 ? '1px solid var(--bg)' : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: entry.type === 'ACTIVITY' ? 'var(--green)' : entry.type === 'AI_ACTION' ? 'var(--amber)' : 'var(--blue)', minWidth: 50 }}>{entry.type}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text3)', whiteSpace: 'nowrap', minWidth: 105 }}>{new Date(entry.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.details ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          placeholder={t('settings.activities.search_placeholder')}
          value={props.actSearchInput}
          onChange={e => props.setActSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { props.setActSearch(props.actSearchInput); props.setActPage(1) } }}
          className={fieldInputCls}
          style={{ flex: 1, background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
        />
        <button className={btnSecCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center' }} onClick={() => { props.setActSearch(props.actSearchInput); props.setActPage(1) }}>
          <Search size={13} strokeWidth={2} />
        </button>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <ClipboardList size={15} /> {t('settings.activities.title')}
          </span>
          {props.actData && <span className="text-[11.5px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('settings.activities.entries_count').replace('{count}', String(props.actData.total))}</span>}
        </div>
        {props.actLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
          </div>
        )}
        {!props.actLoading && props.actData && props.actData.logs.length === 0 && (
          <div className="text-xs md:text-[13.5px]" style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)' }}>{t('settings.activities.no_activities')}</div>
        )}
        {!props.actLoading && props.actData && props.actData.logs.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thLogCls} style={thLog}>{t('settings.activities.table_headers.0')}</th>
                  <th className={thLogCls} style={thLog}>{t('settings.activities.table_headers.1')}</th>
                  <th className={thLogCls} style={thLog}>{t('settings.activities.table_headers.2')}</th>
                  <th className={thLogCls} style={thLog}>{t('settings.activities.table_headers.3')}</th>
                </tr>
              </thead>
              <tbody>
                {props.actData.logs.map((log, i) => (
                  <tr key={log.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                    <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                    <td className={tdLogCls} style={tdLog}><span style={{ fontWeight: 700, color: 'var(--text)' }}>{log.action}</span></td>
                    <td className={tdLogCls} style={{ ...tdLog, maxWidth: 320, wordBreak: 'break-word' }}>{log.description}</td>
                    <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{log.user ? `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim() || '—' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {props.actData && (
          <div className="px-3.5 py-2 md:px-4 md:py-2.5" style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span className="text-[11.5px] md:text-xs" style={{ color: 'var(--text3)' }}>
              {t('settings.activities.page_info').replace('{current}', String(props.actData.page)).replace('{total}', String(props.actData.pages))}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={btnSecCls} style={{ ...btnSec, opacity: props.actData.page <= 1 ? 0.45 : 1 }} disabled={props.actData.page <= 1} onClick={() => props.setActPage(p => p - 1)}>{t('settings.activities.btn_prev')}</button>
              <button className={btnSecCls} style={{ ...btnSec, opacity: props.actData.page >= props.actData.pages ? 0.45 : 1 }} disabled={props.actData.page >= props.actData.pages} onClick={() => props.setActPage(p => p + 1)}>{t('settings.activities.btn_next')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Journal Sécurité IA */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={{ ...cardHeader, flexWrap: 'wrap', gap: 8 }}>
          <span className="text-[13px] md:text-[15px]" style={{ ...cardTitle, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <ClipboardList size={15} /> Journal Sécurité IA
          </span>
          <select
            value={props.aiAuditOutcome}
            onChange={e => props.setAiAuditOutcome(e.target.value as '' | 'SUCCES' | 'REFUSE' | 'ERREUR')}
            style={{ padding: '4px 10px', borderRadius: 7, border: '1.5px solid var(--border2)', fontSize: 12, fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit', background: 'var(--bg2)' }}
          >
            <option value="">Tous les résultats</option>
            <option value="REFUSE">Refusées</option>
            <option value="ERREUR">Erreurs</option>
            <option value="SUCCES">Réussies</option>
          </select>
        </div>
        <div className="px-3.5 py-1.5 md:px-4" style={{ fontSize: 12, color: 'var(--text3)' }}>
          Actions sensibles exécutées via le copilot IA ou leur équivalent en interface classique, pour cet établissement uniquement.
        </div>
        {props.aiAuditLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
          </div>
        )}
        {!props.aiAuditLoading && props.aiAuditData && props.aiAuditData.entries.length === 0 && (
          <div className="text-xs md:text-[13.5px]" style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)' }}>Aucune entrée pour ce filtre</div>
        )}
        {!props.aiAuditLoading && props.aiAuditData && props.aiAuditData.entries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thLogCls} style={thLog}>Date</th>
                  <th className={thLogCls} style={thLog}>Action</th>
                  <th className={thLogCls} style={thLog}>Origine</th>
                  <th className={thLogCls} style={thLog}>Résultat</th>
                  <th className={thLogCls} style={thLog}>Rôle</th>
                  <th className={thLogCls} style={thLog}>Motif</th>
                </tr>
              </thead>
              <tbody>
                {props.aiAuditData.entries.map((log, i) => (
                  <tr key={log.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                    <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.timestamp)}</td>
                    <td className={tdLogCls} style={tdLog}><span style={{ fontWeight: 700, color: 'var(--text)' }}>{log.actionName}</span></td>
                    <td className={tdLogCls} style={tdLog}>{log.origin === 'AI_ASSISTANT' ? 'Copilot IA' : 'Interface classique'}</td>
                    <td className={tdLogCls} style={tdLog}>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: log.outcome === 'SUCCES' ? 'var(--green-light)' : log.outcome === 'REFUSE' ? 'var(--red-light)' : 'var(--orange-light)', color: log.outcome === 'SUCCES' ? 'var(--green)' : log.outcome === 'REFUSE' ? 'var(--red)' : 'var(--orange)' }}>
                        {log.outcome === 'SUCCES' ? 'Réussie' : log.outcome === 'REFUSE' ? 'Refusée' : 'Erreur'}
                      </span>
                    </td>
                    <td className={tdLogCls} style={tdLog}>{log.actorRole}</td>
                    <td className={tdLogCls} style={{ ...tdLog, maxWidth: 260, wordBreak: 'break-word', color: 'var(--text3)', fontSize: 12 }}>{log.refusalReason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
