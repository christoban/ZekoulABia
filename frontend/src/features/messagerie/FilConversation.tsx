'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, Send, Clock, Check, CheckCheck, AlertCircle, Smile, Lock, MessageCircle, Users, X, ChevronRight } from 'lucide-react'
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
  onStartPrivateChat?: (member: { id: string; firstName?: string; lastName?: string; role?: string; staffTitle?: string | null }) => void
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

/** Libellé du rôle (avec staffTitle pour STAFF) */
function roleLabel(role: string, staffTitle?: string | null): string {
  if (role === 'STAFF' && staffTitle) return staffTitle
  const labels: Record<string, string> = {
    ADMIN: 'Administrateur',
    STAFF: 'Personnel administratif',
    TEACHER: 'Enseignant',
    STUDENT: 'Élève',
    PARENT: 'Parent',
  }
  return labels[role] ?? role
}

// Cache en mémoire des messages par conversation (persistant lors des changements d'onglets au sein de la session)
const memoryMessagesCache = new Map<string, DisplayMessage[]>()

export default function FilConversation({ conversationId, conversation, currentUser, onBack, onMessageSent, onStartPrivateChat }: Props) {
  const t = useT('common')
  const isOnline = useOnlineStatus()
  const { addToQueue, syncQueue } = useSyncQueue()

  const cachedList = memoryMessagesCache.get(conversationId) ?? []
  const [messages, setMessages] = useState<DisplayMessage[]>(cachedList)
  const [loading, setLoading] = useState<boolean>(cachedList.length === 0)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [announcementsOnly, setAnnouncementsOnly] = useState<boolean>(conversation?.announcementsOnly ?? true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showMembers, setShowMembers] = useState(false)

  useEffect(() => {
    if (conversation?.announcementsOnly !== undefined) {
      setAnnouncementsOnly(conversation.announcementsOnly)
    }
  }, [conversation?.announcementsOnly])

  const finRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId
  // Curseur de rattrapage : timestamp du dernier message CONFIRMÉ par le serveur (jamais un
  // message local optimiste encore PENDING, dont le serveur ignore jusqu'à l'existence).
  const dernierTimestampConfirmeRef = useRef<string | null>(null)

  const peutModifierReglages =
    (currentUser.role === 'TEACHER' || currentUser.role === 'ADMIN' || currentUser.role === 'STAFF') &&
    (conversation?.type === 'CLASS_CHANNEL' || conversation?.type === 'PARENT_CHANNEL')

  const isGroupChannel = conversation?.type === 'CLASS_CHANNEL' || conversation?.type === 'PARENT_CHANNEL'
  // STUDENT n'a pas le droit d'initier un DM
  const peutEnvoyerDM = currentUser.role !== 'STUDENT'

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

  const chargerMessages = useCallback(async (silencieux = false) => {
    const aDejaDesMessages = (memoryMessagesCache.get(conversationId)?.length ?? 0) > 0
    if (!silencieux && !aDejaDesMessages) {
      setLoading(true)
    }
    try {
      // 1. Lire d'abord IndexedDB si la mémoire est vide
      if (!aDejaDesMessages) {
        const cache = await getCachedData<DisplayMessage[]>(cleCacheHistorique)
        if (cache?.data && cache.data.length > 0) {
          memoryMessagesCache.set(conversationId, cache.data)
          setMessages(cache.data)
          setLoading(false)
        }
      }

      const [res, locaux] = await Promise.all([
        fetchApi(`/api/v2/messagerie/conversations/${conversationId}/messages`).then((r) => r.json()),
        getCachedMessages(conversationId),
      ])
      const serveur: DisplayMessage[] = res.success ? res.data : []
      const locauxEnCours = locaux.filter((m) => m.status !== 'SENT')
      const fusion = fusionner(serveur, locauxEnCours as DisplayMessage[])
      memoryMessagesCache.set(conversationId, fusion)
      setMessages(fusion)
      await putCachedData(cleCacheHistorique, serveur)
    } catch {
      // Hors-ligne ou serveur injoignable : on retombe sur le dernier historique mis en cache
      const [cache, locaux] = await Promise.all([
        getCachedData<DisplayMessage[]>(cleCacheHistorique),
        getCachedMessages(conversationId),
      ])
      const fusion = fusionner(cache?.data ?? [], locaux as DisplayMessage[])
      memoryMessagesCache.set(conversationId, fusion)
      setMessages(fusion)
    } finally {
      setLoading(false)
    }
  }, [conversationId, cleCacheHistorique])

  useEffect(() => {
    const aDejaDesMessages = (memoryMessagesCache.get(conversationId)?.length ?? 0) > 0
    if (aDejaDesMessages) {
      setMessages(memoryMessagesCache.get(conversationId)!)
      setLoading(false)
      // Rafraîchissement silencieux en tâche de fond (Stale-While-Revalidate)
      chargerMessages(true)
    } else {
      setLoading(true)
      chargerMessages(false)
    }
  }, [conversationId, chargerMessages])

  // Curseur mis à jour à chaque changement de la liste affichée
  useEffect(() => {
    memoryMessagesCache.set(conversationId, messages)
    const confirmes = messages.filter((m) => m.status !== 'PENDING' && m.status !== 'FAILED')
    if (confirmes.length === 0) return
    const dernier = confirmes[confirmes.length - 1]
    dernierTimestampConfirmeRef.current = typeof dernier.createdAt === 'number'
      ? new Date(dernier.createdAt).toISOString()
      : dernier.createdAt
    putCachedData(cleCacheHistorique, confirmes).catch(() => {})
  }, [conversationId, messages, cleCacheHistorique])

  const rattraper = useCallback(async () => {
    const since = dernierTimestampConfirmeRef.current
    if (!since) {
      // Si aucun message n'est encore confirmé, rafraîchir en silence sans spinner
      await chargerMessages(true)
      return
    }
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

    const onSettingsUpdated = (payload: { conversationId: string; announcementsOnly: boolean }) => {
      if (payload.conversationId !== conversationIdRef.current) return
      setAnnouncementsOnly(payload.announcementsOnly)
    }

    socket.on('message:new', onNewMessage)
    socket.on('messages:read', onMessagesRead)
    socket.on('conversation:settings-updated', onSettingsUpdated)
    socket.on('connect', rattraper)

    // Polling doux de secours (12 secondes si onglet actif) + rattrapage immédiat au focus
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void rattraper()
    }, 12000)

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
      socket.off('conversation:settings-updated', onSettingsUpdated)
      socket.off('connect', rattraper)
    }
  }, [conversationId, currentUser.id, marquerCommeLu, rattraper])

  const aMarqueLuPourConvRef = useRef<string | null>(null)
  useEffect(() => {
    aMarqueLuPourConvRef.current = null
  }, [conversationId])

  useEffect(() => {
    if (!loading && messages.length > 0 && aMarqueLuPourConvRef.current !== conversationId) {
      aMarqueLuPourConvRef.current = conversationId
      marquerCommeLu()
    }
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
    if (message.status === 'PENDING') return <Clock size={12} className="msg-time-sent" style={{ opacity: 0.8 }} />
    if (message.status === 'FAILED') return <AlertCircle size={12} color="var(--red)" />
    const isRead = message.isRead || (Array.isArray(message.readStatuses) && message.readStatuses.some((r) => r.userId !== currentUser.id))
    if (isRead) {
      return (
        <span title="Lu" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <CheckCheck size={14} color="#53bdeb" />
        </span>
      )
    }
    return (
      <span title="Envoyé" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Check size={12} className="msg-time-sent" style={{ opacity: 0.8 }} />
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
        <div
          style={{ minWidth: 0, flex: 1, cursor: isGroupChannel ? 'pointer' : 'default' }}
          onClick={() => { if (isGroupChannel) setShowMembers(true) }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            {nomAffiche(conversation, currentUser.id)}
            {isGroupChannel && <ChevronRight size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
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
            {!isGroupChannel && conversation?.participants?.length ? (
              <span>{conversation.participants.length} participant{conversation.participants.length > 1 ? 's' : ''}</span>
            ) : null}
          </div>
        </div>

        {/* Bouton de contrôle enseignant/admin pour basculer le mode du groupe */}
        {peutModifierReglages && (
          <button
            type="button"
            onClick={toggleAnnouncementsOnly}
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

      {/* Zone de messages — fond WhatsApp-like avec support dark/light optimal */}
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
              const estMoi = message.senderId === currentUser.id
              const rejete = message.moderationStatus === 'REJECTED'
              const enAttente = message.moderationStatus === 'PENDING'
              const senderName = !estMoi && message.sender ? `${message.sender.firstName} ${message.sender.lastName}` : null
              const senderRole = message.sender?.role?.toUpperCase()
              let roleBadge: { label: string; bg: string; color: string } | null = null
              if (senderRole === 'TEACHER') {
                roleBadge = { label: t('messagerie.role_teacher') ?? 'Enseignant', bg: 'rgba(59, 130, 246, 0.16)', color: 'var(--blue)' }
              } else if (senderRole === 'ADMIN' || senderRole === 'STAFF') {
                roleBadge = { label: t('messagerie.role_staff') ?? 'Direction', bg: 'rgba(245, 158, 11, 0.16)', color: 'var(--amber)' }
              } else if (senderRole === 'STUDENT') {
                roleBadge = { label: t('messagerie.role_student') ?? 'Élève', bg: 'rgba(16, 185, 129, 0.16)', color: 'var(--green)' }
              }

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

      {/* Zone de saisie — toujours collée en bas (ou bannière si élève bloqué en mode annonces) */}
      {currentUser.role === 'STUDENT' && conversation?.type === 'CLASS_CHANNEL' && announcementsOnly ? (
        <div style={{
          padding: '14px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: 'var(--surface)', flexShrink: 0, color: 'var(--text2)',
          fontSize: 13, fontWeight: 600, textAlign: 'center',
        }}>
          <Lock size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span>
            {t('messagerie.student_announcements_notice') ?? 'Seuls les enseignants et l’administration peuvent envoyer des messages dans ce groupe.'}
          </span>
        </div>
      ) : (
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
      )}
      {/* ── Panneau des membres (slide-over) ── */}
      {showMembers && isGroupChannel && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex',
        }}>
          {/* Backdrop */}
          <div
            onClick={() => setShowMembers(false)}
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
                type="button" onClick={() => setShowMembers(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 8 }}
              >
                <X size={18} />
              </button>
            </div>
            {/* Member list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {(conversation?.participants ?? []).map((member) => {
                const isSelf = member.id === currentUser.id
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
                        {roleLabel(member.role, (member as any).staffTitle)}
                      </div>
                    </div>
                    {/* Bouton DM — masqué pour STUDENT et pour soi-même */}
                    {peutEnvoyerDM && !isSelf && onStartPrivateChat && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMembers(false)
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
