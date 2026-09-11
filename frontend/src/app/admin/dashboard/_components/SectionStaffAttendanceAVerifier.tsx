'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface OnToast { (msg: string, type?: 'success' | 'error' | 'info' | 'warning'): void }

interface AVerifierItem {
  id: string
  userId: string
  statut: string
  mode: string | null
  latitude: number | null
  longitude: number | null
  date: string
}

export default function SectionStaffAttendanceAVerifier({ onToast }: { onToast: OnToast }) {
  const t = useT('admin')
  const [items, setItems] = useState<AVerifierItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetchApi('/api/v2/staff-attendance/a-verifier', { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? 'Erreur')
      setItems(d.data ?? [])
    } catch {
      onToast(t('rh.toast.errAttendance'), 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast, t])

  useEffect(() => { load() }, [load])

  const requalifier = async (id: string, statut: 'PRESENT' | 'ABSENT' | 'RETARD') => {
    setBusyId(id)
    try {
      const r = await fetchApi(`/api/v2/staff-attendance/${id}/requalifier`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? 'Erreur')
      onToast(t('rh.attendanceSaved'), 'success')
      load()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('rh.toast.errAttendance'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)' }}>…</div>
  }

  if (items.length === 0) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)' }}>{t('rh.noAVerifier')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid var(--bg2)', borderRadius: 8, padding: 10, background: 'var(--bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{new Date(item.date).toLocaleDateString('fr-FR')}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {item.mode === 'GPS' ? 'GPS' : item.mode ?? '—'}
                {item.latitude != null && item.longitude != null ? ` · ${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => requalifier(item.id, 'PRESENT')} disabled={busyId === item.id}
              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> {t('rh.requalifyPresent')}
            </button>
            <button onClick={() => requalifier(item.id, 'ABSENT')} disabled={busyId === item.id}
              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer' }}>
              {t('rh.requalifyAbsent')}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
