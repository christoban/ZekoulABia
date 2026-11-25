'use client'
import { CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react'
import type { TeacherAttendanceStatusData } from './types'

interface Props {
  attendance: NonNullable<TeacherAttendanceStatusData['attendance']>
  onRefresh: () => void
}

export default function PresenceCheckedInCard({ attendance, onRefresh }: Props) {
  const modeLabel = attendance.mode === 'QR' ? 'QR Code Salle' : attendance.mode === 'GPS' ? 'Positionnement GPS' : 'Saisie Manuelle'
  const isAVerifier = attendance.statut === 'A_VERIFIER'

  return (
    <div
      style={{
        background: isAVerifier ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34, 197, 94, 0.08)',
        border: `1.5px solid ${isAVerifier ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: isAVerifier ? '#f59e0b' : '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
              {isAVerifier ? 'Présence Enseignant enregistrée (À vérifier)' : 'Présence Enseignant confirmée en poste'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Pointage du jour validé via <strong>{modeLabel}</strong> · Prise d'appel autorisée
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 800,
              background: isAVerifier ? '#fef3c7' : '#dcfce7',
              color: isAVerifier ? '#92400e' : '#15803d',
              border: `1px solid ${isAVerifier ? '#fde68a' : '#bbf7d0'}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <ShieldCheck size={13} />
            {attendance.statut}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            title="Actualiser"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
