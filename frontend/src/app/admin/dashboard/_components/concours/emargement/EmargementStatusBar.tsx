'use client'

import { CloudOff, RefreshCw } from 'lucide-react'
import type { EmargementStats } from './types'

interface Props {
  isOnline: boolean
  pendingCount: number
  syncing: boolean
  onSync: () => void
  stats: EmargementStats
}

export function EmargementStatusBar({ isOnline, pendingCount, syncing, onSync, stats }: Props) {
  return (
    <div
      style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border, #e5e7eb)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {!isOnline ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              color: '#c2410c',
              background: 'rgba(234,88,12,0.12)',
              padding: '3px 8px',
              borderRadius: 6,
            }}
          >
            <CloudOff size={13} /> Hors-ligne (local Dexie)
          </span>
        ) : pendingCount > 0 ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              color: '#1d4ed8',
              background: 'rgba(37,99,235,0.1)',
              padding: '3px 8px',
              borderRadius: 6,
            }}
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {pendingCount} en attente de synchro
          </span>
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#16a34a',
              background: 'rgba(22,163,74,0.1)',
              padding: '3px 8px',
              borderRadius: 6,
            }}
          >
            Connecté (temps réel)
          </span>
        )}
        {isOnline && pendingCount > 0 && (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            Synchro
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: 6 }}>
          Présents : {stats.presents}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 6 }}>
          Absents : {stats.absents}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706', background: 'rgba(217,119,6,0.1)', padding: '2px 8px', borderRadius: 6 }}>
          Abandons : {stats.abandons}
        </span>
      </div>
    </div>
  )
}
