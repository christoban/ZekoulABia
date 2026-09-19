'use client'

import { useEffect, useState, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { putCachedData, getCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { getNotificationSocket } from '@/lib/notificationSocket'
import ListeConversations from './ListeConversations'
import FilConversation from './FilConversation'
import NouveauMessagePrive from './NouveauMessagePrive'
import type { ConversationSummary, CurrentUser } from './types'

/**
 * Composant autonome, sans props requises — lit sa propre session depuis localStorage, comme
 * NotificationCenter. Évite de dépendre de la forme (différente selon les 5 dashboards) de
 * l'état utilisateur local de chaque page ; ne demande qu'un seul point d'intégration partout :
 * `<Messagerie />`.
 */
export default function Messagerie() {
  const t = useT('common')
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [vueMobile, setVueMobile] = useState<'liste' | 'fil'>('liste')
  const [nouveauMessage, setNouveauMessage] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const parsed = JSON.parse(raw) as { userId: string; role: string }
        setCurrentUser({ id: parsed.userId, role: parsed.role })
      }
    } catch { /* silencieux — la messagerie reste vide plutôt que casser le dashboard */ }
  }, [])

  const chargerConversations = useCallback(async () => {
    if (!currentUser) return
    const cleCache = `messagerie:conversations:${currentUser.id}`
    try {
      const res = await fetchApi('/api/v2/messagerie/conversations')
      const payload = await res.json()
      if (payload.success) {
        setConversations(payload.data ?? [])
        await putCachedData(cleCache, payload.data ?? [])
      }
    } catch {
      // Hors-ligne ou serveur injoignable — dernière liste connue plutôt qu'un écran vide,
      // même garantie que le reste de l'app via useCachedFetch.
      const cache = await getCachedData<ConversationSummary[]>(cleCache)
      if (cache) setConversations(cache.data)
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => { if (currentUser) chargerConversations() }, [currentUser, chargerConversations])

  useEffect(() => {
    if (!currentUser) return
    const socket = getNotificationSocket()

    const onNouveauMessage = (msg: { id: string; conversationId: string; senderId: string; content: string; createdAt: string | number }) => {
      const dateIso = typeof msg.createdAt === 'number' ? new Date(msg.createdAt).toISOString() : String(msg.createdAt)
      setConversations((prev) => {
        const existe = prev.some((c) => c.id === msg.conversationId)
        if (!existe) {
          void chargerConversations()
          return prev
        }
        return prev.map((c) => {
          if (c.id === msg.conversationId) {
            const estDansCeFil = selectedId === c.id
            return {
              ...c,
              lastMessage: {
                id: msg.id,
                content: msg.content,
                createdAt: dateIso,
                senderId: msg.senderId,
              },
              unreadCount: estDansCeFil ? 0 : c.unreadCount + 1,
            }
          }
          return c
        }).sort((a, b) => {
          const tA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0
          const tB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0
          return tB - tA
        })
      })
    }

    const onMessagesRead = (payload: { conversationId: string; readerId: string }) => {
      if (payload.readerId === currentUser.id) {
        setConversations((prev) =>
          prev.map((c) => (c.id === payload.conversationId ? { ...c, unreadCount: 0 } : c))
        )
      }
    }

    socket.on('message:new', onNouveauMessage)
    socket.on('messages:read', onMessagesRead)

    return () => {
      socket.off('message:new', onNouveauMessage)
      socket.off('messages:read', onMessagesRead)
    }
  }, [currentUser, selectedId, chargerConversations])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setNouveauMessage(false)
    setVueMobile('fil')
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
  }

  const handleCreated = (conversationId: string) => {
    setNouveauMessage(false)
    setSelectedId(conversationId)
    setVueMobile('fil')
    chargerConversations()
  }

  if (!currentUser) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
        {t('messagerie.loading') ?? 'Chargement...'}
      </div>
    )
  }

  const conversationSelectionnee = conversations.find((c) => c.id === selectedId)

  return (
    <div
      className="messagerie-shell"
      data-vue={vueMobile}
      style={{ height: '100%', display: 'grid', gridTemplateColumns: '300px 1fr', background: 'var(--bg)', borderRadius: 18, border: '1.5px solid var(--border)', overflow: 'hidden' }}
    >
      <style>{`
        @media (max-width: 720px) {
          .messagerie-shell { display: block !important; }
          .messagerie-shell[data-vue="liste"] .messagerie-pane-fil { display: none !important; }
          .messagerie-shell[data-vue="fil"] .messagerie-pane-liste { display: none !important; }
        }
      `}</style>
      <div className="messagerie-pane-liste" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ListeConversations
          conversations={conversations}
          loading={loading}
          selectedId={selectedId}
          currentUser={currentUser}
          onSelect={handleSelect}
          onNewMessage={() => { setNouveauMessage(true); setVueMobile('fil') }}
        />
      </div>

      <div className="messagerie-pane-fil" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {nouveauMessage ? (
          <NouveauMessagePrive onCreated={handleCreated} onCancel={() => setNouveauMessage(false)} />
        ) : conversationSelectionnee ? (
          <FilConversation
            conversationId={conversationSelectionnee.id}
            conversation={conversationSelectionnee}
            currentUser={currentUser}
            onBack={() => setVueMobile('liste')}
            onMessageSent={chargerConversations}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text3)' }}>
            <MessageCircle size={32} />
            <div style={{ fontSize: 13.5 }}>{t('messagerie.select_conversation') ?? 'Sélectionnez une conversation'}</div>
          </div>
        )}
      </div>
    </div>
  )
}
