'use client'

import { MessageCircle, User, Users, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { ContactUser, ConversationSummary } from './types'
import { avatarColor, roleLabel, type RoleBadge } from './filConversationHelpers'

interface MembersPanelProps {
  conversation: ConversationSummary | undefined
  currentUserId: string
  peutEnvoyerDM: boolean
  onClose: () => void
  onStartPrivateChat?: (member: {
    id: string
    firstName?: string
    lastName?: string
    role?: string
    staffTitle?: string | null
  }) => void
}

export function MembersPanel({
  conversation,
  currentUserId,
  peutEnvoyerDM,
  onClose,
  onStartPrivateChat,
}: MembersPanelProps) {
  const t = useT('common')

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ flex: 1, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
      />
      {/* Panel */}
      <div style={{
        width: 320, maxWidth: '85vw', background: 'var(--surface)',
        borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.2s ease-out',
      }}>
        {/* Panel header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {t('messagerie.members') ?? 'Membres'}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, background: 'var(--bg2)', color: 'var(--text3)',
              padding: '2px 8px', borderRadius: 10,
            }}>
              {conversation?.participants?.length ?? 0}
            </span>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 8 }}
          >
            <X size={18} />
          </button>
        </div>
        {/* Member list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {(conversation?.participants ?? []).map((member) => {
            const isSelf = member.id === currentUserId
            const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`.toUpperCase()
            return (
              <div key={member.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                transition: 'background 0.1s',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: avatarColor(member.id),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 800, fontSize: 12,
                }}>
                  {initials}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.firstName} {member.lastName}
                    {isSelf && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400, marginLeft: 4 }}>(vous)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {roleLabel(member.role, member.staffTitle)}
                  </div>
                </div>
                {/* Bouton DM — masqué pour STUDENT et pour soi-même */}
                {peutEnvoyerDM && !isSelf && onStartPrivateChat && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onStartPrivateChat(member)
                    }}
                    title={t('messagerie.write_private') ?? 'Écrire en privé'}
                    style={{
                      border: 'none', background: 'rgba(37,99,235,0.1)', color: 'var(--blue, #2563eb)',
                      padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s',
                    }}
                  >
                    <MessageCircle size={12} />
                    {t('messagerie.dm_short') ?? 'MP'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface ContactProfilePanelProps {
  participant: ContactUser
  badge: RoleBadge | null
  onClose: () => void
}

export function ContactProfilePanel({ participant, badge, onClose }: ContactProfilePanelProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div style={{
        width: 320, maxWidth: '85vw', background: 'var(--surface)',
        borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.2s ease-out',
      }}>
        {/* Panel header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              Profil du contact
            </span>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 8 }}
          >
            <X size={18} />
          </button>
        </div>
        {/* Contact Details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: '0 auto 14px',
            background: avatarColor(participant.id),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 22,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}>
            {`${participant.firstName?.[0] ?? ''}${participant.lastName?.[0] ?? ''}`.toUpperCase()}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
            {participant.firstName} {participant.lastName}
          </div>
          {badge && (
            <div style={{ display: 'inline-flex', marginBottom: 20 }}>
              <span style={{
                fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                background: badge.bg, color: badge.color,
              }}>
                {badge.label}
              </span>
            </div>
          )}

          <div style={{
            background: 'var(--bg2)', borderRadius: 14, padding: '14px 16px',
            textAlign: 'left', fontSize: 12.5, color: 'var(--text)',
            display: 'flex', flexDirection: 'column', gap: 10,
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text3)' }}>Rôle scolaire</span>
              <span style={{ fontWeight: 700 }}>{roleLabel(participant.role, null)}</span>
            </div>
            {participant.staffTitle && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text3)' }}>Fonction</span>
                <span style={{ fontWeight: 700 }}>{participant.staffTitle}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text3)' }}>Canal</span>
              <span style={{ fontWeight: 600 }}>Message privé direct</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text3)' }}>Statut</span>
              <span style={{ fontWeight: 700, color: 'var(--green)' }}>Actif dans l&apos;école</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

