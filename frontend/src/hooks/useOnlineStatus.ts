'use client'

import { useState, useEffect } from 'react'

let cachedOnlineState = typeof navigator !== 'undefined' ? navigator.onLine : true
let lastProbeTime = 0
const PROBE_THROTTLE_MS = 15_000

async function probeInternetAccess(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false
  }

  const now = Date.now()
  if (now - lastProbeTime < PROBE_THROTTLE_MS) {
    return cachedOnlineState
  }

  lastProbeTime = now
  const controller = new AbortController()
  // Timeout adapté aux latences 2G/3G (6s pour éviter les faux négatifs sur réseaux lents)
  const timer = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch('/api/v2/health', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
    cachedOnlineState = res.ok
    return res.ok
  } catch {
    cachedOnlineState = false
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(cachedOnlineState)

  useEffect(() => {
    let mounted = true

    const check = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        cachedOnlineState = false
        if (mounted) setIsOnline(false)
        return
      }

      const active = await probeInternetAccess()
      if (mounted) setIsOnline(active)
    }

    check()

    const handleNetworkChange = () => {
      lastProbeTime = 0 // force probe immédiate lors d'un événement réseau ou focus
      check()
    }

    window.addEventListener('online', handleNetworkChange)
    window.addEventListener('offline', handleNetworkChange)
    window.addEventListener('focus', handleNetworkChange)

    const interval = setInterval(check, PROBE_THROTTLE_MS)

    return () => {
      mounted = false
      window.removeEventListener('online', handleNetworkChange)
      window.removeEventListener('offline', handleNetworkChange)
      window.removeEventListener('focus', handleNetworkChange)
      clearInterval(interval)
    }
  }, [])

  return isOnline
}
