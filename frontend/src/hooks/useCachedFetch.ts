'use client'
import { useState, useEffect, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { putCachedData, getCachedData } from '@/lib/offline/db'

export function useCachedFetch<T>(cacheKey: string, fetchFn: () => Promise<T>) {
  const isOnline = useOnlineStatus()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const fetchFnRef = useRef(fetchFn)
  useEffect(() => { fetchFnRef.current = fetchFn })

  useEffect(() => {
    if (!cacheKey) { setLoading(false); return }
    let mounted = true

    const load = async () => {
      setError(null)

      // 1. STALE FIRST : lecture immédiate du cache local Dexie (rendu instantané en < 30ms)
      let hasLocalData = false
      try {
        const cached = await getCachedData<T>(cacheKey)
        if (cached && mounted) {
          setData(cached.data)
          setFromCache(true)
          setCachedAt(cached.cachedAt)
          setLoading(false)
          hasLocalData = true
        }
      } catch {
        // En cas d'erreur de lecture locale, on continue vers le réseau
      }

      // Si aucune donnée locale n'est disponible, l'interface doit montrer le loader
      if (!hasLocalData && mounted) {
        setLoading(true)
      }

      // 2. WHILE-REVALIDATE : Revalidation en tâche de fond si connecté
      if (isOnline) {
        try {
          const result = await fetchFnRef.current()
          if (!mounted) return
          setData(result)
          setFromCache(false)
          setCachedAt(Date.now())
          setError(null)
          await putCachedData(cacheKey, result)
        } catch {
          if (!mounted) return
          // Si le réseau échoue mais qu'on avait des données locales, on les conserve sans alerte bloquante
          if (!hasLocalData) {
            setError('Erreur de chargement')
          }
        } finally {
          if (mounted) setLoading(false)
        }
      } else {
        // Hors connexion
        if (!hasLocalData && mounted) {
          setError('OFFLINE_NO_CACHE')
        }
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [cacheKey, isOnline, refreshKey])

  return { data, loading, error, fromCache, cachedAt, refetch: () => setRefreshKey(k => k + 1) }
}
