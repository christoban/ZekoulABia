'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, Send, Clock, Check, CheckCheck, AlertCircle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getNotificationSocket } from '@/lib/notificationSocket'
import { putCachedMessage, getCachedMessages, putCachedData, getCachedData } from '@/lib/offline/db'
import { EVENEMENT_MESSAGERIE_NON_LUS_CHANGE } from '@/hooks/useUnreadMessagesCount'
import type { ConversationSummary, CurrentUser, DisplayMessage } from './types'

interface Props {
  conversationId: string
  conversation: ConversationSummary | undefined
  currentUser: CurrentUser
  onBack?: () => void
  onMessageSent?: () => void
}

function nomAffiche(conversation: ConversationSummary | undefined, currentUserId: string): string {
  if (!conversation) return ''
  if (conversation.name) return conversation.name
  if (conversation.type === 'PRIVATE') {
    const autre = conversation.participants.find((p) => p.id !== currentUserId)
    return autre ? `${autre.firstName} ${autre.lastName}` : 'Conversation'
  }
  return 'Conversation'
}

function fusionner(serveur: DisplayMessage[], locaux: DisplayMessage[]): DisplayMessage[] {
  const map = new Map<string, DisplayMessage>()
  for (const m of serveur) map.set(m.id, { ...m, status: 'SENT' })
  for (const m of locaux) if (!map.has(m.id)) map.set(m.id, m)
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export default function FilConversation({ conversationId, conversation, currentUser, onBack, onMessageSent }: Props) {
  const t = useT('common')
  const isOnline = useOnlineStatus()
  const { addToQueue, syncQueue } = useSyncQueue()
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const finRef = useRef<HTMLDivElement | null>(null)
  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId
  // Curseur de rattrapage : timestamp du dernier message CONFIRMÉ par le serveur (jamais un
  // message local optimiste encore PENDING, dont le serveur ignore jusqu'à l'existence).
  const dernierTimestampConfirmeRef = useRef<string | null>(null)

  const marquerCommeLu = useCallback(async (jusquAMessageId?: string) => {
    const currentConvId = conversationIdRef.current
    try {
      await fetchApi(`/api/v2/messagerie/conversations/${currentConvId}/lu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jusquAMessageId ? { jusquAMessageId } : {}),
      })
      window.dispatchEvent(new CustomEvent(EVENEMENT_MESSAGERIE_NON_LUS_CHANGE, {
        detail: { conversationId: currentConvId },
      }))
    } catch { /* silencieux — se resynchronisera au prochain passage en ligne */ }
  }, [])

  // Clé du cache de lecture générique (db.cachedData, le même mécanisme que useCachedFetch
  // utilise pour grades/attendance/etc.) — distincte de db.messages, qui est l'outbox des
  // envois optimistes et n'est JAMAIS alimentée par l'historique reçu du serveur.
  const cleCacheHistorique = `messagerie:messages:${conversationId}`

  const chargerMessages = useCallback(async () => {
    setLoading(true)
    try {
      const [res, locaux] = await Promise.all([
        fetchApi(`/api/v2/messagerie/conversations/${conversationId}/messages`).then((r) => r.json()),
        getCachedMessages(conversationId),
      ])
      const serveur: DisplayMessage[] = res.success ? res.data : []
      const locauxEnCours = locaux.filter((m) => m.status !== 'SENT')
      setMessages(fusionner(serveur, locauxEnCours as DisplayMessage[]))
      await putCachedData(cleCacheHistorique, serveur)
    } catch {
      // Hors-ligne ou serveur injoignable : on retombe sur le dernier historique mis en cache
      // (dernière consultation en ligne de cette conversation), pas sur une liste vide — même
      // garantie que useCachedFetch offre déjà au reste de l'app.
      const [cache, locaux] = await Promise.all([
        getCachedData<DisplayMessage[]>(cleCacheHistorique),
        getCachedMessages(conversationId),
      ])
      setMessages(fusionner(cache?.data ?? [], locaux as DisplayMessage[]))
    } finally {
      setLoading(false)
    }
  }, [conversationId, cleCacheHistorique])

  useEffect(() => { chargerMessages() }, [chargerMessages])

  // Curseur mis à jour à chaque changement de la liste affichée — seuls les messages CONFIRMÉS
  // (chargés depuis le serveur, ou reçus en direct via socket) font avancer le curseur ; un
  // message local encore PENDING/FAILED n'a pas de `createdAt` serveur fiable pour `since=`.
  // Réécrit aussi le cache de lecture à chaque évolution — un message reçu en direct par socket
  // (jamais passé par chargerMessages) doit quand même survivre à un futur passage hors-ligne.
  useEffect(() => {
    const confirmes = messages.filter((m) => m.status !== 'PENDING' && m.status !== 'FAILED')
    if (confirmes.length === 0) return
    const dernier = confirmes[confirmes.length - 1]
    dernierTimestampConfirmeRef.current = typeof dernier.createdAt === 'number'
      ? new Date(dernier.createdAt).toISOString()
      : dernier.createdAt
    putCachedData(cleCacheHistorique, confirmes).catch(() => {})
  }, [messages, cleCacheHistorique])

  // Rattrapage fin à la reconnexion : `since=` ne redemande que ce qui a été manqué plutôt que
  // de recharger toute la page courante — fusionné dans les messages déjà affichés (les entrées
  // locales PENDING/FAILED restent intactes).
  const rattraper = useCallback(async () => {
    const since = dernierTimestampConfirmeRef.current
    if (!since) { await chargerMessages(); return }
    try {
      const res = await fetchApi(`/api/v2/messagerie/conversations/${conversationId}/messages?since=${encodeURIComponent(since)}`)
      const payload = await res.json()
      if (payload.success && Array.isArray(payload.data) && payload.data.length > 0) {
        setMessages((prev) => fusionner(payload.data, prev))
      }
    } catch { /* silencieux — nouvelle tentative à la prochaine reconnexion */ }
  }, [conversationId, chargerMessages])

  useEffect(() => {
    if (isOnline) rattraper()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  useEffect(() => {
    const socket = getNotificationSocket()
    socket.emit('conversation:join', conversationId)

    const onNewMessage = (message: DisplayMessage) => {
      if (message.conversationId !== conversationIdRef.current) return
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, { ...message, status: 'SENT' }]))
      if (message.senderId !== currentUser.id) marquerCommeLu(message.id)
    }

    const onMessagesRead = (payload: { conversationId: string; readerId: string; readAt: string; messageIds?: string[] }) => {
      if (payload.conversationId !== conversationIdRef.current) return
      if (payload.readerId === currentUser.id) return
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId === currentUser.id) {
            if (!payload.messageIds || payload.messageIds.includes(m.id)) {
              return { ...m, isRead: true }
            }
          }
          return m
        })
      )
    }

    socket.on('message:new', onNewMessage)
    socket.on('messages:read', onMessagesRead)
    // Une reconnexion socket (redémarrage serveur, coupure réseau brève) n'est pas forcément
    // accompagnée d'un événement navigateur 'online' — le rattrapage doit couvrir les deux cas.
    socket.on('connect', rattraper)

    // Polling doux de secours (4 secondes si onglet actif) + rattrapage immédiat au focus de la fenêtre
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void rattraper()
    }, 4000)

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') void rattraper()
    }
    document.addEventListener('visibilitychange', onVisibilityOrFocus)
    window.addEventListener('focus', onVisibilityOrFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
      window.removeEventListener('focus', onVisibilityOrFocus)
      socket.emit('conversation:leave', conversationId)
      socket.off('message:new', onNewMessage)
      socket.off('messages:read', onMessagesRead)
      socket.off('connect', rattraper)
    }
  }, [conversationId, currentUser.id, marquerCommeLu, rattraper])

  useEffect(() => {
    if (!loading && messages.length > 0) marquerCommeLu()
  }, [loading, conversationId, messages.length, marquerCommeLu])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    const clientMessageId = crypto.randomUUID()
    const createdAt = Date.now()

    const message: DisplayMessage = { id: clientMessageId, conversationId, senderId: currentUser.id, content, createdAt, status: 'PENDING' }
    await putCachedMessage({ id: clientMessageId, conversationId, senderId: currentUser.id, content, createdAt, status: 'PENDING' })
    setMessages((prev) => [...prev, message])
    setDraft('')

    await addToQueue({
      type: 'MESSAGE_SEND',
      endpoint: '/api/v2/messagerie/messages',
      method: 'POST',
      payload: { clientMessageId, content, conversationId },
    })
    syncQueue()
    onMessageSent?.()
    setSending(false)
  }

  const statutIcone = (message: DisplayMessage) => {
    if (message.status === 'PENDING') return <Clock size={12} color="var(--text3)" />
    if (message.status === 'FAILED') return <AlertCircle size={12} color="var(--red)" />
    const isRead = message.isRead || (Array.isArray(message.readStatuses) && message.readStatuses.some((r) => r.userId !== currentUser.id))
    if (isRead) {
      return (
        <span title="Lu" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <CheckCheck size={14} color="#2563eb" />
        </span>
      )
    }
    return (
      <span title="Envoyé" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Check size={12} color="var(--text3)" />
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack && (
          <button type="button" onClick={onBack} style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'inline-flex' }}>
            <ArrowLeft size={18} />
          </button>
        )}
        <div style={{ fontWeight: 800, color: 'var(--text)' }}>{nomAffiche(conversation, currentUser.id)}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('messagerie.loading') ?? 'Chargement...'}</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('messagerie.no_message_yet') ?? 'Aucun message'}</div>
        ) : messages.map((message) => {
          const estMoi = message.senderId === currentUser.id
          const rejete = message.moderationStatus === 'REJECTED'
          const enAttente = message.moderationStatus === 'PENDING'
          return (
            <div key={message.id} style={{ display: 'flex', flexDirection: 'column', alignItems: estMoi ? 'flex-end' : 'flex-start' }}>
              {!estMoi && message.sender && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 2, marginLeft: 4 }}>
                  {message.sender.firstName} {message.sender.lastName}
                </div>
              )}
              <div style={{
                maxWidth: '70%', padding: '9px 13px', borderRadius: 14,
                background: estMoi ? 'var(--amber-light)' : 'var(--surface)',
                border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13.5, lineHeight: 1.5,
                opacity: rejete ? 0.6 : 1,
              }}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                {rejete && (
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, fontStyle: 'italic' }}>
                    {t('messagerie.rejected') ?? 'Refusé par la modération'}{message.moderationReason ? ` — ${message.moderationReason}` : ''}
                  </div>
                )}
                {enAttente && !rejete && (
                  <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4, fontStyle: 'italic' }}>
                    {t('messagerie.pending_moderation') ?? 'En attente de modération'}
                  </div>
                )}
              </div>
              {estMoi && (
                <div style={{ marginTop: 2, marginRight: 4, color: 'var(--text3)' }}>{statutIcone(message)}</div>
              )}
            </div>
          )
        })}
        <div ref={finRef} />
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1.5px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSend() } }}
          placeholder={t('messagerie.write_message') ?? 'Écrire un message...'}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, borderRadius: 10, border: 'none', background: 'var(--green)', color: 'white', cursor: 'pointer', opacity: !draft.trim() || sending ? 0.6 : 1 }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
