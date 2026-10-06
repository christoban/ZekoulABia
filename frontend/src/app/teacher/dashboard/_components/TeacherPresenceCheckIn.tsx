'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  QrCode,
  MapPin,
  UserCheck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
  Camera,
  Navigation,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

export interface TeacherAttendanceStatusData {
  hasCheckedIn: boolean
  attendance: {
    id: string
    statut: 'PRESENT' | 'ABSENT' | 'RETARD' | 'A_VERIFIER'
    mode: 'QR' | 'GPS' | 'MANUEL' | null
    date: string
    createdAt?: string
    roomId?: string | null
    timetableSlotId?: string | null
  } | null
  settings: {
    gpsConfigured: boolean
    gpsRadiusMeters: number
    schoolLatitude: number | null
    schoolLongitude: number | null
    qrConfigured: boolean
  }
  rooms: { id: string; name: string; qrEnabled: boolean }[]
  currentSlot: {
    id: string
    subjectName: string | null
    className: string | null
    roomId: string | null
    roomName: string | null
    qrEnabled: boolean
  } | null
  recommendedMode: 'QR' | 'GPS' | 'MANUEL'
}

interface Props {
  onPresenceConfirmed?: (attendance: any) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  classId?: string
  subjectId?: string
}

export default function TeacherPresenceCheckIn({
  onPresenceConfirmed,
  onToast,
  classId,
  subjectId,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusData, setStatusData] = useState<TeacherAttendanceStatusData | null>(null)
  const [selectedMode, setSelectedMode] = useState<'QR' | 'GPS' | 'MANUEL'>('MANUEL')

  // Formulaires spécifiques aux modes
  const [qrInput, setQrInput] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsDetecting, setGpsDetecting] = useState(false)

  // Chargement du statut de présence du jour
  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/staff-attendance/status', { credentials: 'include' }).then(r => r.json())
      if (res.success && res.data) {
        setStatusData(res.data)
        if (res.data.hasCheckedIn && onPresenceConfirmed) {
          onPresenceConfirmed(res.data.attendance)
        }
        if (!res.data.hasCheckedIn && res.data.recommendedMode) {
          setSelectedMode(res.data.recommendedMode)
        }
        if (res.data.currentSlot?.roomId) {
          setSelectedRoomId(res.data.currentSlot.roomId)
        } else if (res.data.rooms?.length > 0) {
          const firstQrRoom = res.data.rooms.find((r: any) => r.qrEnabled)
          if (firstQrRoom) setSelectedRoomId(firstQrRoom.id)
        }
      }
    } catch {
      // mode silencieux
    } finally {
      setLoading(false)
    }
  }, [])

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
  const handlePointer = async (modeOverride?: 'QR' | 'GPS' | 'MANUEL') => {
    const mode = modeOverride || selectedMode
    setSubmitting(true)

    try {
      let body: any = { mode }

      if (mode === 'QR') {
        let tokenToSend = qrInput.trim()
        // Si aucun token manuel n'a été saisi mais qu'une salle est sélectionnée, on génère/récupère le token officiel
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
    } catch (err: any) {
      onToast(err.message || 'Erreur de connexion lors du pointage', 'error')
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
  const settings = statusData?.settings

  // ── CAS 1 : PRÉSENCE DÉJÀ VALIDÉE POUR AUJOURD'HUI ──
  if (hasCheckedIn && attendance) {
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
              onClick={loadStatus}
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

  // ── CAS 2 : PRÉSENCE NON ENCORE SIGNALÉE (RITUEL PRÉALABLE OBLIGATOIRE) ──
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

      {/* Sélecteur des 3 modes (comme l'authentification multifacteur) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setSelectedMode('QR')}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '9px 12px',
            borderRadius: 8,
            border: selectedMode === 'QR' ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selectedMode === 'QR' ? 'var(--primary-light)' : 'var(--surface)',
            color: selectedMode === 'QR' ? 'var(--primary)' : 'var(--text2)',
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
          }}
        >
          <QrCode size={15} />
          <span>Scanner QR Code</span>
          {settings?.qrConfigured && (
            <span style={{ fontSize: 9, background: '#22c55e', color: 'white', padding: '1px 5px', borderRadius: 4 }}>Actif</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSelectedMode('GPS')}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '9px 12px',
            borderRadius: 8,
            border: selectedMode === 'GPS' ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selectedMode === 'GPS' ? 'var(--primary-light)' : 'var(--surface)',
            color: selectedMode === 'GPS' ? 'var(--primary)' : 'var(--text2)',
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
          }}
        >
          <MapPin size={15} />
          <span>Position GPS</span>
          {settings?.gpsConfigured && (
            <span style={{ fontSize: 9, background: '#3b82f6', color: 'white', padding: '1px 5px', borderRadius: 4 }}>Calibré</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSelectedMode('MANUEL')}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '9px 12px',
            borderRadius: 8,
            border: selectedMode === 'MANUEL' ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: selectedMode === 'MANUEL' ? 'var(--primary-light)' : 'var(--surface)',
            color: selectedMode === 'MANUEL' ? 'var(--primary)' : 'var(--text2)',
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
          }}
        >
          <UserCheck size={15} />
          <span>Manuel</span>
          <span style={{ fontSize: 9, background: 'var(--text3)', color: 'white', padding: '1px 5px', borderRadius: 4 }}>Repli</span>
        </button>
      </div>

      {/* Contenu spécifique au mode sélectionné */}
      <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
        {/* MODE 1 : QR CODE */}
        {selectedMode === 'QR' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Scannez le code QR affiché sur la porte ou le tableau de votre salle de classe pour attester de votre présence physique.
            </div>

            {statusData?.rooms && statusData.rooms.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Salle de cours :</span>
                <select
                  value={selectedRoomId}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'white',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text)',
                  }}
                >
                  <option value="">Sélectionner une salle...</option>
                  {statusData.rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.qrEnabled ? '✓ (QR activé)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Token QR scanné ou code de salle..."
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'white',
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={() => handlePointer('QR')}
                disabled={submitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                <span>Valider le QR</span>
              </button>
            </div>
          </div>
        )}

        {/* MODE 2 : GPS */}
        {selectedMode === 'GPS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Vérification automatique de votre géolocalisation dans le périmètre de l'établissement ({settings?.gpsRadiusMeters ?? 75} mètres).
            </div>

            {gpsError && (
              <div style={{ padding: '8px 10px', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} />
                <span>{gpsError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={gpsDetecting}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: 'white',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {gpsDetecting ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                <span>{gpsCoords ? `Position acquise (${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)})` : 'Détecter ma position GPS'}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePointer('GPS')}
                disabled={submitting || !gpsCoords}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: gpsCoords ? 'var(--primary)' : 'var(--text3)',
                  color: 'white',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: gpsCoords ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Confirmer présence par GPS</span>
              </button>
            </div>
          </div>
        )}

        {/* MODE 3 : MANUEL */}
        {selectedMode === 'MANUEL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Signalement déclaratif direct. Utilisable si l'établissement n'a pas encore calibré les bornes GPS ou les QR codes de salle.
            </div>

            <div>
              <button
                type="button"
                onClick={() => handlePointer('MANUEL')}
                disabled={submitting}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(180, 83, 42, 0.25)',
                }}
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={16} />}
                <span>Déclarer ma présence en poste maintenant</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
