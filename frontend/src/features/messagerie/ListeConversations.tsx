'use client'

import { useState } from 'react'
import { GraduationCap, Users, User, Plus, Search, MessageCircle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { ConversationSummary, CurrentUser } from './types'

interface Props {
  conversations: ConversationSummary[]
  loading: boolean
  selectedId: string | null
  currentUser: CurrentUser
  onSelect: (id: string) => void
  onNewMessage: () => void
}

function nomAffiche(conversation: ConversationSummary, currentUserId: string): string {
  if (conversation.name) return conversation.name
  if (conversation.type === 'PRIVATE') {
    const autre = conversation.participants.find((p) => p.id !== currentUserId)
    return autre ? `${autre.firstName} ${autre.lastName}` : 'Conversation'
  }
  return 'Conversation'
}

function initialesContact(conversation: ConversationSummary, currentUserId: string): string {
  if (conversation.type !== 'PRIVATE') return ''
  const autre = conversation.participants.find((p) => p.id !== currentUserId)
  if (!autre) return '??'
  return `${autre.firstName?.[0] ?? ''}${autre.lastName?.[0] ?? ''}`.toUpperCase()
}

/** Couleur déterministe basée sur l'id */
function avatarColor(id: string): string {
  const colors = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg, #10b981, #34d399)',
    'linear-gradient(135deg, #f59e0b, #f97316)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #14b8a6, #3b82f6)',
    'linear-gradient(135deg, #f97316, #ef4444)',
  ]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function IconeType({ type }: { type: ConversationSummary['type'] }) {
  if (type === 'CLASS_CHANNEL') return <GraduationCap size={14} />
  if (type === 'PARENT_CHANNEL') return <Users size={14} />
  return <User size={14} />
}

function formatHeure(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const jours = Math.floor(diff / (1000 * 3600 * 24))
    if (jours === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (jours === 1) return 'Hier'
    if (jours < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  } catch { return '' }
}

export default function ListeConversations({ conversations, loading, selectedId, currentUser, onSelect, onNewMessage }: Props) {
  const t = useT('common')
  const [recherche, setRecherche] = useState('')

  const filtre = recherche.trim()
    ? conversations.filter((c) => nomAffiche(c, currentUser.id).toLowerCase().includes(recherche.toLowerCase()))
    : conversations

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* En-tête */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
          {t('messagerie.title') ?? 'Messagerie'}
        </div>
        <button
          type="button"
          onClick={onNewMessage}
          title={t('messagerie.new_message') ?? 'Nouveau message'}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white', cursor: 'pointer', transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <Plus size={17} strokeWidth={2.5} />
        </button>
      </div>

      {/* Barre de recherche */}
      <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('messagerie.search_contact') ?? 'Rechercher...'}
            style={{
              width: '100%', padding: '9px 12px 9px 34px', borderRadius: 12,
              border: '1.5px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', fontSize: 13, fontWeight: 500,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Liste */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            <div className="animate-pulse" style={{ width: 32, height: 32, margin: '0 auto 12px', borderRadius: '50%', background: 'var(--border)' }} />
            {t('messagerie.loading') ?? 'Chargement...'}
          </div>
        ) : filtre.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
            <MessageCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <div style={{ fontSize: 13 }}>{recherche ? 'Aucun résultat' : (t('messagerie.empty_list') ?? 'Aucune conversation')}</div>
          </div>
        ) : filtre.map((conversation) => {
          const active = conversation.id === selectedId
          const hasUnread = conversation.unreadCount > 0
          const isPrivate = conversation.type === 'PRIVATE'
          const initiales = initialesContact(conversation, currentUser.id)

          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                padding: '10px 10px', borderRadius: 14, border: 'none', cursor: 'pointer', marginBottom: 2,
                background: active ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg2, rgba(0,0,0,0.04))' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: isPrivate ? avatarColor(conversation.id) : 'var(--bg2)',
                border: isPrivate ? 'none' : '1.5px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isPrivate ? 'white' : 'var(--text3)',
                fontWeight: 800, fontSize: 14, letterSpacing: 0.5,
              }}>
                {isPrivate ? initiales : <IconeType type={conversation.type} />}
              </div>

              {/* Info */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{
                    fontWeight: hasUnread ? 800 : 600, fontSize: 13.5, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {nomAffiche(conversation, currentUser.id)}
                  </span>
                  {conversation.lastMessage?.createdAt && (
                    <span style={{ fontSize: 11, color: hasUnread ? 'var(--green, #10b981)' : 'var(--text3)', fontWeight: hasUnread ? 700 : 500, flexShrink: 0 }}>
                      {formatHeure(conversation.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
                  <span style={{
                    fontSize: 12, color: hasUnread ? 'var(--text)' : 'var(--text3)',
                    fontWeight: hasUnread ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                  }}>
                    {conversation.lastMessage?.content ?? (t('messagerie.no_message_yet') ?? 'Aucun message')}
                  </span>
                  {hasUnread && (
                    <span style={{
                      minWidth: 20, height: 20, borderRadius: 999,
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white', fontSize: 10.5, fontWeight: 800,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 6px', flexShrink: 0,
                    }}>
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
