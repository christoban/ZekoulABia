'use client'

import { useEffect } from 'react'
import { ThemeProvider } from 'next-themes'
import { purgeExpiredCache } from '@/lib/offline/db'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Purge automatique LRU à 30 jours du cache de lecture (silencieux et non bloquant)
    purgeExpiredCache(30).catch(() => {})
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </ThemeProvider>
  )
}
