'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from './useCachedFetch'
import { useNotifications, type AppNotification } from './NotificationContext'

export type NotificationTypeFilter = 'ALL' | 'ACADEMIC' | 'ATTENDANCE' | 'COMMUNICATION' | 'FINANCIAL' | 'AI_ALERT' | 'POSITIVE' | 'SYSTEM'
export type NotificationReadFilter = 'ALL' | 'UNREAD' | 'READ'

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

/**
 * Vue paginée/filtrable complète de l'historique (contrairement au NotificationContext partagé,
 * qui ne garde que les 30 dernières en mémoire pour la cloche live). Pas de connexion Socket.io
 * ici — cette vue se recharge à la demande (changement de page/filtre) — mais `markAsRead` et
 * `markAllAsRead` passent par le contexte partagé (un seul appel réseau, un seul état de
 * lecture) pour que le compteur de la cloche reste synchronisé même quand l'action vient d'ici,
 * pas seulement du menu déroulant.
 */
interface NotifData { notifications: AppNotification[]; pagination: Pagination; unreadCount: number }

export function useNotificationCenter() {
  const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>('ALL')
  const [readFilter, setReadFilter] = useState<NotificationReadFilter>('ALL')
  const [page, setPage] = useState(1)
  const { markAsRead: markAsReadShared, markAllAsRead: markAllAsReadShared, syncUnreadCount, registerSeen } = useNotifications()

  // Visiter la page dédiée compte comme « avoir vu » les notifications, au même titre
  // qu'ouvrir le menu déroulant de la cloche — l'animation ne doit pas continuer à s'agiter
  // ailleurs dans l'app alors que l'utilisateur regarde déjà son historique complet ici.
  useEffect(() => { registerSeen() }, [registerSeen])

  const loadFn = useCallback(async (): Promise<NotifData> => {
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (typeFilter !== 'ALL') params.set('type', typeFilter)
    if (readFilter === 'UNREAD') params.set('isRead', 'false')
    if (readFilter === 'READ') params.set('isRead', 'true')

    const res = await fetchApi(`/api/v2/notifications?${params}`, { credentials: 'include' })
    const body = await res.json()
    if (!body?.success) throw new Error('load_error')
    return {
      notifications: body.data.notifications ?? [],
      pagination: body.data.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 },
      unreadCount: body.data.unreadCount ?? 0,
    }
  }, [page, typeFilter, readFilter])

  const { data, loading, fromCache, cachedAt, refetch: load } =
    useCachedFetch<NotifData>(`notification-center:${page}:${typeFilter}:${readFilter}`, loadFn)
  const [optimisticRead, setOptimisticRead] = useState<Set<string>>(new Set())
  const notifications = (data?.notifications ?? []).map(n => optimisticRead.has(n.id) ? { ...n, isRead: true } : n)
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 }

  // Le serveur recalcule unreadCount à chaque appel, quel que soit le filtre — source
  // d'autorité, on la répercute dans le contexte partagé pour éliminer toute dérive.
  useEffect(() => { if (data) syncUnreadCount(data.unreadCount) }, [data, syncUnreadCount])

  // Revenir à la page 1 quand un filtre change (évite une page vide hors bornes)
  useEffect(() => { setPage(1) }, [typeFilter, readFilter])

  const markAsRead = useCallback(async (id: string) => {
    setOptimisticRead(prev => new Set(prev).add(id))
    await markAsReadShared(id)
  }, [markAsReadShared])

  const markAllAsRead = useCallback(async () => {
    setOptimisticRead(prev => new Set([...prev, ...notifications.map(n => n.id)]))
    await markAllAsReadShared()
    load()
  }, [markAllAsReadShared, load, notifications])

  return {
    notifications, pagination, loading, fromCache, cachedAt,
    typeFilter, setTypeFilter, readFilter, setReadFilter,
    page, setPage,
    markAsRead, markAllAsRead,
  }
}
