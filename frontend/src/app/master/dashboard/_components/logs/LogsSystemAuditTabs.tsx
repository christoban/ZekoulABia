'use client'

import Badge from '../Badge'
import type { AuditLogDto } from '../../_types'
import {
  AUTH_LABELS,
  AUTH_BADGE,
  ACTION_LABELS,
  ACTION_ICONS,
  ACTION_BADGE,
  tdStyle,
  thStyle,
} from './logsConstants'
import { EmptyRow, MobileEmpty, MobileLogRow } from './LogsTablePrimitives'

/** Onglet Authentification (connexions, OTP, MFA) */
export function LogsAuthTab({ logs, loading }: { logs: AuditLogDto[]; loading: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
        Connexions, OTP, MFA — toutes les tentatives d&apos;authentification du compte master
      </div>
      <div className="block md:hidden">
        {loading
          ? <MobileEmpty msg="Chargement..." />
          : logs.length === 0
            ? <MobileEmpty msg="Aucun log d'authentification" />
            : logs.map((log, i) => (
              <MobileLogRow
                key={log.id}
                last={i === logs.length - 1}
                badge={<Badge type={AUTH_BADGE[log.action] ?? 'event-info'}>{AUTH_LABELS[log.action] ?? log.action}</Badge>}
                date={new Date(log.createdAt).toLocaleString('fr-CM')}
                primary={log.masterUser?.email ?? log.description ?? '—'}
                secondary={log.ipAddress ? `IP ${log.ipAddress}` : undefined}
              />
            ))}
      </div>
      <div className="hidden md:block" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr>
              {['Date / Heure', 'Événement', 'Compte', 'IP'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? <EmptyRow cols={4} msg="Chargement..." />
              : logs.length === 0
                ? <EmptyRow cols={4} msg="Aucun log d'authentification" />
                : logs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={tdStyle}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                      <Badge type={AUTH_BADGE[log.action] ?? 'event-info'}>
                        {AUTH_LABELS[log.action] ?? log.action}
                      </Badge>
                    </td>
                    <td style={tdStyle}>{log.masterUser?.email ?? log.description ?? '—'}</td>
                    <td style={tdStyle}>{log.ipAddress ?? '—'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Onglet Actions Admin (approbations, rejets, suspensions, invitations) */
export function LogsActionsTab({ logs, loading }: { logs: AuditLogDto[]; loading: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
        Approbations, rejets, suspensions, invitations — toutes les actions décisives sur les écoles
      </div>
      <div className="block md:hidden">
        {loading
          ? <MobileEmpty msg="Chargement..." />
          : logs.length === 0
            ? <MobileEmpty msg="Aucune action enregistrée" />
            : logs.map((log, i) => {
              const Icon = ACTION_ICONS[log.action]
              return (
                <MobileLogRow
                  key={log.id}
                  last={i === logs.length - 1}
                  badge={
                    <Badge type={ACTION_BADGE[log.action] ?? 'event-info'}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {Icon && <Icon size={13} />}
                        {ACTION_LABELS[log.action] ?? log.action.replace('action:', '')}
                      </span>
                    </Badge>
                  }
                  date={new Date(log.createdAt).toLocaleString('fr-CM')}
                  primary={log.description ?? '—'}
                  secondary={log.ipAddress ? `IP ${log.ipAddress}` : undefined}
                />
              )
            })}
      </div>
      <div className="hidden md:block" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr>
              {['Date / Heure', 'Action', 'Détail', 'IP'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? <EmptyRow cols={4} msg="Chargement..." />
              : logs.length === 0
                ? <EmptyRow cols={4} msg="Aucune action enregistrée" />
                : logs.map((log, i) => {
                  const Icon = ACTION_ICONS[log.action]
                  return (
                    <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={tdStyle}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <Badge type={ACTION_BADGE[log.action] ?? 'event-info'}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {Icon && <Icon size={14} />}
                            {ACTION_LABELS[log.action] ?? log.action.replace('action:', '')}
                          </span>
                        </Badge>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 320, wordBreak: 'break-word' }}>{log.description ?? '—'}</td>
                      <td style={tdStyle}>{log.ipAddress ?? '—'}</td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
