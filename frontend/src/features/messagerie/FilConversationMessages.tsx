'use client'

import type { RefObject } from 'react'
import { Check, CheckCheck, AlertCircle, Smile } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { ConversationSummary, DisplayMessage } from './types'
import { formatHeureMessage, getRoleBadge, groupParJour } from './filConversationHelpers'

interface FilConversationMessagesProps {
  loading: boolean
  messages: DisplayMessage[]
  conversation: ConversationSummary | undefined
  currentUserId: string
  finRef: RefObject<HTMLDivElement | null>
}

export function FilConversationMessages({
  loading,
  messages,
  conversation,
  currentUserId,
  finRef,
}: FilConversationMessagesProps) {
  const t = useT('common')

  const statutIcone = (message: DisplayMessage) => {
    if (message.status === 'PENDING') {
      return (
        <span title={t('messagerie.sent_offline_guardian') ?? "Envoyé (acheminement automatique par le gardien)"} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Check size={12} className="msg-time-sent" style={{ opacity: 0.75 }} />
        </span>
      )
    }
    if (message.status === 'FAILED') return <AlertCircle size={12} color="var(--red)" />
    const isRead = message.isRead || (Array.isArray(message.readStatuses) && message.readStatuses.some((r) => r.userId !== currentUserId))
    if (isRead) {
      return (
        <span title="Lu" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <CheckCheck size={14} color="#53bdeb" />
        </span>
      )
    }
    return (
      <span title="Envoyé" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Check size={12} className="msg-time-sent" style={{ opacity: 0.95 }} />
      </span>
    )
  }

  const groupes = groupParJour(messages)

  return (
    <div className="msg-chat-wallpaper" style={{
      flex: 1, overflowY: 'auto', padding: '12px 12px 8px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      {loading && messages.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 40 }}>
          <div className="animate-pulse" style={{ width: 32, height: 32, margin: '0 auto 12px', borderRadius: '50%', background: 'var(--border)' }} />
          {t('messagerie.loading') ?? 'Chargement...'}
        </div>
      ) : messages.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 40 }}>
          <Smile size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          {t('messagerie.no_message_yet') ?? 'Commencez la conversation !'}
        </div>
      ) : groupes.map((groupe) => (
        <div key={groupe.date}>
          {/* Séparateur de date */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0 12px' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text2)',
              background: 'var(--surface)', padding: '3px 12px',
              borderRadius: 8, border: '1px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              {groupe.date}
            </span>
          </div>

          {groupe.messages.map((message) => {
            const estMoi = message.senderId === currentUserId
            const rejete = message.moderationStatus === 'REJECTED'
            const enAttente = message.moderationStatus === 'PENDING'
            const senderObj = message.sender || conversation?.participants?.find(p => p.id === message.senderId)
            const senderName = !estMoi && senderObj ? `${senderObj.firstName} ${senderObj.lastName}`.trim() : null
            const roleBadge = senderObj ? getRoleBadge(senderObj.role, senderObj.staffTitle) : null

            return (
              <div key={message.id} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: estMoi ? 'flex-end' : 'flex-start',
                marginBottom: 4, maxWidth: '100%',
              }}>
                {senderName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 2, marginLeft: 8 }}>
                    <span>{senderName}</span>
                    {roleBadge && (
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        background: roleBadge.bg, color: roleBadge.color,
                      }}>
                        {roleBadge.label}
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={estMoi ? 'msg-bubble-sent' : 'msg-bubble-received'}
                  style={{
                    maxWidth: 'min(85%, 420px)', padding: '8px 12px 6px',
                    borderRadius: estMoi ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: 13.5, lineHeight: 1.45,
                    opacity: rejete ? 0.55 : 1,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    wordBreak: 'break-word',
                  }}
                >
                  <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                  {rejete && (
                    <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 4, fontStyle: 'italic', fontWeight: 600 }}>
                      {t('messagerie.rejected') ?? 'Refusé par la modération'}{message.moderationReason ? ` — ${message.moderationReason}` : ''}
                    </div>
                  )}
                  {enAttente && !rejete && (
                    <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 4, fontStyle: 'italic', fontWeight: 600 }}>
                      {t('messagerie.pending_moderation') ?? 'En attente de modération'}
                    </div>
                  )}
                  {/* Heure + statut en bas à droite */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: 4, marginTop: 2,
                  }}>
                    <span className={estMoi ? 'msg-time-sent' : 'msg-time-received'} style={{ fontSize: 10, fontWeight: 500 }}>
                      {formatHeureMessage(message.createdAt)}
                    </span>
                    {estMoi && statutIcone(message)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}
      <div ref={finRef} />
    </div>
  )
}

