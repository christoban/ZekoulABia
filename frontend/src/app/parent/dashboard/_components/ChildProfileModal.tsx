'use client'

import { useState } from 'react'
import {
  X,
  User,
  School,
  Lock,
  Smartphone,
  Save,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
  Calendar,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { isFirstCycleOrPrimary } from '@/lib/academicExamDetector'
import type { ChildWithStats } from '../_types'

interface Props {
  child: ChildWithStats
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  onUpdated?: () => void
}

export default function ChildProfileModal({ child, onClose, onToast, onUpdated }: Props) {
  const tc = useT('common')

  const isJunior = isFirstCycleOrPrimary(child.classeNom)

  // Initialisation des champs éditables
  const initialDob = child.dateOfBirth ? child.dateOfBirth.slice(0, 10) : ''
  const [phone, setPhone] = useState(child.phone || '')
  const [dateOfBirth, setDateOfBirth] = useState(initialDob)
  const [gender, setGender] = useState(child.gender || '')

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isJunior) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      const payload: { phone?: string; dateOfBirth?: string; gender?: string } = {
        phone: phone.trim(),
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
      }

      const res = await fetchApi(`/api/v2/parent/children/${child.studentId}/profile`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok || !d.success) throw new Error(d.message || tc('errors.generic_error'))

      setSaveSuccess(true)
      onToast('Dossier de votre enfant mis à jour avec succès', 'success')
      onUpdated?.()
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : tc('errors.generic_error')
      setSaveError(msg)
      onToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-4 py-3 sm:px-5 sm:py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg,var(--primary),var(--accent))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              {child.prenom[0]}
              {child.nom[0]}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black m-0" style={{ color: 'var(--text)' }}>
                {child.prenom} {child.nom}
              </h3>
              <p className="text-xs font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
                Classe : {child.classeNom || '—'} {child.matricule ? `· Matricule : ${child.matricule}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps de la modale */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Bandeau de cycle et tutelle */}
          {isJunior ? (
            <div className="p-3 rounded-xl border flex items-start gap-2.5 bg-[var(--blue-light)] border-[var(--blue)]/30 text-[var(--blue)]">
              <Shield size={16} className="shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-extrabold block mb-0.5">Tutelle parentale directe · Premier cycle / Primaire</span>
                En tant que parent ou tuteur légal, vous administrez les coordonnées officielles et informations déclaratives de votre enfant.
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl border flex items-start gap-2.5 bg-[var(--amber-light)] border-[var(--amber)]/30 text-[var(--amber)]">
              <Info size={16} className="shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-extrabold block mb-0.5">Consultation du dossier · Second cycle</span>
                Votre enfant est scolarisé au second cycle. Son dossier officiel est consultable ci-dessous en toute transparence ; la mise à jour de ses coordonnées directes est gérée par l&apos;élève ou par le secrétariat.
              </div>
            </div>
          )}

          {/* 1. État civil certifié */}
          <div className="p-3.5 rounded-xl border bg-[var(--bg)] border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between border-b pb-2 border-[var(--border)]">
              <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-[var(--text3)]">
                <User size={12} /> Données d&apos;état civil officielles
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg2)] text-[var(--text3)]">
                <Lock size={10} /> Certifié
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10.5px] font-bold text-[var(--text3)] block">Nom de famille</span>
                <span className="font-bold text-[var(--text)] mt-0.5 block">{child.nom}</span>
              </div>
              <div>
                <span className="text-[10.5px] font-bold text-[var(--text3)] block">Prénom(s)</span>
                <span className="font-bold text-[var(--text)] mt-0.5 block">{child.prenom}</span>
              </div>
              <div>
                <span className="text-[10.5px] font-bold text-[var(--text3)] block">Matricule national</span>
                <span className="font-mono font-bold text-[var(--primary)] mt-0.5 block">{child.matricule || 'En cours d\'attribution'}</span>
              </div>
              <div>
                <span className="text-[10.5px] font-bold text-[var(--text3)] block">Classe inscrite</span>
                <span className="font-bold text-[var(--text)] mt-0.5 block">{child.classeNom || '—'}</span>
              </div>
            </div>
          </div>

          {/* 2. Coordonnées & Informations modifiables */}
          <div className="p-3.5 rounded-xl border bg-[var(--bg)] border-[var(--border)] space-y-3">
            <div className="flex items-center gap-2 border-b pb-2 border-[var(--border)]">
              <Smartphone size={13} className="text-[var(--primary)]" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text3)]">
                {isJunior ? 'Informations administrables par le parent' : 'Coordonnées de l\'élève'}
              </span>
            </div>

            {isJunior ? (
              <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-[var(--text2)] block mb-1">
                    Numéro de téléphone ou contact d&apos;urgence pour cet enfant
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 677000000"
                    className="w-full h-9 px-3 rounded-lg border text-xs outline-none bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
                  />
                  <span className="text-[10.5px] text-[var(--text3)] mt-1 block">
                    Utilisé par l&apos;école en cas de besoin urgent concernant cet enfant.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--text2)] block mb-1">
                      Date de naissance
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[var(--text2)] block mb-1">
                      Genre / Sexe
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
                    >
                      <option value="">Non renseigné</option>
                      <option value="M">Masculin (Garçon)</option>
                      <option value="F">Féminin (Fille)</option>
                    </select>
                  </div>
                </div>

                {saveError && (
                  <div className="p-2 rounded-lg bg-[var(--red-light)] text-[var(--red)] text-xs flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{saveError}</span>
                  </div>
                )}

                {saveSuccess && (
                  <div className="p-2 rounded-lg bg-[var(--green-light)] text-[var(--green)] text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    <span>Dossier enregistré avec succès</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-8 px-4 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
                  >
                    {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10.5px] font-bold text-[var(--text3)] block">Téléphone contact</span>
                    <span className="font-bold text-[var(--text)] mt-0.5 block">{child.phone || 'Non renseigné'}</span>
                  </div>
                  <div>
                    <span className="text-[10.5px] font-bold text-[var(--text3)] block">Date de naissance</span>
                    <span className="font-bold text-[var(--text)] mt-0.5 block">
                      {child.dateOfBirth ? new Date(child.dateOfBirth).toLocaleDateString('fr-FR') : 'Non renseignée'}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-[var(--text3)] pt-2 border-t border-[var(--border)]">
                  Les coordonnées directes de cet élève du second cycle sont gérées directement par l&apos;élève depuis son espace ou par le secrétariat.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pied de page */}
        <div className="px-4 py-3 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border text-xs font-bold bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
