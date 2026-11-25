'use client'

import { ArrowLeft, Lock, MessageCircle, Users, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { ContactUser, ConversationSummary } from './types'
import { avatarColor, initialesConv, nomAffiche, roleLabel, type RoleBadge } from './filConversationHelpers'

interface FilConversationHeaderProps {
  conversationId: string
  conversation: ConversationSummary | undefined
  currentUserId: string
  announcementsOnly: boolean
  savingSettings: boolean
  peutModifierReglages: boolean
  isGroupChannel: boolean
  otherParticipant: ContactUser | null | undefined
  otherBadge: RoleBadge | null
  onBack?: () => void
  onOpenMembers: () => void
  onOpenContact: () => void
  onToggleAnnouncementsOnly: () => void
}

export function FilConversationHeader({
  conversationId,
  conversation,
  currentUserId,
  announcementsOnly,
  savingSettings,
  peutModifierReglages,
  isGroupChannel,
  otherParticipant,
  otherBadge,
  onBack,
  onOpenMembers,
  onOpenContact,
  onToggleAnnouncementsOnly,
}: FilConversationHeaderProps) {
  const t = useT('common')
  const convInitiales = initialesConv(conversation, currentUserId)

  return (
    <div style={{
      padding: '10px 12px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--surface)', flexShrink: 0,
    }}>
      {onBack && (
        <button type="button" onClick={onBack} className="inline-flex md:hidden" style={{
          border: 'none', background: 'transparent', color: 'var(--text2)',
          cursor: 'pointer', padding: 4, borderRadius: 8,
        }}>
          <ArrowLeft size={20} />
        </button>
      )}
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: avatarColor(conversationId),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 800, fontSize: 13.5,
      }}>
        {convInitiales}
      </div>
      <div
        style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
        onClick={() => {
          if (isGroupChannel) onOpenMembers()
          else if (otherParticipant) onOpenContact()
        }}
        title={isGroupChannel ? "Voir les membres du groupe" : "Voir le profil de l'utilisateur"}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          {nomAffiche(conversation, currentUserId)}
          <ChevronRight size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          {conversation?.type === 'CLASS_CHANNEL' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              color: announcementsOnly ? 'var(--amber)' : 'var(--green)',
              fontWeight: 600,
            }}>
              {announcementsOnly ? <Lock size={11} /> : <MessageCircle size={11} />}
              {announcementsOnly
                ? (t('messagerie.mode_announcements_desc') ?? 'Annonces réservées aux enseignants')
                : (t('messagerie.mode_open_desc') ?? 'Discussion ouverte aux élèves')}
            </span>
          )}
          {isGroupChannel && conversation?.participants?.length ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Users size={11} />
              {conversation.participants.length} membre{conversation.participants.length > 1 ? 's' : ''}
            </span>
          ) : null}
          {!isGroupChannel && otherParticipant && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
              background: otherBadge?.bg ?? 'var(--bg2)',
              color: otherBadge?.color ?? 'var(--text3)',
            }}>
              {otherBadge?.label ?? roleLabel(otherParticipant.role, otherParticipant.staffTitle)}
            </span>
          )}
        </div>
      </div>

      {/* Bouton de contrôle enseignant/admin pour basculer le mode du groupe */}
      {peutModifierReglages && (
        <button
          type="button"
          onClick={onToggleAnnouncementsOnly}
          disabled={savingSettings}
          title={announcementsOnly
            ? (t('messagerie.btn_allow_students_desc') ?? 'Permettre aux élèves de participer')
            : (t('messagerie.btn_lock_students_desc') ?? 'Verrouiller le groupe aux annonces')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)',
            background: announcementsOnly ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.16)',
            color: announcementsOnly ? 'var(--amber)' : 'var(--green)',
            fontSize: 12, fontWeight: 700, cursor: savingSettings ? 'wait' : 'pointer',
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          {announcementsOnly ? <Lock size={13} /> : <MessageCircle size={13} />}
          <span>
            {announcementsOnly
              ? (t('messagerie.btn_open_discussion') ?? 'Ouvrir discussion')
              : (t('messagerie.btn_lock_announcements') ?? 'Verrouiller')}
          </span>
        </button>
      )}
    </div>
  )
}

