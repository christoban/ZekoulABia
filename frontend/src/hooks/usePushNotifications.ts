'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { subscribeDevice, unsubscribeDevice, sendSubscriptionToServer, sendUnsubscribeToServer } from '@/lib/pushNotifications'

export type PushSubscriptionState = {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  loading: boolean
  error: string | null
}

export function usePushNotifications() {
  const [state, setState] = useState<PushSubscriptionState>({
    supported: false,
    permission: 'unsupported',
    subscribed: false,
    loading: true,
    error: null,
  })
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!('Notification' in window) || !('serviceWorker' in window) || !('PushManager' in window)) {
      setState(prev => ({ ...prev, loading: false }))
      return
    }

    setState(prev => ({ ...prev, supported: true, permission: Notification.permission }))

    navigator.serviceWorker.ready.then(reg => {
      registrationRef.current = reg
      reg.pushManager.getSubscription().then(sub => {
        setState(prev => ({
          ...prev,
          subscribed: !!sub,
          loading: false,
        }))
      })
    })
  }, [])

  const subscribe = useCallback(async () => {
    const reg = registrationRef.current
    if (!reg) {
      setState(prev => ({ ...prev, error: 'Service Worker non prêt' }))
      return false
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    const subscription = await subscribeDevice(reg)
    if (!subscription) {
      setState(prev => ({ ...prev, loading: false, error: 'Abonnement impossible' }))
      return false
    }

    const sent = await sendSubscriptionToServer(subscription)
    if (!sent) {
      setState(prev => ({ ...prev, loading: false, error: 'Échec de la sauvegarde côté serveur' }))
      return false
    }

    setState(prev => ({ ...prev, subscribed: true, loading: false, permission: Notification.permission }))
    return true
  }, [])

  const unsubscribe = useCallback(async () => {
    const reg = registrationRef.current
    if (!reg) return false

    setState(prev => ({ ...prev, loading: true, error: null }))

    const subscription = await reg.pushManager.getSubscription()
    if (subscription) {
      await sendUnsubscribeToServer(subscription)
    }

    await unsubscribeDevice(reg)

    setState(prev => ({ ...prev, subscribed: false, loading: false }))
    return true
  }, [])

  return { ...state, subscribe, unsubscribe }
}
