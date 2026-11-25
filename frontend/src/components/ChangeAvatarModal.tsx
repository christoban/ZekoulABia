'use client'

import { useState, useRef } from 'react'
import { X, Upload, Trash2, Camera, Check, AlertCircle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  currentAvatarUrl?: string | null
  userName?: string
  onClose: () => void
  onSuccess: (newAvatarUrl: string | null) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function ChangeAvatarModal({ currentAvatarUrl, userName, onClose, onSuccess, onToast }: Props) {
  const tcommon = useT('common')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl || null)
  const [saving, setSaving] = useState(false)
  const [hasChanged, setHasChanged] = useState(false)

  // Compression automatique et redimensionnement via Canvas natif (max 256x256)
  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 256
          let w = img.width
          let h = img.height

          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w)
              w = maxDim
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h)
              h = maxDim
            }
          }

          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas context not available'))
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          resolve(dataUrl)
        }
        img.onerror = () => reject(new Error('Image decode error'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('File read error'))
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      onToast('Format non supporté. Veuillez choisir une image (JPG, PNG, WEBP)', 'error')
      return
    }

    try {
      const compressedDataUrl = await processImage(file)
      setPreview(compressedDataUrl)
      setHasChanged(true)
    } catch {
      onToast('Erreur lors du traitement de l\'image', 'error')
    }
  }

  const handleRemove = () => {
    setPreview(null)
    setHasChanged(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/users/me/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatarUrl: preview }),
      })
      const json = await res.json()
      if (json.success) {
        // Mise à jour de la session locale pour persistance immédiate
        try {
          const raw = localStorage.getItem('zekoulabia_user')
          if (raw) {
            const userObj = JSON.parse(raw)
            userObj.avatarUrl = json.data?.avatarUrl || null
            localStorage.setItem('zekoulabia_user', JSON.stringify(userObj))
          }
        } catch { /* ignore */ }

        window.dispatchEvent(
          new CustomEvent('zekoulabia:user-updated', {
            detail: { avatarUrl: json.data?.avatarUrl || null },
          })
        )

        onToast(preview ? 'Photo de profil mise à jour !' : 'Photo de profil supprimée', 'success')
        onSuccess(json.data?.avatarUrl || null)
        onClose()
      } else {
        onToast(json.message || 'Erreur lors de la mise à jour', 'error')
      }
    } catch {
      onToast('Erreur de communication avec le serveur', 'error')
    } finally {
      setSaving(false)
    }
  }

  const initials = userName
    ? userName
        .split(' ')
        .map((p) => p[0] ?? '')
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-black m-0" style={{ color: 'var(--text)' }}>
            Photo de profil
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            {preview ? (
              <img
                src={preview}
                alt="Aperçu avatar"
                className="w-24 h-24 rounded-full object-cover border-2 shadow-md"
                style={{ borderColor: 'var(--border)' }}
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-black text-white shadow-md"
                style={{ background: 'linear-gradient(135deg, var(--purple), var(--blue))' }}
              >
                {initials}
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 rounded-full text-white border-2 border-[var(--surface)] shadow-md cursor-pointer transition-transform active:scale-90"
              style={{ background: 'var(--primary)' }}
              title="Choisir une image"
            >
              <Camera size={14} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>
              {userName || 'Votre compte'}
            </div>
            <p className="text-[11px] font-medium m-0 mt-1 max-w-[240px]" style={{ color: 'var(--text3)' }}>
              Cette photo personnalise votre compte et vos messages. Elle ne modifie pas les pièces officielles de votre dossier.
            </p>
          </div>

          <div className="flex gap-2 w-full pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}
            >
              <Upload size={13} />
              <span>{preview ? 'Changer' : 'Téléverser'}</span>
            </button>

            {preview && (
              <button
                type="button"
                onClick={handleRemove}
                className="py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                style={{ background: 'var(--red-light)', borderColor: 'var(--red)', color: 'var(--red)' }}
                title="Supprimer la photo"
              >
                <Trash2 size={13} />
                <span>Retirer</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-3 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            Annuler
          </button>

          <button
            type="button"
            disabled={!hasChanged || saving}
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-white border-0 transition-all inline-flex items-center gap-1.5"
            style={{
              background: 'var(--blue)',
              opacity: !hasChanged || saving ? 0.6 : 1,
              cursor: !hasChanged || saving ? 'not-allowed' : 'pointer',
            }}
          >
            <Check size={13} />
            <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
