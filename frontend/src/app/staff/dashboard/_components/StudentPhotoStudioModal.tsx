'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Camera, RefreshCw, Upload, Check, AlertCircle, Video, VideoOff, Sparkles, User, RotateCcw } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  student: {
    id: string
    userId?: string
    firstName?: string
    lastName?: string
    name?: string
    matricule?: string | null
    className?: string
    photoUrl?: string | null
  }
  onClose: () => void
  onSuccess: (newPhotoUrl: string | null) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function StudentPhotoStudioModal({ student, onClose, onSuccess, onToast }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [mode, setMode] = useState<'WEBCAM' | 'UPLOAD'>('WEBCAM')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Démarrer la webcam
  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setCameraActive(true)
      }
    } catch (err: any) {
      setCameraActive(false)
      const msg = err.name === 'NotAllowedError'
        ? 'Accès à la caméra refusé. Activez la caméra dans les permissions de votre navigateur.'
        : 'Aucune caméra détectée ou accessible.'
      setCameraError(msg)
      setMode('UPLOAD')
    }
  }, [])

  // Stopper la webcam
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  useEffect(() => {
    if (mode === 'WEBCAM' && !capturedImage) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [mode, capturedImage, startCamera, stopCamera])

  // Déclencher la prise de vue avec compte à rebours de 3 secondes
  const triggerCapture = (instant = false) => {
    if (instant) {
      captureFrame()
      return
    }
    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          captureFrame()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  // Capturer la frame courante et rogner au format portrait d'identité 3:4
  const captureFrame = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480

    // Cadrage portrait 3:4 centré
    const targetRatio = 3 / 4
    let cropW = Math.round(vh * targetRatio)
    let cropH = vh
    if (cropW > vw) {
      cropW = vw
      cropH = Math.round(vw / targetRatio)
    }

    const startX = Math.round((vw - cropW) / 2)
    const startY = Math.round((vh - cropH) / 2)

    const canvas = document.createElement('canvas')
    const finalW = 480
    const finalH = 640
    canvas.width = finalW
    canvas.height = finalH

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Miroir horizontal pour que le cadrage corresponde à ce que voyait l'utilisateur
    ctx.translate(finalW, 0)
    ctx.scale(-1, 1)

    ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, finalW, finalH)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(dataUrl)
    stopCamera()
  }

  // Traiter un fichier uploadé et le recadrer en format identité
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      onToast('Format non supporté. Veuillez choisir une image.', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const targetRatio = 3 / 4
        let cropW = img.width
        let cropH = img.height

        if (img.width / img.height > targetRatio) {
          cropW = Math.round(img.height * targetRatio)
        } else {
          cropH = Math.round(img.width / targetRatio)
        }

        const startX = Math.round((img.width - cropW) / 2)
        const startY = Math.round((img.height - cropH) / 2)

        const canvas = document.createElement('canvas')
        const finalW = 480
        const finalH = 640
        canvas.width = finalW
        canvas.height = finalH

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, startX, startY, cropW, cropH, 0, 0, finalW, finalH)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
          setCapturedImage(dataUrl)
        }
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Sauvegarder la photo officielle sur le dossier de l'élève
  const handleSave = async () => {
    if (!capturedImage) return
    setSaving(true)
    const studentTargetId = student.userId || student.id

    try {
      const res = await fetchApi(`/api/v2/students/${studentTargetId}/official-photo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ photoUrl: capturedImage }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(`Photo officielle enregistrée pour ${student.firstName} ${student.lastName} !`, 'success')
        onSuccess(json.data?.photoUrl || capturedImage)
        onClose()
      } else {
        onToast(json.message || 'Erreur lors de l\'enregistrement', 'error')
      }
    } catch {
      onToast('Erreur de communication avec le serveur', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Supprimer la photo officielle
  const handleRemovePhoto = async () => {
    if (!confirm(`Supprimer la photo d'identité officielle de ${student.firstName} ${student.lastName} ?`)) return
    setSaving(true)
    const studentTargetId = student.userId || student.id

    try {
      const res = await fetchApi(`/api/v2/students/${studentTargetId}/official-photo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ photoUrl: null }),
      })
      const json = await res.json()
      if (json.success) {
        onToast('Photo d\'identité officielle retirée', 'success')
        onSuccess(null)
        onClose()
      } else {
        onToast(json.message || 'Erreur lors de la suppression', 'error')
      }
    } catch {
      onToast('Erreur de communication', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* En-tête */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--blue)' }}>
              <Camera size={17} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="text-sm font-black m-0 leading-tight" style={{ color: 'var(--text)' }}>
                Studio Photo · Dossier Officiel
              </h3>
              <p className="text-[11.5px] font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
                {student.lastName} {student.firstName} · {student.className || 'Élève'} {student.matricule ? `(${student.matricule})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps Studio */}
        <div className="p-4 sm:p-5 flex flex-col items-center">
          {/* Bascule Onglets Webcam / Upload si pas encore de capture */}
          {!capturedImage && (
            <div className="flex p-1 rounded-xl border mb-3 w-full max-w-xs" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => setMode('WEBCAM')}
                className="flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold border-0 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                style={{
                  background: mode === 'WEBCAM' ? 'var(--surface)' : 'transparent',
                  color: mode === 'WEBCAM' ? 'var(--text)' : 'var(--text3)',
                  boxShadow: mode === 'WEBCAM' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Video size={13} />
                <span>Webcam Direct</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('UPLOAD')}
                className="flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold border-0 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                style={{
                  background: mode === 'UPLOAD' ? 'var(--surface)' : 'transparent',
                  color: mode === 'UPLOAD' ? 'var(--text)' : 'var(--text3)',
                  boxShadow: mode === 'UPLOAD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Upload size={13} />
                <span>Fichier Image</span>
              </button>
            </div>
          )}

          {/* Zone d'affichage : Webcam ou Aperçu capturé */}
          <div
            className="relative w-64 h-80 sm:w-72 sm:h-96 rounded-2xl overflow-hidden border-2 shadow-inner flex items-center justify-center bg-black"
            style={{ borderColor: 'var(--border2)' }}
          >
            {capturedImage ? (
              <img src={capturedImage} alt="Cliché pris" className="w-full h-full object-cover" />
            ) : mode === 'WEBCAM' ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Guide de cadrage officiel photo d'identité (ovale de visage et repères d'épaules) */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div
                    className="w-40 h-52 sm:w-44 sm:h-60 rounded-[50%/60%] border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                  />
                  <div className="text-[10.5px] font-extrabold text-white/90 uppercase tracking-widest mt-3 drop-shadow">
                    Centrer le visage
                  </div>
                </div>

                {/* Décompte visuel */}
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                    <span className="text-7xl font-black text-white animate-ping">{countdown}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="p-6 text-center text-white/80 space-y-3">
                <Upload size={36} className="mx-auto text-white/50" />
                <div className="text-xs font-bold">Sélectionnez une photo nette de face</div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white border-0 cursor-pointer shadow-sm"
                  style={{ background: 'var(--blue)' }}
                >
                  Choisir un fichier
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />

          {cameraError && mode === 'WEBCAM' && (
            <div className="mt-3 p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold max-w-sm" style={{ background: 'var(--amber-light)', borderColor: 'var(--amber)', color: 'var(--amber)' }}>
              <AlertCircle size={15} className="shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Boutons d'action sous le cadrage */}
          <div className="mt-4 flex items-center gap-2.5 w-full justify-center">
            {capturedImage ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCapturedImage(null)
                    if (mode === 'WEBCAM') startCamera()
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <RotateCcw size={13} />
                  <span>Reprendre</span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white border-0 cursor-pointer flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                  style={{ background: 'var(--green)' }}
                >
                  <Check size={14} />
                  <span>{saving ? 'Enregistrement...' : 'Valider pour le dossier'}</span>
                </button>
              </>
            ) : mode === 'WEBCAM' ? (
              <>
                <button
                  type="button"
                  onClick={() => triggerCapture(true)}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white border-0 cursor-pointer flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                  style={{ background: 'var(--blue)' }}
                >
                  <Camera size={14} />
                  <span>Prendre le cliché</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerCapture(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer flex items-center gap-1.5"
                  style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text2)' }}
                  title="Décompte 3 secondes"
                >
                  <span>Minuteur 3s</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer flex items-center gap-1.5"
                style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <Upload size={13} />
                <span>Parcourir mes dossiers</span>
              </button>
            )}
          </div>
        </div>

        {/* Pied de modale */}
        <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
          <div>
            {student.photoUrl && (
              <button
                type="button"
                disabled={saving}
                onClick={handleRemovePhoto}
                className="text-[11px] font-bold text-red-600 bg-transparent border-0 cursor-pointer hover:underline"
              >
                Supprimer la photo actuelle
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
