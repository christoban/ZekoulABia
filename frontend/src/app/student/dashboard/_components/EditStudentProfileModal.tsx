'use client'

import { useState } from 'react'
import { X, Lock, Check, AlertCircle, Save, Phone, Calendar, User, Camera, Mail } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import type { CompletenessData } from './ProfileIncompleteBanner'

interface Props {
  initialData: CompletenessData
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  onUpdated?: () => void
}

export default function EditStudentProfileModal({ initialData, onClose, onToast, onUpdated }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const { student } = initialData

  const [phone, setPhone] = useState(student.phone || '')
  const [dateOfBirth, setDateOfBirth] = useState(
    student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : ''
  )
  const [gender, setGender] = useState(student.gender || '')
  const [photoUrl, setPhotoUrl] = useState(student.photoUrl || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/students/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: phone.trim() || undefined,
          dateOfBirth: dateOfBirth || undefined,
          gender: gender || undefined,
          photoUrl: photoUrl.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(t('editProfile.toast_success') || 'Profil mis à jour avec succès !', 'success')
        onUpdated?.()
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

  const handleReportError = () => {
    onToast(
      'Pour toute correction sur votre Nom ou Classe, veuillez contacter le Censeur ou le Secrétariat avec votre acte de naissance.',
      'info'
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* En-tête de la modale */}
        <div className="px-4 py-3 sm:px-5 sm:py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-sm sm:text-base font-black m-0" style={{ color: 'var(--text)' }}>
              {t('editProfile.modal_title') || 'Modifier mes informations personnelles'}
            </h3>
            <p className="text-xs font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
              Dossier élève autonome · Second cycle
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps avec formulaire */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
          {/* Informations administratives verrouillées */}
          <div className="p-3 rounded-xl border" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text3)' }}>
                <Lock size={12} /> Données d'état civil officielles (Verrouillées)
              </span>
              <button
                type="button"
                onClick={handleReportError}
                className="text-[11px] font-bold border-none bg-transparent cursor-pointer p-0 underline"
                style={{ color: 'var(--accent)' }}
              >
                Signaler une erreur
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10.5px] font-bold" style={{ color: 'var(--text3)' }}>Nom & Prénom</span>
                <div className="font-extrabold truncate" style={{ color: 'var(--text)' }}>{student.lastName} {student.firstName}</div>
              </div>
              <div>
                <span className="text-[10.5px] font-bold" style={{ color: 'var(--text3)' }}>Classe</span>
                <div className="font-extrabold truncate" style={{ color: 'var(--text)' }}>{student.className}</div>
              </div>
              <div>
                <span className="text-[10.5px] font-bold" style={{ color: 'var(--text3)' }}>Matricule</span>
                <div className="font-extrabold truncate" style={{ color: 'var(--text)' }}>{student.matricule || '—'}</div>
              </div>
              <div>
                <span className="text-[10.5px] font-bold" style={{ color: 'var(--text3)' }}>Email du compte</span>
                <div className="font-extrabold truncate" style={{ color: 'var(--text)' }}>{student.email}</div>
              </div>
            </div>
          </div>

          {/* Date de naissance */}
          <div>
            <label className="block text-xs font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
              <Calendar size={13} />
              <span>Date de naissance</span>
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-xs font-semibold outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>

          {/* Sexe / Genre */}
          <div>
            <label className="block text-xs font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
              <User size={13} />
              <span>Sexe / Genre</span>
            </label>
            <div className="flex gap-2">
              {[
                { value: 'M', label: 'Masculin (M)' },
                { value: 'F', label: 'Féminin (F)' },
              ].map((g) => (
                <button
                  type="button"
                  key={g.value}
                  onClick={() => setGender(g.value)}
                  className="flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center"
                  style={{
                    background: gender === g.value ? 'var(--sidebar)' : 'var(--bg)',
                    color: gender === g.value ? '#ffffff' : 'var(--text2)',
                    borderColor: gender === g.value ? 'var(--sidebar)' : 'var(--border)',
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Numéro de téléphone */}
          <div>
            <label className="block text-xs font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
              <Phone size={13} />
              <span>Téléphone personnel (SMS & Alertes)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex : +237 6XX XX XX XX"
              className="w-full px-3 py-2 rounded-lg border text-xs font-semibold outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>

          {/* URL Photo d'identité */}
          <div>
            <label className="block text-xs font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
              <Camera size={13} />
              <span>Lien / URL de la photo d'identité</span>
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border text-xs font-semibold outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <p className="text-[11px] font-medium m-0 mt-1" style={{ color: 'var(--text3)' }}>
              Photo claire de face pour la carte scolaire dématérialisée et le trombinoscope.
            </p>
          </div>

          {/* Pied de formulaire */}
          <div className="pt-3 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white border-0 cursor-pointer inline-flex items-center gap-1.5 transition-all"
              style={{
                background: 'var(--blue)',
                opacity: saving ? 0.7 : 1,
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              <Save size={13} />
              <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
