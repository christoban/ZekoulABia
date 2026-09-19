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

  // Ouvre automatiquement la conversation demandée lors d'un clic sur une notification (in-app ou out-app)
  useEffect(() => {
    const onOpenConversation = (e: Event) => {
      const detail = (e as CustomEvent<{ conversationId?: string }>).detail
      if (detail?.conversationId) {
        setSelectedId(detail.conversationId)
        setNouveauMessage(false)
        setVueMobile('fil')
        setConversations((prev) =>
          prev.map((c) => (c.id === detail.conversationId ? { ...c, unreadCount: 0 } : c))
        )
      }
    }
    window.addEventListener('zekoulabia:open-conversation', onOpenConversation)
    return () => window.removeEventListener('zekoulabia:open-conversation', onOpenConversation)
  }, [])

  // Vérifier si un conversationId a été passé dans l'URL lors d'une arrivée externe / push
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const convId = params.get('conversationId')
      if (convId) {
        setSelectedId(convId)
        setNouveauMessage(false)
        setVueMobile('fil')
      }
    } catch { /* ignore */ }
  }, [])

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
    <div className="messagerie-root" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .messagerie-root {
          --msg-sidebar-w: 340px;
        }

        /* Desktop : grille deux colonnes */
        .messagerie-grid {
          flex: 1;
          display: grid;
          grid-template-columns: var(--msg-sidebar-w) 1fr;
          min-height: 0;
          overflow: hidden;
        }
        .messagerie-pane-liste,
        .messagerie-pane-fil {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        /* Tablette */
        @media (min-width: 769px) and (max-width: 1024px) {
          .messagerie-root { --msg-sidebar-w: 280px; }
        }

        /* Mobile : une seule vue à la fois, comme WhatsApp */
        @media (max-width: 768px) {
          .messagerie-grid {
            display: flex !important;
            flex-direction: column;
          }
          /* Vue liste : on cache le fil */
          .messagerie-grid[data-vue="liste"] .messagerie-pane-fil {
            display: none !important;
          }
          .messagerie-grid[data-vue="liste"] .messagerie-pane-liste {
            display: flex !important;
            flex: 1;
          }
          /* Vue fil : on cache la liste */
          .messagerie-grid[data-vue="fil"] .messagerie-pane-liste {
            display: none !important;
          }
          .messagerie-grid[data-vue="fil"] .messagerie-pane-fil {
            display: flex !important;
            flex: 1;
          }
          /* Pas de bordure droite sur mobile */
          .messagerie-pane-liste {
            border-right: none !important;
          }
        }
      `}</style>

      <div className="messagerie-grid" data-vue={vueMobile}>
        {/* Panneau liste */}
        <div className="messagerie-pane-liste" style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
          <ListeConversations
            conversations={conversations}
            loading={loading}
            selectedId={selectedId}
            currentUser={currentUser}
            onSelect={handleSelect}
            onNewMessage={() => { setNouveauMessage(true); setVueMobile('fil') }}
          />
        </div>

        {/* Panneau fil / nouveau message */}
        <div className="messagerie-pane-fil" style={{ background: 'var(--bg)' }}>
          {nouveauMessage ? (
            <NouveauMessagePrive onCreated={handleCreated} onCancel={() => { setNouveauMessage(false); setVueMobile('liste') }} />
          ) : conversationSelectionnee ? (
            <FilConversation
              conversationId={conversationSelectionnee.id}
              conversation={conversationSelectionnee}
              currentUser={currentUser}
              onBack={() => setVueMobile('liste')}
              onMessageSent={chargerConversations}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text3)', padding: 32 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(16,185,129,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={30} strokeWidth={1.5} style={{ color: 'var(--blue, #2563eb)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {t('messagerie.select_conversation') ?? 'Sélectionnez une conversation'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
                  {t('messagerie.select_conversation_hint') ?? 'Choisissez un contact pour démarrer la discussion'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
