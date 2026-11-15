'use client'
import { useState } from 'react'
import { Check, ClipboardList, Edit3, Loader2, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

export interface SharedAttendanceRecord {
  id: string
  date: string
  status: string
  period: string
  arrivedAt?: string | null
  lateNote?: string | null
  justification?: string | null
  justificationStatus?: string | null
  previousStatus?: string | null
  student: { id: string; firstName: string; lastName: string } | null
  class: { id: string; name: string } | null
  markedBy: { id: string; firstName: string; lastName: string } | null
}

interface Props {
  record: SharedAttendanceRecord
  justifyingId: string | null
  onJustify: (recordId: string, approve?: boolean) => Promise<void>
  onCorrected: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function AttendanceRecordActions({ record, justifyingId, onJustify, onCorrected, onToast }: Props) {
  const [correcting, setCorrecting] = useState(false)
  const [nextStatus, setNextStatus] = useState(record.status)
  const [lateNote, setLateNote] = useState(record.lateNote || '')
  const [submitting, setSubmitting] = useState(false)

  const handleCorrect = async () => {
    setSubmitting(true)
    try {
      const res = await fetchApi(`/api/v2/attendance/${record.id}/correct`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          lateNote: nextStatus === 'LATE' ? (lateNote.trim() || undefined) : null,
          arrivedAt: nextStatus === 'LATE' ? new Date().toISOString() : null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Erreur correction')
      onToast('Statut corrigé et tracé', 'success')
      setCorrecting(false)
      onCorrected()
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {record.status === 'ABSENT' && record.justificationStatus === 'PENDING' && (
          <>
            <button
              type="button"
              disabled={justifyingId === record.id}
              onClick={() => void onJustify(record.id, true)}
              className="px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer bg-[var(--green-light)] text-[var(--green)] border border-[var(--green)]/30"
            >
              {justifyingId === record.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Valider motif
            </button>
            <button
              type="button"
              disabled={justifyingId === record.id}
              onClick={() => void onJustify(record.id, false)}
              className="px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer bg-[var(--red-light)] text-[var(--red)] border border-[var(--red)]/30"
            >
              <X size={11} /> Refuser
            </button>
          </>
        )}

        {record.status === 'ABSENT' && record.justificationStatus !== 'PENDING' && (
          <button
            type="button"
            disabled={justifyingId === record.id}
            onClick={() => void onJustify(record.id, true)}
            className="px-2.5 py-1 rounded text-[11.5px] font-bold inline-flex items-center gap-1 cursor-pointer bg-[var(--amber-light)] text-[var(--amber)] border border-[var(--amber)]/30"
          >
            {justifyingId === record.id ? <Loader2 size={11} className="animate-spin" /> : <ClipboardList size={11} />} Justifier
          </button>
        )}

        <button
          type="button"
          onClick={() => setCorrecting((v) => !v)}
          className="px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer bg-[var(--bg)] text-[var(--text2)] border border-[var(--border2)]"
        >
          <Edit3 size={11} /> Corriger
        </button>
      </div>

      {correcting && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            className="h-7 px-1.5 rounded border border-[var(--border2)] bg-[var(--surface)] text-[11px] font-bold"
          >
            <option value="PRESENT">Présent</option>
            <option value="ABSENT">Absent</option>
            <option value="LATE">Retard</option>
            <option value="ABSENT_JUSTIFIED">Justifié</option>
          </select>
          {nextStatus === 'LATE' && (
            <input
              type="text"
              placeholder="Note retard"
              value={lateNote}
              onChange={(e) => setLateNote(e.target.value)}
              className="h-7 px-2 rounded border border-[var(--border2)] bg-[var(--surface)] text-[11px] w-28"
            />
          )}
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleCorrect()}
            className="h-7 px-2.5 rounded text-[11px] font-bold text-white cursor-pointer"
            style={{ background: 'var(--primary)' }}
          >
            {submitting ? '...' : 'OK'}
          </button>
        </div>
      )}
    </div>
  )
}
