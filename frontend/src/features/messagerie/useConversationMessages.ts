'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getNotificationSocket } from '@/lib/notificationSocket'
import { putCachedMessage, getCachedMessages, putCachedData, getCachedData } from '@/lib/offline/db'
import { EVENEMENT_MESSAGERIE_NON_LUS_CHANGE } from '@/hooks/useUnreadMessagesCount'
import type { DisplayMessage } from './types'
import { fusionnerMessages } from './filConversationHelpers'

// Cache en mémoire des messages par conversation (persistant lors des changements d'onglets au sein de la session)
const memoryMessagesCache = new Map<string, DisplayMessage[]>()

interface UseConversationMessagesOptions {
  conversationId: string
  currentUserId: string
  onRemoteSettingsUpdated: (announcementsOnly: boolean) => void
  onMessageSent?: () => void
}

export function useConversationMessages({
  conversationId,
  currentUserId,
  onRemoteSettingsUpdated,
  onMessageSent,
}: UseConversationMessagesOptions) {
  const isOnline = useOnlineStatus()
  const { addToQueue, syncQueue } = useSyncQueue()

  const cachedList = memoryMessagesCache.get(conversationId) ?? []
  const [messages, setMessages] = useState<DisplayMessage[]>(cachedList)
  const [loading, setLoading] = useState<boolean>(cachedList.length === 0)

  const finRef = useRef<HTMLDivElement | null>(null)
  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId
  const onRemoteSettingsUpdatedRef = useRef(onRemoteSettingsUpdated)
  onRemoteSettingsUpdatedRef.current = onRemoteSettingsUpdated

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

      // 2. Si hors-ligne, ne pas tenter le réseau et charger directement depuis le cache + outbox
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const [cache, locaux] = await Promise.all([
          getCachedData<DisplayMessage[]>(cleCacheHistorique),
          getCachedMessages(conversationId),
        ])
        const fusion = fusionnerMessages(cache?.data ?? [], locaux as DisplayMessage[])
        memoryMessagesCache.set(conversationId, fusion)
        setMessages(fusion)
        setLoading(false)
        return
      }

      // 3. Si en ligne, tentative réseau avec temporisation de sécurité (3.5s)
      const controller = new AbortController()
      const tId = setTimeout(() => controller.abort(), 3500)

      const [res, locaux] = await Promise.all([
        fetchApi(`/api/v2/messagerie/conversations/${conversationId}/messages`, { signal: controller.signal })
          .then((r) => r.json())
          .catch(() => ({ success: false, data: [] }))
          .finally(() => clearTimeout(tId)),
        getCachedMessages(conversationId),
      ])

      const serveur: DisplayMessage[] = res.success && Array.isArray(res.data) ? res.data : []
      if (serveur.length > 0) {
        const fusion = fusionnerMessages(serveur, locaux as DisplayMessage[])
        memoryMessagesCache.set(conversationId, fusion)
        setMessages(fusion)
        await putCachedData(cleCacheHistorique, serveur).catch(() => {})
      } else {
        const cache = await getCachedData<DisplayMessage[]>(cleCacheHistorique)
        const fusion = fusionnerMessages(cache?.data ?? [], locaux as DisplayMessage[])
        if (fusion.length > 0) {
          memoryMessagesCache.set(conversationId, fusion)
          setMessages(fusion)
        }
      }
    } catch {
      // Hors-ligne ou serveur injoignable : repli propre sur les messages locaux
      const [cache, locaux] = await Promise.all([
        getCachedData<DisplayMessage[]>(cleCacheHistorique),
        getCachedMessages(conversationId),
      ])
      const fusion = fusionnerMessages(cache?.data ?? [], locaux as DisplayMessage[])
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
        setMessages((prev) => fusionnerMessages(payload.data, prev))
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
      if (message.senderId !== currentUserId) marquerCommeLu(message.id)
    }

    const onMessagesRead = (payload: { conversationId: string; readerId: string; readAt: string; messageIds?: string[] }) => {
      if (payload.conversationId !== conversationIdRef.current) return
      if (payload.readerId === currentUserId) return
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId === currentUserId) {
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
      onRemoteSettingsUpdatedRef.current(payload.announcementsOnly)
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
  }, [conversationId, currentUserId, marquerCommeLu, rattraper])

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

  // Écoute des mises à jour de statut de message depuis le gardien de synchronisation hors-ligne
  useEffect(() => {
    const onStatusUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ clientMessageId?: string; status?: 'PENDING' | 'SENT' | 'FAILED' }>).detail
      if (detail?.clientMessageId && detail?.status) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === detail.clientMessageId
              ? { ...m, status: detail.status! }
              : m
          )
        )
      }
    }
    window.addEventListener('zekoulabia:message-status-updated', onStatusUpdated)
    return () => window.removeEventListener('zekoulabia:message-status-updated', onStatusUpdated)
  }, [])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const sendMessage = useCallback(async (content: string, onOptimisticAdded?: () => void) => {
    const clientMessageId = crypto.randomUUID()
    const createdAt = Date.now()

    // 1. Affichage optimiste immédiat façon Facebook / WhatsApp
    const message: DisplayMessage = {
      id: clientMessageId,
      conversationId,
      senderId: currentUserId,
      content,
      createdAt,
      status: 'PENDING',
    }
    await putCachedMessage({ id: clientMessageId, conversationId, senderId: currentUserId, content, createdAt, status: 'PENDING' })
    setMessages((prev) => [...prev, message])
    onOptimisticAdded?.()

    // 2. Enregistrement dans la file de synchro persistante
    await addToQueue({
      type: 'MESSAGE_SEND',
      endpoint: '/api/v2/messagerie/messages',
      method: 'POST',
      payload: { clientMessageId, content, conversationId },
    }).catch(() => {})

    // 3. Déclenchement de la transmission dès qu'une porte réseau est ouverte
    void syncQueue().catch(() => {})
    onMessageSent?.()
  }, [conversationId, currentUserId, addToQueue, syncQueue, onMessageSent])

  return { messages, loading, finRef, sendMessage }
}

