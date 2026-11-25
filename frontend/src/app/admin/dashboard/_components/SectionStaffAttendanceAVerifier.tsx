'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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

  const onToastRef = useRef(onToast)
  const tRef = useRef(t)
  useEffect(() => {
    onToastRef.current = onToast
    tRef.current = t
  })

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    try {
      const r = await fetchApi('/api/v2/staff-attendance/a-verifier', { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? 'Erreur')
      setItems(d.data ?? [])
    } catch {
      onToastRef.current(tRef.current('rh.toast.errAttendance'), 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(true)
  }, [load])

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
      onToastRef.current(tRef.current('rh.attendanceSaved'), 'success')
      load(false)
    } catch (err) {
      onToastRef.current(err instanceof Error ? err.message : tRef.current('rh.toast.errAttendance'), 'error')
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--bg2)', borderRadius: 10, padding: '7px 10px', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={15} style={{ color: 'var(--amber)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>{new Date(item.date).toLocaleDateString('fr-FR')}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {item.mode === 'GPS' ? 'GPS' : item.mode ?? '—'}
                {item.latitude != null && item.longitude != null ? ` · ${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => requalifier(item.id, 'PRESENT')} disabled={busyId === item.id}
              style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(142,42,58,0.3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={11} /> {t('rh.requalifyPresent')}
            </button>
            <button onClick={() => requalifier(item.id, 'ABSENT')} disabled={busyId === item.id}
              style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer' }}>
              {t('rh.requalifyAbsent')}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}