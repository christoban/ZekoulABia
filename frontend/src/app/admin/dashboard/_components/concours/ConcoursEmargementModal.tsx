'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, Users, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { putCachedData, getCachedData } from '@/lib/offline/db'
import { EmargementStatusBar } from './emargement/EmargementStatusBar'
import { EmargementCandidateRow } from './emargement/EmargementCandidateRow'
import type { CandidateItem, PresenceStatus } from './emargement/types'

export type { CandidateItem }

interface Props {
  sessionId: string
  room: { id: string; name: string; capacity: number }
  isOpen: boolean
  onClose: () => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function ConcoursEmargementModal({
  sessionId,
  room,
  isOpen,
  onClose,
  onToast,
}: Props) {
  const isOnline = useOnlineStatus()
  const { addToQueue, pendingCount, syncQueue, syncing } = useSyncQueue()

  const [candidates, setCandidates] = useState<CandidateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cacheKey = `concours_emargement_${sessionId}_${room.id}`

  useEffect(() => {
    if (!isOpen) return

    async function loadCandidates() {
      setLoading(true)
      setError(null)

      try {
        const cached = await getCachedData<CandidateItem[]>(cacheKey)
        if (cached?.data && Array.isArray(cached.data)) {
          setCandidates(cached.data)
        }
      } catch {
        // silencieux
      }

      if (isOnline) {
        try {
          const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates?roomId=${room.id}`)
          const data = await res.json()
          if (data.success && Array.isArray(data.data)) {
            setCandidates(data.data)
            await putCachedData(cacheKey, data.data)
          }
        } catch {
          if (candidates.length === 0) {
            setError('Impossible de joindre le serveur. Données locales affichées si disponibles.')
          }
        }
      }
      setLoading(false)
    }

    loadCandidates()
  }, [isOpen, sessionId, room.id, isOnline])

  const candidatsFiltres = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => {
      const nom = `${c.firstName} ${c.lastName}`.toLowerCase()
      const code = (c.candidateNumber || '').toLowerCase()
      const table = String(c.deskNumber || '')
      return nom.includes(q) || code.includes(q) || table.includes(q)
    })
  }, [candidates, search])

  const stats = useMemo(() => {
    let presents = 0
    let absents = 0
    let abandons = 0
    for (const c of candidates) {
      if (c.presenceStatus === 'PRESENT') presents++
      else if (c.presenceStatus === 'ABSENT') absents++
      else if (c.presenceStatus === 'ABANDON') abandons++
    }
    return { presents, absents, abandons, total: candidates.length }
  }, [candidates])

  const handleSetPresence = async (candidateId: string, nextStatus: PresenceStatus) => {
    setUpdatingId(candidateId)
    setError(null)

    const updatedList = candidates.map((c) =>
      c.id === candidateId ? { ...c, presenceStatus: nextStatus } : c
    )
    setCandidates(updatedList)
    await putCachedData(cacheKey, updatedList)

    const endpoint = `/api/v2/entrance-exams/${sessionId}/emargement`
    const payload = { candidateId, presenceStatus: nextStatus }

    if (!isOnline) {
      try {
        await addToQueue({
          type: 'EXAM_ATTENDANCE',
          endpoint,
          method: 'POST',
          payload,
        })
        onToast?.('Émargement enregistré localement (hors ligne)', 'info')
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erreur d'enregistrement local")
      } finally {
        setUpdatingId(null)
      }
      return
    }

    try {
      const res = await fetchApi(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message || "Erreur lors de l'émargement")
      }
    } catch {
      try {
        await addToQueue({
          type: 'EXAM_ATTENDANCE',
          endpoint,
          method: 'POST',
          payload,
        })
        onToast?.('Réseau interrompu : action mise en file hors ligne', 'info')
      } catch {
        setError("Impossible d'enregistrer l'émargement")
      }
    } finally {
      setUpdatingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--surface, #fff)',
          borderRadius: 14,
          width: '100%',
          maxWidth: 750,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid var(--border, #e5e7eb)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface2, #f9fafb)',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--text, #111827)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Users size={20} color="var(--blue, #2563eb)" />
              Émargement Jour J — {room.name}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text2, #6b7280)', marginTop: 2 }}>
              Capacité : {room.capacity} places | Assignés : {stats.total}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text3, #9ca3af)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <EmargementStatusBar
          isOnline={isOnline}
          pendingCount={pendingCount}
          syncing={syncing}
          onSync={() => syncQueue().then((n) => onToast?.(`${n} émargement(s) synchronisé(s)`, 'success'))}
          stats={stats}
        />

        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text3, #9ca3af)',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, code candidat (ex: C001) ou table..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: 8,
                border: '1px solid var(--border, #e5e7eb)',
                background: 'var(--surface, #fff)',
                color: 'var(--text, #111827)',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {error && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--red, #ef4444)',
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              {error}
            </div>
          )}

          {loading && candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3, #9ca3af)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              Chargement des candidats...
            </div>
          ) : candidatsFiltres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3, #9ca3af)', fontSize: 13 }}>
              Aucun candidat trouvé pour cette salle.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {candidatsFiltres.map((c) => (
                <EmargementCandidateRow
                  key={c.id}
                  candidate={c}
                  isUpdating={updatingId === c.id}
                  onSetPresence={handleSetPresence}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
