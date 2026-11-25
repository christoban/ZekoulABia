'use client'
import {
  QrCode,
  MapPin,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  Navigation,
} from 'lucide-react'
import type { GpsCoords, PresenceMode, TeacherAttendanceStatusData } from './types'

interface Props {
  selectedMode: PresenceMode
  statusData: TeacherAttendanceStatusData | null
  qrInput: string
  selectedRoomId: string
  gpsCoords: GpsCoords | null
  gpsError: string | null
  gpsDetecting: boolean
  submitting: boolean
  onSelectMode: (mode: PresenceMode) => void
  onQrInputChange: (v: string) => void
  onRoomChange: (id: string) => void
  onDetectGPS: () => void
  onPointer: (mode: PresenceMode) => void
}

export default function PresenceModePanels({
  selectedMode,
  statusData,
  qrInput,
  selectedRoomId,
  gpsCoords,
  gpsError,
  gpsDetecting,
  submitting,
  onSelectMode,
  onQrInputChange,
  onRoomChange,
  onDetectGPS,
  onPointer,
}: Props) {
  const settings = statusData?.settings

  const modeBtnStyle = (mode: PresenceMode) => ({
    flex: 1,
    minWidth: 140,
    padding: '9px 12px',
    borderRadius: 8,
    border: selectedMode === mode ? '2px solid var(--primary)' : '1px solid var(--border)',
    background: selectedMode === mode ? 'var(--primary-light)' : 'var(--surface)',
    color: selectedMode === mode ? 'var(--primary)' : 'var(--text2)',
    fontSize: 12,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  })

  return (
    <>
      {/* Sélecteur des 3 modes */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onSelectMode('QR')} style={modeBtnStyle('QR')}>
          <QrCode size={15} />
          <span>Scanner QR Code</span>
          {settings?.qrConfigured && (
            <span style={{ fontSize: 9, background: '#22c55e', color: 'white', padding: '1px 5px', borderRadius: 4 }}>Actif</span>
          )}
        </button>

        <button type="button" onClick={() => onSelectMode('GPS')} style={modeBtnStyle('GPS')}>
          <MapPin size={15} />
          <span>Position GPS</span>
          {settings?.gpsConfigured && (
            <span style={{ fontSize: 9, background: '#3b82f6', color: 'white', padding: '1px 5px', borderRadius: 4 }}>Calibré</span>
          )}
        </button>

        <button type="button" onClick={() => onSelectMode('MANUEL')} style={modeBtnStyle('MANUEL')}>
          <UserCheck size={15} />
          <span>Manuel</span>
          <span style={{ fontSize: 9, background: 'var(--text3)', color: 'white', padding: '1px 5px', borderRadius: 4 }}>Repli</span>
        </button>
      </div>

      {/* Contenu spécifique au mode sélectionné */}
      <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
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
                  onChange={e => onRoomChange(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
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
                onChange={e => onQrInputChange(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={() => onPointer('QR')}
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
                onClick={onDetectGPS}
                disabled={gpsDetecting}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: 'var(--surface)',
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
                onClick={() => onPointer('GPS')}
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

        {selectedMode === 'MANUEL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
              Signalement déclaratif direct. Utilisable si l'établissement n'a pas encore calibré les bornes GPS ou les QR codes de salle.
            </div>

            <div>
              <button
                type="button"
                onClick={() => onPointer('MANUEL')}
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
    </>
  )
}
