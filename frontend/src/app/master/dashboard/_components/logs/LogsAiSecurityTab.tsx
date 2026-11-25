'use client'

import { Bot, Zap, Info } from 'lucide-react'
import Badge from '../Badge'
import type { AIActionAuditLogDto } from '../../_api'
import { AI_OUTCOME_BADGE, AI_OUTCOME_LABEL, tdStyle, thStyle } from './logsConstants'
import { EmptyRow, MobileEmpty, MobileLogRow } from './LogsTablePrimitives'

interface Props {
  aiLogs: AIActionAuditLogDto[]
  loading: boolean
  outcomeFilter: '' | AIActionAuditLogDto['outcome']
  originFilter: '' | AIActionAuditLogDto['origin']
  onOutcomeChange: (v: '' | AIActionAuditLogDto['outcome']) => void
  onOriginChange: (v: '' | AIActionAuditLogDto['origin']) => void
}

/** Onglet Sécurité IA (journal transversal des actions du copilot / interface classique) */
export default function LogsAiSecurityTab({
  aiLogs,
  loading,
  outcomeFilter,
  originFilter,
  onOutcomeChange,
  onOriginChange,
}: Props) {
  const selectStyle = {
    padding: '8px 10px',
    minHeight: 38,
    borderRadius: 9,
    border: '1px solid var(--border)',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text)',
    fontFamily: 'inherit',
    background: 'var(--surface)',
    minWidth: 0,
  } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.28)', borderRadius: 10, fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}>
        <Info size={15} style={{ flexShrink: 0 }} /> Toutes écoles confondues. Concentré par défaut sur les tentatives <strong>refusées</strong> — le détail métier de chaque école reste dans son propre journal (« Journal d&apos;établissement », côté admin).
      </div>

      <div className="grid grid-cols-2 sm:flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        <select
          value={outcomeFilter}
          onChange={e => onOutcomeChange(e.target.value as '' | AIActionAuditLogDto['outcome'])}
          style={selectStyle}
        >
          <option value="">Tous les résultats</option>
          <option value="REFUSE">Refusées</option>
          <option value="ERREUR">Erreurs</option>
          <option value="SUCCES">Réussies</option>
        </select>
        <select
          value={originFilter}
          onChange={e => onOriginChange(e.target.value as '' | AIActionAuditLogDto['origin'])}
          style={selectStyle}
        >
          <option value="">Toute origine</option>
          <option value="AI_ASSISTANT">Copilot IA</option>
          <option value="UI_DIRECT">Interface classique</option>
        </select>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
          Actions sensibles exécutées via le copilot IA ou leur équivalent en interface classique
        </div>
        <div className="block md:hidden">
          {loading
            ? <MobileEmpty msg="Chargement..." />
            : aiLogs.length === 0
              ? <MobileEmpty msg="Aucune entrée pour ce filtre" />
              : aiLogs.map((log, i) => (
                <MobileLogRow
                  key={log.id}
                  last={i === aiLogs.length - 1}
                  badge={<Badge type={AI_OUTCOME_BADGE[log.outcome]}>{AI_OUTCOME_LABEL[log.outcome]}</Badge>}
                  date={new Date(log.timestamp).toLocaleString('fr-CM')}
                  primary={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {log.origin === 'AI_ASSISTANT' ? <Bot size={14} /> : <Zap size={14} />}
                      {log.actionName}
                    </span>
                  }
                  secondary={[log.actorRole, log.schoolId ?? undefined].filter((v): v is string => typeof v === 'string' && v.length > 0).join(' · ')}
                  tertiary={log.refusalReason ?? undefined}
                />
              ))}
        </div>
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                {['Date / Heure', 'Action', 'Origine', 'Résultat', 'Rôle', 'École', 'Motif'].map(h => (
                  <th key={h} style={{ ...thStyle, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <EmptyRow cols={7} msg="Chargement..." />
                : aiLogs.length === 0
                  ? <EmptyRow cols={7} msg="Aucune entrée pour ce filtre" />
                  : aiLogs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: i < aiLogs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString('fr-CM')}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{log.actionName}</td>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {log.origin === 'AI_ASSISTANT' ? <Bot size={14} /> : <Zap size={14} />}
                          {log.origin === 'AI_ASSISTANT' ? 'Copilot IA' : 'Interface classique'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                        <Badge type={AI_OUTCOME_BADGE[log.outcome]}>{AI_OUTCOME_LABEL[log.outcome]}</Badge>
                      </td>
                      <td style={tdStyle}>{log.actorRole}</td>
                      <td style={tdStyle}>{log.schoolId ?? '—'}</td>
                      <td style={{ ...tdStyle, maxWidth: 280, wordBreak: 'break-word', color: 'var(--text3)', fontSize: 13 }}>{log.refusalReason ?? '—'}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
