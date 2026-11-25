'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MapPin, QrCode, Save, Navigation, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface OnToast {
  (msg: string, type?: 'success' | 'error' | 'info' | 'warning'): void
}

interface RoomQrConfig {
  id: string
  name: string
  qrEnabled: boolean
}

interface SettingsPayload {
  schoolLatitude: string
  schoolLongitude: string
  gpsRadiusMeters: string
  qrTokenTtlSeconds: string
}

export default function SectionStaffAttendanceSettings({ onToast }: { onToast: OnToast }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [form, setForm] = useState<SettingsPayload>({
    schoolLatitude: '',
    schoolLongitude: '',
    gpsRadiusMeters: '150',
    qrTokenTtlSeconds: '60',
  })
  const [rooms, setRooms] = useState<RoomQrConfig[]>([])

  const onToastRef = useRef(onToast)
  useEffect(() => {
    onToastRef.current = onToast
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetchApi('/api/v2/staff-attendance/settings', { credentials: 'include' })
      const d = await r.json()
      if (!r.ok || !d.success) throw new Error(d.message ?? 'Erreur chargement paramètres')
      const s = d.data?.settings ?? {}
      setForm({
        schoolLatitude: s.schoolLatitude != null ? String(s.schoolLatitude) : '',
        schoolLongitude: s.schoolLongitude != null ? String(s.schoolLongitude) : '',
        gpsRadiusMeters: String(s.gpsRadiusMeters ?? 150),
        qrTokenTtlSeconds: String(s.qrTokenTtlSeconds ?? 60),
      })
      setRooms(Array.isArray(d.data?.rooms) ? d.data.rooms : [])
    } catch (err) {
      onToastRef.current(err instanceof Error ? err.message : 'Erreur paramètres pointage', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const useCurrentPosition = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onToastRef.current('Géolocalisation indisponible sur cet appareil', 'warning')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          schoolLatitude: pos.coords.latitude.toFixed(6),
          schoolLongitude: pos.coords.longitude.toFixed(6),
        }))
        setLocating(false)
        onToastRef.current('Position GPS actuelle récupérée', 'success')
      },
      () => {
        setLocating(false)
        onToastRef.current('Impossible de récupérer la position GPS', 'error')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const toggleRoom = (roomId: string) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, qrEnabled: !r.qrEnabled } : r)))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const lat = form.schoolLatitude.trim() === '' ? null : Number(form.schoolLatitude)
      const lng = form.schoolLongitude.trim() === '' ? null : Number(form.schoolLongitude)
      const radius = Number(form.gpsRadiusMeters)
      const ttl = Number(form.qrTokenTtlSeconds)

      if ((lat !== null && Number.isNaN(lat)) || (lng !== null && Number.isNaN(lng))) {
        throw new Error('Coordonnées GPS invalides')
      }
      if (Number.isNaN(radius) || radius < 10) {
        throw new Error('Rayon GPS invalide (minimum 10 m)')
      }
      if (Number.isNaN(ttl) || ttl < 15) {
        throw new Error('Durée QR invalide (minimum 15 s)')
      }

      const r = await fetchApi('/api/v2/staff-attendance/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolLatitude: lat,
          schoolLongitude: lng,
          gpsRadiusMeters: radius,
          qrTokenTtlSeconds: ttl,
          roomsQrConfig: rooms.map((rm) => ({ roomId: rm.id, qrEnabled: rm.qrEnabled })),
        }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) throw new Error(d.message ?? 'Erreur lors de la sauvegarde')
      onToastRef.current('Paramètres GPS & QR enregistrés', 'success')
    } catch (err) {
      onToastRef.current(err instanceof Error ? err.message : 'Erreur sauvegarde paramètres', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div className="px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={15} style={{ color: 'var(--primary)' }} />
          <span className="text-[13px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)' }}>Paramètres pointage GPS & QR</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={useCurrentPosition} disabled={locating || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {locating ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Navigation size={13} />}
            Utiliser ma position GPS
          </button>
          <button type="button" onClick={handleSave} disabled={saving || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            <Save size={13} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>Chargement des paramètres…</div>
      ) : (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <div>
              <label style={lbl}>Latitude établissement</label>
              <input value={form.schoolLatitude} onChange={(e) => setForm((f) => ({ ...f, schoolLatitude: e.target.value }))}
                placeholder="ex. 3.848033" style={inp} />
            </div>
            <div>
              <label style={lbl}>Longitude établissement</label>
              <input value={form.schoolLongitude} onChange={(e) => setForm((f) => ({ ...f, schoolLongitude: e.target.value }))}
                placeholder="ex. 11.502075" style={inp} />
            </div>
            <div>
              <label style={lbl}>Rayon GPS autorisé (m)</label>
              <input type="number" min={10} value={form.gpsRadiusMeters} onChange={(e) => setForm((f) => ({ ...f, gpsRadiusMeters: e.target.value }))}
                style={inp} />
            </div>
            <div>
              <label style={lbl}>Validité jeton QR (s)</label>
              <input type="number" min={15} value={form.qrTokenTtlSeconds} onChange={(e) => setForm((f) => ({ ...f, qrTokenTtlSeconds: e.target.value }))}
                style={inp} />
            </div>
          </div>

          {rooms.length > 0 && (
            <div>
              <div style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <QrCode size={12} /> Pointage QR actif par salle ({rooms.filter((r) => r.qrEnabled).length}/{rooms.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {rooms.map((rm) => (
                  <label key={rm.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, border: `1px solid ${rm.qrEnabled ? 'var(--green)' : 'var(--border2)'}`, background: rm.qrEnabled ? 'var(--green-light)' : 'var(--bg)', fontSize: 12, fontWeight: 700, color: rm.qrEnabled ? 'var(--green)' : 'var(--text2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={rm.qrEnabled} onChange={() => toggleRoom(rm.id)} />
                    {rm.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

