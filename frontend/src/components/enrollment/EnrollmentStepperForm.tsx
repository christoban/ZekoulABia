'use client'

import React, { useState, useEffect } from 'react'
import { Check, ChevronRight, ChevronLeft, Save, Send, AlertTriangle, Users, BookOpen, Smartphone, FileText, Loader2, WifiOff } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import EnrollmentPieceChecklist, { type PieceItem } from './EnrollmentPieceChecklist'

interface ClasseSuggestion {
  id: string
  name: string
  level: string | null
  capacity: number
  effectifActuel: number
  placesRestantes: number
  estPleine: boolean
  tauxRemplissage: number
}

interface FormState {
  nom: string
  prenom: string
  dateNaissance: string
  gender: 'M' | 'F' | ''
  classId: string
  level: string
  sourceType: string
  recipientType: 'ELEVE' | 'PARENT' | 'LES_DEUX'
  contactEmail: string
  contactTelephone: string
  parentContactEmail: string
  parentContactTelephone: string
  eleveADispositif: boolean
  eleveDispositifOS: string
  parentADispositif: boolean
  parentDispositifOS: string
  derogationCapacite: boolean
  motifDerogation: string
}

interface Props {
  onSuccess: (onboardingId: string) => void
  onCancel?: () => void
  initialData?: Partial<FormState>
}

const ETAPES = [
  { id: 1, label: 'Élève', icon: Users },
  { id: 2, label: 'Classe & Capacité', icon: BookOpen },
  { id: 3, label: 'Contacts & Accès', icon: Smartphone },
  { id: 4, label: 'Pièces & Finalisation', icon: FileText },
]

