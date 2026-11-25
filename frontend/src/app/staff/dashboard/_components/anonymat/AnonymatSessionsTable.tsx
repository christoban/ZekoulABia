'use client'

import type React from 'react'
import { CheckCircle, Edit, Key, Loader2, Users } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS, type SessionRow } from './anonymatTypes'

interface Props {
  sessions: SessionRow[]
  loading: boolean
  selected: SessionRow | null
  busyAction: boolean
  generatingId: string | null
  onSelect: (s: SessionRow | null) => void
  onGenerateCodes: (sessionId: string, classIds: string[]) => void
  onOpenTeam: (session: SessionRow) => void
  onOpenCorrection: (session: SessionRow) => void
  onReconcile: (sessionId: string) => void
}

export default function AnonymatSessionsTable({
  sessions,
  loading,
  selected,
  busyAction,
  generatingId,
  onSelect,
  onGenerateCodes,
  onOpenTeam,
  onOpenCorrection,
  onReconcile,
}: Props) {
  const getActions = (session: SessionRow) => {
    const actions: Array<{ label: string; onClick: () => void; icon: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' }> = []
    if (session.anonymatStatus === 'NONE' && session.isAnonymized) {
      actions.push({
        label: 'Générer les codes',
        icon: <Key size={16} />,
        onClick: () => onGenerateCodes(session.id, [session.classId]),
        variant: 'primary',
      })
    }
    if (['CODES_GENERES', 'EQUIPE_DESIGNEE'].includes(session.anonymatStatus)) {
      actions.push({
        label: "Désigner l'équipe",
        icon: <Users size={16} />,
        onClick: () => onOpenTeam(session),
        variant: 'secondary',
      })
    }
    if (session.anonymatStatus === 'ANONYMISATION_TERMINEE') {
      actions.push({
        label: 'Assigner correction',
        icon: <Edit size={16} />,
        onClick: () => onOpenCorrection(session),
        variant: 'primary',
      })
    }
    if (session.anonymatStatus === 'CORRECTION_TERMINEE') {
      actions.push({
        label: 'Réconcilier',
        icon: <CheckCircle size={16} />,
        onClick: () => onReconcile(session.id),
        variant: 'primary',
      })
    }
    if (session.anonymatStatus === 'RECONCILIE') {
      actions.push({
        label: 'Terminé',
        icon: <CheckCircle size={16} />,
        onClick: () => {},
        variant: 'secondary',
      })
    }
    return actions
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="text-[var(--primary)] animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-[var(--text3)] text-xs">
          Aucune session trouvée. Créez votre première session ci-dessus.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                <th className="text-left px-2.5 py-2 text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider">Session</th>
                <th className="text-left px-2.5 py-2 text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider">Classe</th>
                <th className="text-left px-2.5 py-2 text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider">Matière</th>
                <th className="text-left px-2.5 py-2 text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider">Date</th>
                <th className="text-left px-2.5 py-2 text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider">Statut</th>
                <th className="text-left px-2.5 py-2 text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider">Anonymat</th>
                <th className="text-left px-2.5 py-2 text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  style={{ borderBottom: '1px solid var(--border)', background: selected?.id === session.id ? 'var(--bg2)' : 'transparent' }}
                  onClick={() => onSelect(selected?.id === session.id ? null : session)}
                >
                  <td className="px-2.5 py-2 text-xs font-mono text-[var(--text)]">{session.id.slice(0, 8)}…</td>
                  <td className="px-2.5 py-2 text-xs font-medium text-[var(--text)]">{session.className || session.classId}</td>
                  <td className="px-2.5 py-2 text-xs text-[var(--text)]">{session.subjectName || session.subjectId}</td>
                  <td className="px-2.5 py-2 text-xs text-[var(--text3)]">{new Date(session.scheduledDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-2.5 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${session.status === 'PLANNED' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300' : session.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-success/20 text-success'}`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[session.anonymatStatus] || STATUS_COLORS.NONE}`}>
                      {STATUS_LABELS[session.anonymatStatus] || session.anonymatStatus}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-xs">
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {getActions(session).map((action, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); action.onClick() }}
                          disabled={generatingId === session.id || busyAction}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            action.variant === 'primary'
                              ? 'bg-[var(--primary)] text-white hover:opacity-90'
                              : action.variant === 'danger'
                              ? 'bg-red-500/20 text-red-600 dark:text-red-300 hover:bg-red-500/30'
                              : 'bg-[var(--bg2)] text-[var(--text)] hover:bg-[var(--border)]'
                          }`}
                        >
                          {action.icon}
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
