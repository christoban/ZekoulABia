'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import type { ConversationSummary, CurrentUser } from './types'
import { getRoleBadge } from './filConversationHelpers'
import { useConversationMessages } from './useConversationMessages'
import { FilConversationHeader } from './FilConversationHeader'
import { FilConversationMessages } from './FilConversationMessages'
import { FilConversationInput } from './FilConversationInput'
import { ContactProfilePanel, MembersPanel } from './FilConversationPanels'

interface Props {
  conversationId: string
  conversation: ConversationSummary | undefined
  currentUser: CurrentUser
  onBack?: () => void
  onMessageSent?: () => void
  onStartPrivateChat?: (member: { id: string; firstName?: string; lastName?: string; role?: string; staffTitle?: string | null }) => void
}

export default function FilConversation({ conversationId, conversation, currentUser, onBack, onMessageSent, onStartPrivateChat }: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [announcementsOnly, setAnnouncementsOnly] = useState<boolean>(conversation?.announcementsOnly ?? true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)

  useEffect(() => {
    if (conversation?.announcementsOnly !== undefined) {
      setAnnouncementsOnly(conversation.announcementsOnly)
    }
  }, [conversation?.announcementsOnly])

  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const { messages, loading, finRef, sendMessage } = useConversationMessages({
    conversationId,
    currentUserId: currentUser.id,
    onRemoteSettingsUpdated: setAnnouncementsOnly,
    onMessageSent,
  })

  const peutModifierReglages =
    (currentUser.role === 'TEACHER' || currentUser.role === 'ADMIN' || currentUser.role === 'STAFF') &&
    (conversation?.type === 'CLASS_CHANNEL' || conversation?.type === 'PARENT_CHANNEL')

  const isGroupChannel = conversation?.type === 'CLASS_CHANNEL' || conversation?.type === 'PARENT_CHANNEL'
  const otherParticipant = !isGroupChannel ? conversation?.participants?.find(p => p.id !== currentUser.id) : null
  const otherBadge = otherParticipant ? getRoleBadge(otherParticipant.role, otherParticipant.staffTitle) : null
  // STUDENT n'a pas le droit d'initier un DM
  const peutEnvoyerDM = currentUser.role !== 'STUDENT'
  const isStudentLocked = currentUser.role === 'STUDENT' && conversation?.type === 'CLASS_CHANNEL' && announcementsOnly

  const toggleAnnouncementsOnly = async () => {
    if (savingSettings) return
    setSavingSettings(true)
    const nouvelleValeur = !announcementsOnly
    try {
      const res = await fetchApi(`/api/v2/messagerie/conversations/${conversationId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementsOnly: nouvelleValeur }),
      })
      const data = await res.json()
      if (data.success) {
        setAnnouncementsOnly(nouvelleValeur)
      }
    } catch {
      /* silencieux */
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSend = async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      await sendMessage(content, () => {
        setDraft('')
        if (inputRef.current) inputRef.current.style.height = 'auto'
        setSending(false)
      })
    } finally {
      setSending(false)
    }
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    // Auto-resize textarea
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .msg-chat-wallpaper {
          background-color: var(--bg);
          background-image: 
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.04) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(37, 99, 235, 0.04) 0%, transparent 50%);
        }
        :global(.dark) .msg-chat-wallpaper,
        .dark .msg-chat-wallpaper {
          background-color: var(--bg);
          background-image: 
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.07) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(227, 176, 75, 0.04) 0%, transparent 50%);
        }

        .msg-bubble-sent {
          background: #dcf8c6;
          border: 1px solid rgba(46, 125, 50, 0.22);
          color: #111b21 !important;
        }
        :global(.dark) .msg-bubble-sent,
        .dark .msg-bubble-sent {
          background: #005c4b !important;
          border: 1px solid rgba(52, 211, 153, 0.25) !important;
          color: #f1f5f9 !important;
        }

        .msg-bubble-received {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text) !important;
        }
        :global(.dark) .msg-bubble-received,
        .dark .msg-bubble-received {
          background: #251b16 !important;
          border: 1px solid var(--border) !important;
          color: var(--text) !important;
        }

        .msg-time-sent {
          color: #54656f;
        }
        :global(.dark) .msg-time-sent,
        .dark .msg-time-sent {
          color: rgba(241, 245, 249, 0.72) !important;
        }
        .msg-time-received {
          color: var(--text3);
        }
      `}</style>

      <FilConversationHeader
        conversationId={conversationId}
        conversation={conversation}
        currentUserId={currentUser.id}
        announcementsOnly={announcementsOnly}
        savingSettings={savingSettings}
        peutModifierReglages={peutModifierReglages}
        isGroupChannel={isGroupChannel}
        otherParticipant={otherParticipant}
        otherBadge={otherBadge}
        onBack={onBack}
        onOpenMembers={() => setShowMembers(true)}
        onOpenContact={() => setShowContactModal(true)}
        onToggleAnnouncementsOnly={toggleAnnouncementsOnly}
      />

      <FilConversationMessages
        loading={loading}
        messages={messages}
        conversation={conversation}
        currentUserId={currentUser.id}
        finRef={finRef}
      />

      <FilConversationInput
        isStudentLocked={isStudentLocked}
        draft={draft}
        sending={sending}
        inputRef={inputRef}
        onTextareaInput={handleTextareaInput}
        onSend={handleSend}
      />

      {/* ── Panneau des membres (slide-over) ── */}
      {showMembers && isGroupChannel && (
        <MembersPanel
          conversation={conversation}
          currentUserId={currentUser.id}
          peutEnvoyerDM={peutEnvoyerDM}
          onClose={() => setShowMembers(false)}
          onStartPrivateChat={onStartPrivateChat}
        />
      )}

      {/* Panel Profil du contact (pour conversation privée) */}
      {showContactModal && otherParticipant && (
        <ContactProfilePanel
          participant={otherParticipant}
          badge={otherBadge}
          onClose={() => setShowContactModal(false)}
        />
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
