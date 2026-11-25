'use client'

import React, { useState, useRef } from 'react'
import {
  Check,
  X,
  FileText,
  AlertCircle,
  RefreshCw,
  Loader2,
  Camera,
  Eye,
  Paperclip,
  ExternalLink,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

export interface PieceItem {
  id: string
  requirementId?: string
  code: string
  libelle: string
  received: boolean
  receivedAt?: string | null
  note?: string | null
  obligatoire?: boolean
  fileKey?: string | null
}

interface Props {
  onboardingId: string
  pieces: PieceItem[]
  readOnly?: boolean
  sourceType?: string
  onPieceUpdated?: () => void
}

export default function EnrollmentPieceChecklist({
  onboardingId,
  pieces,
  readOnly = false,
  sourceType,
  onPieceUpdated,
}: Props) {
  const [updatingCode, setUpdatingCode] = useState<string | null>(null)
  const [uploadingCode, setUploadingCode] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; isPdf: boolean } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const targetCodeRef = useRef<string | null>(null)

  const handleTogglePiece = async (piece: PieceItem) => {
    if (readOnly || updatingCode || uploadingCode) return
    setUpdatingCode(piece.code)
    setError(null)
    try {
      const nextReceived = !piece.received
      const res = await fetchApi(`/api/v2/eleve-onboarding/${onboardingId}/pieces/${piece.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: nextReceived }),
      })
      const data = await res.json()
      if (data.success) {
        onPieceUpdated?.()
      } else {
        setError(data.message || 'Erreur lors de la mise à jour')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setUpdatingCode(null)
    }
  }

  const handleInitPieces = async () => {
    setInitializing(true)
    setError(null)
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/${onboardingId}/pieces/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType }),
      })
      const data = await res.json()
      if (data.success) {
        onPieceUpdated?.()
      } else {
        setError(data.message || 'Erreur lors de l\'initialisation')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setInitializing(false)
    }
  }

  const triggerUpload = (e: React.MouseEvent, code: string) => {
    e.stopPropagation()
    targetCodeRef.current = code
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const code = targetCodeRef.current
    if (!file || !code) return

    setUploadingCode(code)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/v2/eleve-onboarding/${onboardingId}/pieces/${code}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        onPieceUpdated?.()
      } else {
        setError(data.message || 'Échec du téléversement')
      }
    } catch {
      setError('Erreur lors de l\'envoi du fichier')
    } finally {
      setUploadingCode(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleOpenPreview = (e: React.MouseEvent, piece: PieceItem) => {
    e.stopPropagation()
    const url = `/api/v2/eleve-onboarding/${onboardingId}/pieces/${piece.code}/file`
    const isPdf = piece.fileKey?.toLowerCase().endsWith('.pdf') ?? false
    setPreviewDoc({ url, title: piece.libelle, isPdf })
  }

  if (pieces.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          background: 'var(--bg2, rgba(0,0,0,0.03))',
          borderRadius: 10,
          border: '1px dashed var(--border, #e5e7eb)',
          textAlign: 'center',
        }}
      >
        <FileText size={28} style={{ color: 'var(--text3, #9ca3af)', marginBottom: 8 }} />
        <p style={{ margin: '0 0 10px 0', fontSize: 13, color: 'var(--text2, #4b5563)' }}>
          Aucune pièce justificative configurée pour ce dossier.
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={handleInitPieces}
            disabled={initializing}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--blue, #2563eb)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: initializing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {initializing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Générer la liste des pièces
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Input de fichier masqué */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {error && (
        <div
          style={{
            padding: '7px 12px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            color: 'var(--red, #ef4444)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pieces.map((piece) => {
          const isLoading = updatingCode === piece.code
          const isUploading = uploadingCode === piece.code
          const hasFile = Boolean(piece.fileKey)

          return (
            <div
              key={piece.code}
              onClick={() => !readOnly && handleTogglePiece(piece)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 8,
                border: `1px solid ${piece.received ? 'rgba(22,163,74,0.3)' : 'var(--border, #e5e7eb)'}`,
                background: piece.received ? 'rgba(22,163,74,0.06)' : 'var(--surface, #fff)',
                cursor: readOnly ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    border: `1.5px solid ${piece.received ? 'var(--green, #16a34a)' : 'var(--border, #d1d5db)'}`,
                    background: piece.received ? 'var(--green, #16a34a)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {isLoading || isUploading ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : piece.received ? (
                    <Check size={13} strokeWidth={3} />
                  ) : null}
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #111827)' }}>
                    {piece.libelle}
                  </div>
                  {piece.note && (
                    <div style={{ fontSize: 11, color: 'var(--text3, #9ca3af)', marginTop: 2 }}>
                      {piece.note}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions & Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Visualiser la pièce */}
                {hasFile && (
                  <button
                    type="button"
                    title="Consulter le document numérisé"
                    onClick={(e) => handleOpenPreview(e, piece)}
                    style={{
                      background: 'rgba(37,99,235,0.1)',
                      color: 'var(--blue, #2563eb)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Eye size={12} />
                    Scan
                  </button>
                )}

                {/* Upload / Prise de photo */}
                {!readOnly && (
                  <button
                    type="button"
                    title="Téléverser ou photographier la pièce"
                    onClick={(e) => triggerUpload(e, piece.code)}
                    disabled={isUploading}
                    style={{
                      background: 'var(--bg2, rgba(0,0,0,0.05))',
                      color: 'var(--text2, #4b5563)',
                      border: '1px solid var(--border, #e5e7eb)',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                    {hasFile ? 'Changer' : 'Joindre'}
                  </button>
                )}

                {/* Badge statut */}
                {piece.obligatoire !== false ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: piece.received ? 'var(--green, #16a34a)' : 'var(--red, #ef4444)',
                      background: piece.received ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {piece.received ? 'Reçu' : 'Requis'}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text3, #9ca3af)',
                      background: 'var(--bg2, rgba(0,0,0,0.04))',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    Facultatif
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modale de prévisualisation sécurisée */}
      {previewDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 16,
          }}
          onClick={() => setPreviewDoc(null)}
        >
          <div
            style={{
              background: 'var(--surface, #fff)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 700,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border, #e5e7eb)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--surface2, #f9fafb)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #111827)' }}>
                {previewDoc.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--blue, #2563eb)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={14} /> Plein écran
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text3, #9ca3af)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'var(--bg2, #f3f4f6)',
              }}
            >
              {previewDoc.isPdf ? (
                <iframe
                  src={previewDoc.url}
                  style={{ width: '100%', height: '60vh', border: 'none', borderRadius: 8 }}
                  title={previewDoc.title}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewDoc.url}
                  alt={previewDoc.title}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '60vh',
                    borderRadius: 8,
                    objectFit: 'contain',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
