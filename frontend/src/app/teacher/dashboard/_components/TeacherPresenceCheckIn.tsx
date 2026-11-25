'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import PresenceCheckedInCard from './presence/PresenceCheckedInCard'
import PresenceModePanels from './presence/PresenceModePanels'
import type { GpsCoords, PresenceMode, TeacherAttendanceStatusData } from './presence/types'

export type { TeacherAttendanceStatusData }

interface Props {
  onPresenceConfirmed?: (attendance: TeacherAttendanceStatusData['attendance']) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  classId?: string
  subjectId?: string
}

export default function TeacherPresenceCheckIn({
  onPresenceConfirmed,
  onToast,
  classId: _classId,
  subjectId: _subjectId,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusData, setStatusData] = useState<TeacherAttendanceStatusData | null>(null)
  const [selectedMode, setSelectedMode] = useState<PresenceMode>('MANUEL')

  const [qrInput, setQrInput] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [gpsCoords, setGpsCoords] = useState<GpsCoords | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsDetecting, setGpsDetecting] = useState(false)

  // Chargement du statut de présence du jour
  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      if (navigator.onLine) {
        const res = await fetchApi('/api/v2/staff-attendance/status', { credentials: 'include' }).then(r => r.json())
        if (res.success && res.data) {
          setStatusData(res.data)
          putCachedData('teacher:staff-attendance-status', res.data).catch(() => {})
          if (res.data.hasCheckedIn && onPresenceConfirmed) {
            onPresenceConfirmed(res.data.attendance)
          }
          if (!res.data.hasCheckedIn && res.data.recommendedMode) {
            setSelectedMode(res.data.recommendedMode)
          }
          if (res.data.currentSlot?.roomId) {
            setSelectedRoomId(res.data.currentSlot.roomId)
          } else if (res.data.rooms?.length > 0) {
            const firstQrRoom = (res.data.rooms as TeacherAttendanceStatusData['rooms']).find((r) => r.qrEnabled)
            if (firstQrRoom) setSelectedRoomId(firstQrRoom.id)
          }
        }
      } else {
        const cached = await getCachedData<TeacherAttendanceStatusData>('teacher:staff-attendance-status')
        if (cached?.data) {
          setStatusData(cached.data)
          if (cached.data.hasCheckedIn && onPresenceConfirmed) {
            onPresenceConfirmed(cached.data.attendance)
          }
        }
      }
    } catch {
      const cached = await getCachedData<TeacherAttendanceStatusData>('teacher:staff-attendance-status')
      if (cached?.data) {
        setStatusData(cached.data)
        if (cached.data.hasCheckedIn && onPresenceConfirmed) {
          onPresenceConfirmed(cached.data.attendance)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [onPresenceConfirmed])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // Détection de géolocalisation HTML5
  const handleDetectGPS = () => {
    setGpsDetecting(true)
    setGpsError(null)

    if (!navigator.geolocation) {
      setGpsError("La géolocalisation n'est pas supportée par votre navigateur.")
      setGpsDetecting(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setGpsDetecting(false)
        onToast('Coordonnées GPS détectées avec succès', 'info')
      },
      (err) => {
        let msg = "Impossible d'accéder à votre position GPS."
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Autorisation GPS refusée par votre navigateur. Vous pouvez utiliser le mode Manuel.'
        }
        setGpsError(msg)
        setGpsDetecting(false)
        onToast(msg, 'warning')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Soumission du pointage (QR, GPS ou Manuel)
  const handlePointer = async (modeOverride?: PresenceMode) => {
    const mode = modeOverride || selectedMode
    setSubmitting(true)

    if (!navigator.onLine) {
      const localAtt = {
        id: `offline-${Date.now()}`,
        statut: 'PRESENT' as const,
        mode: mode as TeacherAttendanceStatusData['recommendedMode'],
        date: new Date().toISOString().split('T')[0],
      }
      const updatedStatus: TeacherAttendanceStatusData = {
        ...(statusData ?? {
          hasCheckedIn: true,
          attendance: localAtt,
          settings: { gpsConfigured: false, gpsRadiusMeters: 50, schoolLatitude: null, schoolLongitude: null, qrConfigured: false },
          rooms: [],
          currentSlot: null,
          recommendedMode: 'MANUEL',
        }),
        hasCheckedIn: true,
        attendance: localAtt,
      }
      setStatusData(updatedStatus)
      await putCachedData('teacher:staff-attendance-status', updatedStatus).catch(() => {})
      if (onPresenceConfirmed) onPresenceConfirmed(localAtt)
      onToast("Présence confirmée hors-ligne ! (Prise d'appel déverrouillée)", 'info')
      setSubmitting(false)
      return
    }

    try {
      const body: { mode: string; qrToken?: string; latitude?: number; longitude?: number } = { mode }

      if (mode === 'QR') {
        let tokenToSend = qrInput.trim()
        if (!tokenToSend && selectedRoomId) {
          const scanInfoRes = await fetchApi(`/api/v2/staff-attendance/scan-info?roomId=${selectedRoomId}`, {
            credentials: 'include',
          }).then(r => r.json())
          if (scanInfoRes.success && scanInfoRes.data?.qrToken) {
            tokenToSend = scanInfoRes.data.qrToken
          }
        }

        if (!tokenToSend) {
          onToast('Veuillez scanner ou saisir le code QR de la salle', 'warning')
          setSubmitting(false)
          return
        }
        body.qrToken = tokenToSend
      } else if (mode === 'GPS') {
        if (!gpsCoords) {
          onToast('Veuillez d’abord cliquer sur Détecter ma position GPS', 'warning')
          setSubmitting(false)
          return
        }
        body.latitude = gpsCoords.lat
        body.longitude = gpsCoords.lng
      }

      const res = await fetchApi('/api/v2/staff-attendance/pointer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json())

      if (res.success && res.data) {
        const att = res.data.attendance
        const aVerifier = res.data.aVerifier

        if (aVerifier) {
          onToast('Présence signalée avec succès (statut À VÉRIFIER par le RH)', 'warning')
        } else {
          onToast(`Présence confirmée avec succès via ${mode === 'QR' ? 'QR Code' : mode === 'GPS' ? 'Position GPS' : 'Signalement Manuel'} !`, 'success')
        }

        await loadStatus()
        if (onPresenceConfirmed) {
          onPresenceConfirmed(att)
        }
      } else {
        onToast(res.message || 'Erreur lors du signalement de présence', 'error')
      }
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Erreur de connexion lors du pointage', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !statusData) {
    return (
      <div style={{ padding: '12px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Loader2 size={16} className="animate-spin text-[var(--primary)]" />
        <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>Vérification du statut de présence de l'enseignant...</span>
      </div>
    )
  }

  const hasCheckedIn = statusData?.hasCheckedIn || false
  const attendance = statusData?.attendance
  const currentSlot = statusData?.currentSlot

  if (hasCheckedIn && attendance) {
    return <PresenceCheckedInCard attendance={attendance} onRefresh={loadStatus} />
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1.5px solid #f59e0b',
        borderRadius: 12,
        padding: '16px',
        boxShadow: '0 4px 16px rgba(245, 158, 11, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* En-tête de l'étape préalable */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              flexShrink: 0,
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
              Étape 1 : Signalez votre présence en classe
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, lineHeight: 1.4 }}>
              Conformément à la procédure officielle, vous devez valider votre présence en poste avant de procéder à l'appel des élèves.
            </div>
          </div>
        </div>

        {currentSlot && (
          <div style={{ background: 'var(--bg2)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
            Cours actuel : {currentSlot.subjectName || 'Matière'} · {currentSlot.className || 'Classe'} {currentSlot.roomName ? `(${currentSlot.roomName})` : ''}
          </div>
        )}
      </div>

      <PresenceModePanels
        selectedMode={selectedMode}
        statusData={statusData}
        qrInput={qrInput}
        selectedRoomId={selectedRoomId}
        gpsCoords={gpsCoords}
        gpsError={gpsError}
        gpsDetecting={gpsDetecting}
        submitting={submitting}
        onSelectMode={setSelectedMode}
        onQrInputChange={setQrInput}
        onRoomChange={setSelectedRoomId}
        onDetectGPS={handleDetectGPS}
        onPointer={handlePointer}
      />
    </div>
  )
}
