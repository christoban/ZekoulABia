'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { addPendingAction, getPendingActions, countPendingActions, deletePendingAction, updatePendingActionStatus, setConflictData, updateCachedMessageStatus } from '@/lib/offline/db'
import { OPERATION_RISK_LEVEL, OfflineActionRefusedError } from '@/lib/offline/actionRegistry'
import { useOnlineStatus } from './useOnlineStatus'
import { fetchApi } from '@/lib/fetchApi'

export function useSyncQueue() {
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  const updateCount = useCallback(async () => {
    const count = await countPendingActions()
    setPendingCount(count)
  }, [])

  const addToQueue = useCallback(
    async (action: Omit<Parameters<typeof addPendingAction>[0], 'status'>): Promise<string> => {
      if (OPERATION_RISK_LEVEL[action.type] === 'FORT') {
        throw new OfflineActionRefusedError(action.type)
      }
      const key = await addPendingAction(action)
      await updateCount()
      return key
    },
    [updateCount]
  )

  const syncQueue = useCallback(async (): Promise<number> => {
    if (!isOnline || syncingRef.current) return 0

    syncingRef.current = true
    setSyncing(true)

    // Ordre de création garanti (Plan offline-first V1 §4) : un where().equals() sur un index
    // Dexie ne garantit pas l'ordre — sortBy le rend explicite plutôt que de compter sur un
    // ordre incident de l'index auto-incrémenté.
    const pending = (await getPendingActions())
      .filter(a => a.status === 'PENDING')
      .sort((a, b) => a.createdAt - b.createdAt)
    let synced = 0

    for (const action of pending) {
      try {
        const res = await fetchApi(action.endpoint, {
          method: action.method,
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': action.idempotencyKey },
          body: JSON.stringify(action.payload),
        })
        if (!res.ok) {
          // Conflit de version (409) — marquer CONFLICT avec les données de conflit
          if (res.status === 409) {
            const body = await res.json().catch(() => null)
            await updatePendingActionStatus(action.id!, 'CONFLICT')
            if (body?.conflicts) {
              // setConflictData (pas db.pendingActions.update direct) — ce champ doit
              // passer par le wrapper chiffrant comme le reste des données sensibles.
              await setConflictData(action.id!, body.conflicts)
            }
            continue
          }
          throw new Error(`HTTP ${res.status}`)
        }
        await deletePendingAction(action.id!)
        // Le fil de conversation affiche son propre statut (horloge/coche) sur l'entrée
        // optimiste de db.messages, distincte de la file générique — la synchro réussie doit la
        // faire passer de PENDING à SENT, sinon le message reste affiché comme "en cours" alors
        // qu'il est bien parti.
        if (action.type === 'MESSAGE_SEND') {
          const clientMessageId = (action.payload as { clientMessageId?: string })?.clientMessageId
          if (clientMessageId) await updateCachedMessageStatus(clientMessageId, 'SENT')
        }
        synced++
      } catch {
        await updatePendingActionStatus(action.id!, 'FAILED')
        if (action.type === 'MESSAGE_SEND') {
          const clientMessageId = (action.payload as { clientMessageId?: string })?.clientMessageId
          if (clientMessageId) await updateCachedMessageStatus(clientMessageId, 'FAILED')
        }
      }
    }

    await updateCount()
    syncingRef.current = false
    setSyncing(false)
    return synced
  }, [isOnline, updateCount])

  useEffect(() => {
    updateCount()
  }, [updateCount])

  useEffect(() => {
    if (isOnline) {
      syncQueue()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  return { pendingCount, syncing, isOnline, addToQueue, syncQueue }
}