export default function EnrollmentStepperForm({ onSuccess, onCancel, initialData }: Props) {
  const isOnline = useOnlineStatus()
  const { addToQueue } = useSyncQueue()
  const [etapeActive, setEtapeActive] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ClasseSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const [form, setForm] = useState<FormState>({
    nom: initialData?.nom || '',
    prenom: initialData?.prenom || '',
    dateNaissance: initialData?.dateNaissance || '',
    gender: initialData?.gender || '',
    classId: initialData?.classId || '',
    level: initialData?.level || '',
    sourceType: initialData?.sourceType || 'AUTOSERVICE',
    recipientType: initialData?.recipientType || 'ELEVE',
    contactEmail: initialData?.contactEmail || '',
    contactTelephone: initialData?.contactTelephone || '',
    parentContactEmail: initialData?.parentContactEmail || '',
    parentContactTelephone: initialData?.parentContactTelephone || '',
    eleveADispositif: initialData?.eleveADispositif ?? false,
    eleveDispositifOS: initialData?.eleveDispositifOS || 'ANDROID',
    parentADispositif: initialData?.parentADispositif ?? true,
    parentDispositifOS: initialData?.parentDispositifOS || 'ANDROID',
    derogationCapacite: false,
    motifDerogation: '',
  })

  // Chargement des suggestions de classe
  useEffect(() => {
    async function loadSuggestions() {
      setLoadingSuggestions(true)
      try {
        const url = form.level
          ? `/api/v2/eleve-onboarding/classes-suggestions?level=${encodeURIComponent(form.level)}`
          : '/api/v2/eleve-onboarding/classes-suggestions'
        const res = await fetchApi(url)
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setSuggestions(data.data)
        }
      } catch {
        // silencieux
      } finally {
        setLoadingSuggestions(false)
      }
    }
    loadSuggestions()
  }, [form.level])

  const classeSelectionnee = suggestions.find((s) => s.id === form.classId)

  const handleCreerDossier = async (soumettreDirectement: boolean) => {
    if (!form.nom.trim()) {
      setError('Le nom de l\'élève est requis.')
      setEtapeActive(1)
      return
    }

    if (classeSelectionnee?.estPleine && !form.derogationCapacite) {
      setError('Cette classe a atteint sa capacité maximale. Une dérogation avec motif est requise.')
      setEtapeActive(2)
      return
    }

    if (classeSelectionnee?.estPleine && form.derogationCapacite && !form.motifDerogation.trim()) {
      setError('Le motif de dérogation de capacité est obligatoire.')
      setEtapeActive(2)
      return
    }

    if (soumettreDirectement && !isOnline) {
      setError('La soumission pour validation nécessite une connexion Internet active. Vous pouvez enregistrer le dossier en brouillon hors-ligne.')
      return
    }

    setLoading(true)
    setError(null)

    const payload = {
      nomProvisoire: `${form.nom} ${form.prenom}`.trim(),
      classId: form.classId || null,
      contactEmail: form.contactEmail.trim() || null,
      contactTelephone: form.contactTelephone.trim() || null,
      parentContactEmail: form.parentContactEmail.trim() || null,
      parentContactTelephone: form.parentContactTelephone.trim() || null,
      recipientType: form.recipientType,
      sourceType: form.sourceType,
      eleveADispositif: form.eleveADispositif,
      eleveDispositifOS: form.eleveADispositif ? form.eleveDispositifOS : null,
      parentADispositif: form.parentADispositif,
      parentDispositifOS: form.parentADispositif ? form.parentDispositifOS : null,
      aucunContactDisponible: !form.contactTelephone && !form.parentContactTelephone,
    }

    if (!isOnline && !soumettreDirectement) {
      try {
        await addToQueue({
          type: 'ENROLLMENT_DRAFT',
          endpoint: '/api/v2/eleve-onboarding',
          method: 'POST',
          payload,
        })
        setLoading(false)
        onSuccess('offline-draft')
        return
      } catch (err: unknown) {
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde hors ligne')
        return
      }
    }

    try {
      // 1. Créer le squelette
      const res = await fetchApi('/api/v2/eleve-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.message || 'Erreur lors de la création du dossier')
        setLoading(false)
        return
      }

      const onboardingId = data.data.onboardingId

      // 2. Initialiser les pièces justificatives
      await fetchApi(`/api/v2/eleve-onboarding/${onboardingId}/pieces/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: form.sourceType }),
      })

      // 3. Si demandé, soumettre pour validation
      if (soumettreDirectement) {
        await fetchApi(`/api/v2/eleve-onboarding/${onboardingId}/submit`, {
          method: 'POST',
        })
      }

      onSuccess(onboardingId)
    } catch {
      if (!soumettreDirectement) {
        try {
          await addToQueue({
            type: 'ENROLLMENT_DRAFT',
            endpoint: '/api/v2/eleve-onboarding',
            method: 'POST',
            payload,
          })
          setLoading(false)
          onSuccess('offline-draft')
          return
        } catch {
          // ignore
        }
      }
      setError('Erreur de communication avec le serveur')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--surface, #fff)',
    color: 'var(--text, #111827)',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box' as const,
  }

  return (
    <div
      style={{
        background: 'var(--surface, #fff)',
        borderRadius: 14,
        border: '1px solid var(--border, #e5e7eb)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        maxWidth: 700,
        margin: '0 auto',
      }}
    >
      {/* Stepper Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: 'var(--surface2, #f9fafb)',
          borderBottom: '1px solid var(--border, #e5e7eb)',
        }}
      >
        {ETAPES.map((step) => {
          const Icon = step.icon
          const isActive = etapeActive === step.id
          const isDone = etapeActive > step.id
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setEtapeActive(step.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 6px',
                background: isActive ? 'var(--surface, #fff)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--green, #16a34a)' : '2px solid transparent',
                cursor: 'pointer',
                color: isActive ? 'var(--green, #16a34a)' : isDone ? 'var(--text, #111827)' : 'var(--text3, #9ca3af)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: isDone ? 'var(--green, #16a34a)' : isActive ? 'rgba(22,163,74,0.15)' : 'var(--border, #e5e7eb)',
                  color: isDone ? '#fff' : isActive ? 'var(--green, #16a34a)' : 'var(--text3, #9ca3af)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {isDone ? <Check size={12} strokeWidth={3} /> : step.id}
              </div>
              <span className="hide-mobile">{step.label}</span>
            </button>
          )
        })}
      </div>

      {/* Erreur */}
      {error && (
        <div
          style={{
            margin: 16,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            color: 'var(--red, #ef4444)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Corps du formulaire */}
      <div style={{ padding: 20 }}>
        {/* ÉTAPE 1 : Identité de l'élève */}
        {etapeActive === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700 }}>1. Identité de l&apos;élève</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Nom de famille *</label>
                <input
                  type="text"
                  placeholder="ex: Mbappe"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Prénom(s)</label>
                <input
                  type="text"
                  placeholder="ex: Kylian"
                  value={form.prenom}
                  onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Date de naissance</label>
                <input
                  type="text"
                  placeholder="JJ/MM/AAAA"
                  value={form.dateNaissance}
                  onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Sexe</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
                  style={inputStyle}
                >
                  <option value="">Sélectionner...</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Origine du dossier</label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                style={inputStyle}
              >
                <option value="AUTOSERVICE">Inscription directe / Secrétariat</option>
                <option value="CONCOURS">Lauréat Concours d&apos;entrée</option>
                <option value="TRANSFERT">Transfert d&apos;un autre établissement</option>
                <option value="IMPORT_MASSE">Import de masse</option>
              </select>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : Classe & Capacité */}
        {etapeActive === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700 }}>2. Choix de la classe & Capacité</h3>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Niveau recherché (optionnel)</label>
              <input
                type="text"
                placeholder="ex: 6e, 2nde, Form 1..."
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                style={inputStyle}
              />
            </div>

            {loadingSuggestions ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>
                <Loader2 className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                Calcul des places disponibles...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {suggestions.map((c) => {
                  const isSelected = form.classId === c.id
                  return (
                    <div
                      key={c.id}
                      onClick={() => setForm({ ...form, classId: c.id })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: `1.5px solid ${isSelected ? 'var(--green, #16a34a)' : 'var(--border, #e5e7eb)'}`,
                        background: isSelected ? 'rgba(22,163,74,0.06)' : 'var(--surface, #fff)',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          Effectif : {c.effectifActuel} / {c.capacity > 0 ? c.capacity : 'Illimité'} ({c.tauxRemplissage}%)
                        </div>
                      </div>

                      <div>
                        {c.estPleine ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--red, #ef4444)',
                              background: 'rgba(239,68,68,0.1)',
                              padding: '3px 8px',
                              borderRadius: 6,
                            }}
                          >
                            Classe pleine
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--green, #16a34a)',
                              background: 'rgba(22,163,74,0.1)',
                              padding: '3px 8px',
                              borderRadius: 6,
                            }}
                          >
                            {c.placesRestantes} place(s) dispo
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {classeSelectionnee?.estPleine && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid #d97706',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 700, fontSize: 13 }}>
                  <AlertTriangle size={16} />
                  Capacité maximale atteinte — Dérogation requise
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.derogationCapacite}
                    onChange={(e) => setForm({ ...form, derogationCapacite: e.target.checked })}
                  />
                  Accorder une dérogation exceptionnelle de surcapacité
                </label>
                {form.derogationCapacite && (
                  <input
                    type="text"
                    placeholder="Motif de la dérogation (obligatoire, tracé dans l'audit)..."
                    value={form.motifDerogation}
                    onChange={(e) => setForm({ ...form, motifDerogation: e.target.value })}
                    style={inputStyle}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 3 : Contacts & Profil d'accès */}
        {etapeActive === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700 }}>3. Contacts & Profil d&apos;accès</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Téléphone Parent (SMS / WhatsApp) *</label>
                <input
                  type="text"
                  placeholder="ex: +237699000000"
                  value={form.parentContactTelephone}
                  onChange={(e) => setForm({ ...form, parentContactTelephone: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Email Parent</label>
                <input
                  type="email"
                  placeholder="ex: parent@famille.cm"
                  value={form.parentContactEmail}
                  onChange={(e) => setForm({ ...form, parentContactEmail: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Téléphone Élève (si distinct)</label>
                <input
                  type="text"
                  placeholder="ex: +237677000000"
                  value={form.contactTelephone}
                  onChange={(e) => setForm({ ...form, contactTelephone: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Email Élève</label>
                <input
                  type="email"
                  placeholder="ex: eleve@gmail.com"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Dispositifs numériques disponibles :</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.parentADispositif}
                  onChange={(e) => setForm({ ...form, parentADispositif: e.target.checked })}
                />
                Le parent dispose d&apos;un smartphone / tablette (accès application mobile)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.eleveADispositif}
                  onChange={(e) => setForm({ ...form, eleveADispositif: e.target.checked })}
                />
                L&apos;élève dispose d&apos;un smartphone personnel (Second cycle / Form 4+)
              </label>
            </div>
          </div>
        )}

        {/* ÉTAPE 4 : Récapitulatif & Finalisation */}
        {etapeActive === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700 }}>4. Récapitulatif & Validation</h3>

            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <div><strong>Élève :</strong> {form.nom} {form.prenom} ({form.gender || 'Sexe non précisé'})</div>
              <div><strong>Classe :</strong> {classeSelectionnee?.name || 'Non affectée'}</div>
              <div><strong>Contact parent :</strong> {form.parentContactTelephone || 'Non renseigné'}</div>
              <div><strong>Origine :</strong> {form.sourceType}</div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
              En validant, la liste des pièces justificatives de l&apos;établissement sera automatiquement associée à ce dossier.
              Vous pourrez soit conserver le dossier comme <strong>brouillon</strong>, soit le <strong>soumettre directement</strong> pour validation par la direction.
            </div>
          </div>
        )}
      </div>

      {/* Barre de navigation bas */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'var(--surface2, #f9fafb)',
          borderTop: '1px solid var(--border, #e5e7eb)',
        }}
      >
        <div>
          {etapeActive > 1 ? (
            <button
              type="button"
              onClick={() => setEtapeActive(etapeActive - 1)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid var(--border, #e5e7eb)',
                background: 'var(--surface, #fff)',
                color: 'var(--text, #111827)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ChevronLeft size={15} />
              Précédent
            </button>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text3, #9ca3af)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {etapeActive < 4 ? (
            <button
              type="button"
              onClick={() => setEtapeActive(etapeActive + 1)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--green, #16a34a)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Continuer
              <ChevronRight size={15} />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleCreerDossier(false)}
                disabled={loading}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #e5e7eb)',
                  background: 'var(--surface, #fff)',
                  color: 'var(--text, #111827)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Save size={15} />
                Enregistrer brouillon
              </button>

              <button
                type="button"
                onClick={() => handleCreerDossier(true)}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--green, #16a34a)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Soumettre pour validation
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
