'use client'

import { AlertOctagon, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { CandidateItem, PresenceStatus } from './types'

interface Props {
  candidate: CandidateItem
  isUpdating: boolean
  onSetPresence: (candidateId: string, nextStatus: PresenceStatus) => void
}

const PRESENCE_OPTIONS: Array<{
  status: PresenceStatus
  label: string
  activeBg: string
  idleBg: string
  idleColor: string
  icon: typeof CheckCircle2
}> = [
  {
    status: 'PRESENT',
    label: 'Présent',
    activeBg: 'var(--green, #16a34a)',
    idleBg: 'rgba(22,163,74,0.1)',
    idleColor: 'var(--green, #16a34a)',
    icon: CheckCircle2,
  },
  {
    status: 'ABSENT',
    label: 'Absent',
    activeBg: 'var(--red, #ef4444)',
    idleBg: 'rgba(239,68,68,0.1)',
    idleColor: 'var(--red, #ef4444)',
    icon: XCircle,
  },
  {
    status: 'ABANDON',
    label: 'Abandon',
    activeBg: 'var(--amber, #d97706)',
    idleBg: 'rgba(217,119,6,0.1)',
    idleColor: 'var(--amber, #d97706)',
    icon: AlertOctagon,
  },
]

export function EmargementCandidateRow({ candidate: c, isUpdating, onSetPresence }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid var(--border, #e5e7eb)',
        background: 'var(--surface, #fff)',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {c.deskNumber && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--blue, #2563eb)',
                background: 'rgba(37,99,235,0.1)',
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              Table #{c.deskNumber}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)' }}>
            {c.firstName} {c.lastName}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3, #9ca3af)', marginTop: 2 }}>
          {c.candidateNumber || 'Sans matricule'} {c.originSchool ? `— ${c.originSchool}` : ''}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isUpdating && <Loader2 size={14} className="animate-spin" />}
        {PRESENCE_OPTIONS.map((opt) => {
          const Icon = opt.icon
          const active = c.presenceStatus === opt.status
          return (
            <button
              key={opt.status}
              type="button"
              onClick={() => onSetPresence(c.id, opt.status)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: 'none',
                background: active ? opt.activeBg : opt.idleBg,
                color: active ? '#fff' : opt.idleColor,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={13} />
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
