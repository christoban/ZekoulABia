'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, Send, Clock, Check, CheckCheck, AlertCircle, Smile } from 'lucide-react'
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

function initialesConv(conversation: ConversationSummary | undefined, currentUserId: string): string {
  if (!conversation) return '??'
  if (conversation.type === 'PRIVATE') {
    const autre = conversation.participants.find((p) => p.id !== currentUserId)
    if (!autre) return '??'
    return `${autre.firstName?.[0] ?? ''}${autre.lastName?.[0] ?? ''}`.toUpperCase()
  }
  return conversation.name?.[0]?.toUpperCase() ?? '#'
}

function avatarColor(id: string): string {
  const colors = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg,var(--primary),var(--primary-hover))',
    'linear-gradient(135deg, #f59e0b, #f97316)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg,var(--primary),var(--blue))',
    'linear-gradient(135deg, #f97316, #ef4444)',
  ]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function fusionner(serveur: DisplayMessage[], locaux: DisplayMessage[]): DisplayMessage[] {
  const map = new Map<string, DisplayMessage>()
  for (const m of serveur) map.set(m.id, { ...m, status: 'SENT' })
  for (const m of locaux) if (!map.has(m.id)) map.set(m.id, m)
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function formatHeureMessage(dateStr: string | number): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function groupParJour(messages: DisplayMessage[]): { date: string; messages: DisplayMessage[] }[] {
  const groupes: { date: string; messages: DisplayMessage[] }[] = []
  let dernierLabel = ''
  for (const msg of messages) {
    const d = new Date(msg.createdAt)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600 * 24))
    let label: string
    if (diff === 0) label = "Aujourd'hui"
    else if (diff === 1) label = 'Hier'
    else label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    if (label !== dernierLabel) {
      groupes.push({ date: label, messages: [msg] })
      dernierLabel = label
    } else {
      groupes[groupes.length - 1].messages.push(msg)
    }
  }
  return groupes
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
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

  // Curseur mis à jour à chaque changement de la liste affichée
  useEffect(() => {
    const confirmes = messages.filter((m) => m.status !== 'PENDING' && m.status !== 'FAILED')
    if (confirmes.length === 0) return
    const dernier = confirmes[confirmes.length - 1]
    dernierTimestampConfirmeRef.current = typeof dernier.createdAt === 'number'
      ? new Date(dernier.createdAt).toISOString()
      : dernier.createdAt
    putCachedData(cleCacheHistorique, confirmes).catch(() => {})
  }, [messages, cleCacheHistorique])

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
    socket.on('connect', rattraper)

    // Polling doux de secours (4 secondes si onglet actif) + rattrapage immédiat au focus
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

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto'

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
    if (message.status === 'PENDING') return <Clock size={13} color="var(--primary-hover)" />
    if (message.status === 'FAILED') return <AlertCircle size={13} color="#dc2626" />
    const isRead = message.isRead || (Array.isArray(message.readStatuses) && message.readStatuses.some((r) => r.userId !== currentUser.id))
    if (isRead) {
      return (
        <span title="Lu" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <CheckCheck size={15} color="var(--primary)" />
        </span>
      )
    }
    return (
      <span title="Envoyé" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Check size={13} color="var(--primary-hover)" />
      </span>
    )
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    // Auto-resize textarea
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const groupes = groupParJour(messages)
  const convInitiales = initialesConv(conversation, currentUser.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* En-tête conversation */}
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nomAffiche(conversation, currentUser.id)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {conversation?.participants?.length ? `${conversation.participants.length} participant${conversation.participants.length > 1 ? 's' : ''}` : ''}
          </div>
        </div>
      </div>

      {/* Zone de messages — fond WhatsApp-like */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 12px 8px',
        display: 'flex', flexDirection: 'column', gap: 2,
        backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(16,185,129,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(37,99,235,0.04) 0%, transparent 50%)',
        backgroundSize: 'cover',
      }}>
        {loading ? (
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
                fontSize: 11, fontWeight: 700, color: 'var(--text3)',
                background: 'var(--surface)', padding: '3px 12px',
                borderRadius: 8, border: '1px solid var(--border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                {groupe.date}
              </span>
            </div>

            {groupe.messages.map((message) => {
              const estMoi = message.senderId === currentUser.id
              const rejete = message.moderationStatus === 'REJECTED'
              const enAttente = message.moderationStatus === 'PENDING'
              const senderName = !estMoi && message.sender ? `${message.sender.firstName} ${message.sender.lastName}` : null

              return (
                <div key={message.id} style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: estMoi ? 'flex-end' : 'flex-start',
                  marginBottom: 4, maxWidth: '100%',
                }}>
                  {senderName && (
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 2, marginLeft: 8 }}>
                      {senderName}
                    </div>
                  )}
                  <div style={{
                    maxWidth: 'min(85%, 420px)', padding: '8px 12px 6px',
                    borderRadius: estMoi ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: estMoi
                      ? 'linear-gradient(135deg, var(--green-light) 0%, var(--green-light) 100%)'
                      : 'var(--surface)',
                    border: estMoi ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border)',
                    color: estMoi ? '#0f172a' : 'var(--text)', fontSize: 13.5, lineHeight: 1.45,
                    opacity: rejete ? 0.55 : 1,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    wordBreak: 'break-word',
                  }}>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                    {rejete && (
                      <div style={{ fontSize: 10.5, color: estMoi ? '#b91c1c' : 'var(--red)', marginTop: 4, fontStyle: 'italic' }}>
                        {t('messagerie.rejected') ?? 'Refusé par la modération'}{message.moderationReason ? ` — ${message.moderationReason}` : ''}
                      </div>
                    )}
                    {enAttente && !rejete && (
                      <div style={{ fontSize: 10.5, color: estMoi ? '#b45309' : 'var(--amber)', marginTop: 4, fontStyle: 'italic' }}>
                        {t('messagerie.pending_moderation') ?? 'En attente de modération'}
                      </div>
                    )}
                    {/* Heure + statut en bas à droite */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                      gap: 4, marginTop: 2,
                    }}>
                      <span style={{ fontSize: 10, color: estMoi ? 'var(--primary-hover)' : 'var(--text3)' }}>
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

      {/* Zone de saisie — toujours collée en bas */}
      <div style={{
        padding: '8px 10px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-end', gap: 8,
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={handleTextareaInput}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSend() } }}
          placeholder={t('messagerie.write_message') ?? 'Écrire un message...'}
          rows={1}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 20,
            border: '1.5px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit',
            resize: 'none', outline: 'none', lineHeight: 1.4,
            maxHeight: 120, minHeight: 40,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: draft.trim() && !sending
              ? 'linear-gradient(135deg,var(--primary),var(--primary-hover))'
              : 'var(--bg2)',
            color: draft.trim() && !sending ? 'white' : 'var(--text3)',
            cursor: draft.trim() && !sending ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          <Send size={17} style={{ marginLeft: 2 }} />
        </button>
      </div>
    </div>
  )
}
