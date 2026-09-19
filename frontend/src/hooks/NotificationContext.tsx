'use client'

/**
 * État de notification partagé — une seule source de vérité consommée à la fois par la
 * cloche (NotificationBell, présente sur tous les dashboards) et par le centre de
 * notifications complet (NotificationCenter, page dédiée). Avant ce fichier, chacun avait son
 * propre état local (useInAppNotifications / useNotificationCenter) : marquer tout comme lu
 * depuis la page dédiée ne mettait jamais à jour le compteur de la cloche ailleurs dans
 * l'application, jusqu'au prochain rechargement ou la prochaine notification live — même
 * défaut que deux systèmes qui représentent le même état sans être reliés, déjà rencontré et
 * corrigé ailleurs dans ce projet (AcademicEvent / LV2ChoiceWindow).
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getNotificationSocket } from '@/lib/notificationSocket'
import { playNotificationSound } from '@/lib/notificationSound'
import { markNotificationDelivered } from '@/lib/markNotificationDelivered'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  metadata?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

interface NotificationContextValue {
  /** 30 dernières notifications, plus récentes en premier — alimente le menu déroulant de la cloche. */
  recentNotifications: AppNotification[]
  unreadCount: number
  /**
   * Vrai si l'utilisateur a déjà "vu" les notifications non lues actuelles (cloche ouverte, ou
   * page dédiée visitée) — repasse à faux dès qu'une NOUVELLE notification non lue arrive en
   * direct, même si l'utilisateur avait déjà tout vu avant. Pilote l'animation de la cloche.
   */
  hasSeen: boolean
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  /** Appelé par la cloche à l'ouverture, ou par le centre de notifications au montage. */
  registerSeen: () => void
  /**
   * Permet à un consommateur qui fait sa propre requête serveur (ex. useNotificationCenter,
   * qui filtre/pagine) de resynchroniser le compteur partagé avec la valeur faisant autorité
   * renvoyée par le serveur à cet instant — jamais de dérive entre les deux surfaces.
   */
  syncUnreadCount: (n: number) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [recentNotifications, setRecentNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  // true = neutre (pas d'animation) tant qu'on ne sait pas encore s'il y a du non-lu ; passe à
  // false dès que le chargement initial révèle des notifications non lues — une session qui
  // démarre avec du non-lu déjà en attente doit animer la cloche, pas seulement les arrivées
  // live pendant que l'utilisateur est sur la page.
  const [hasSeen, setHasSeen] = useState(true)
  const loadedOnce = useRef(false)

  const loadInitial = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/notifications?limit=30', { credentials: 'include' })
      if (!res.ok) return
      const body = await res.json()
      if (body?.success) {
        setRecentNotifications(body.data.notifications ?? [])
        const initialUnread = body.data.unreadCount ?? 0
        setUnreadCount(initialUnread)
        if (initialUnread > 0) setHasSeen(false)
      }
    } catch { /* silencieux — la cloche reste vide plutôt que casser le dashboard */ }
  }, [])

  useEffect(() => {
    if (loadedOnce.current) return
    loadedOnce.current = true
    loadInitial()

    const socket = getNotificationSocket()
    const onNotification = (n: AppNotification) => {
      setRecentNotifications(prev => [n, ...prev].slice(0, 30))
      if (!n.isRead) {
        setUnreadCount(prev => prev + 1)
        setHasSeen(false)
        playNotificationSound()
      }
      // Ack livraison IN_APP (annule escalade URGENT si applicable) — idempotent
      void markNotificationDelivered(n.id)
    }
    socket.on('notification', onNotification)

    const onConversationRead = (payload: { conversationId: string }) => {
      setRecentNotifications(prev => {
        let reduits = 0
        const updated = prev.map(n => {
          const matchConv = n.metadata && typeof n.metadata === 'object' && (n.metadata as Record<string, unknown>).conversationId === payload.conversationId
          if (matchConv && !n.isRead) {
            reduits++
            return { ...n, isRead: true }
          }
          return n
        })
        if (reduits > 0) {
          setUnreadCount(c => Math.max(0, c - reduits))
        }
        return updated
      })
    }

    const onWindowConvRead = (e: Event) => {
      const custom = e as CustomEvent<{ conversationId?: string }>
      if (custom.detail?.conversationId) {
        onConversationRead({ conversationId: custom.detail.conversationId })
      }
    }

    socket.on('notification:conversation-read', onConversationRead)
    window.addEventListener('messagerie:unread-changed', onWindowConvRead)

    return () => {
      socket.off('notification', onNotification)
      socket.off('notification:conversation-read', onConversationRead)
      window.removeEventListener('messagerie:unread-changed', onWindowConvRead)
    }
  }, [loadInitial])

  const markAsRead = useCallback(async (id: string) => {
    let étaitNonLue = false
    setRecentNotifications(prev => prev.map(n => {
      if (n.id === id && !n.isRead) { étaitNonLue = true; return { ...n, isRead: true } }
      return n
    }))
    setUnreadCount(prev => (étaitNonLue ? Math.max(0, prev - 1) : prev))
    try {
      await fetchApi(`/api/v2/notifications/${id}/read`, { method: 'POST', credentials: 'include' })
    } catch { /* état local déjà mis à jour — resynchronisera au prochain chargement */ }
  }, [])

  const markAllAsRead = useCallback(async () => {
    setRecentNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await fetchApi('/api/v2/notifications/read-all', { method: 'POST', credentials: 'include' })
    } catch { /* idem */ }
  }, [])

  const registerSeen = useCallback(() => setHasSeen(true), [])
  const syncUnreadCount = useCallback((n: number) => setUnreadCount(n), [])

  return (
    <NotificationContext.Provider value={{ recentNotifications, unreadCount, hasSeen, markAsRead, markAllAsRead, registerSeen, syncUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider')
  return ctx
}
