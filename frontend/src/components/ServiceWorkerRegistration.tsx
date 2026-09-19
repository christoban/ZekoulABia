'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration may fail in some environments — non bloquant
      })

      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'ZEKOULABIA_NOTIFICATION_CLICK') {
          const data = event.data.data
          if (data?.conversationId) {
            window.dispatchEvent(new CustomEvent('zekoulabia:navigate', { detail: { section: 'messagerie' } }))
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent('zekoulabia:open-conversation', {
                  detail: { conversationId: data.conversationId },
                })
              )
            }, 100)
          } else if (data?.section) {
            window.dispatchEvent(new CustomEvent('zekoulabia:navigate', { detail: { section: data.section } }))
          }
        }
      }

      navigator.serviceWorker.addEventListener('message', handleSwMessage)
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage)
      }
    }
  }, [])

  return null
}
