'use client'

import React, { useState, useEffect } from 'react'
import {
  Users,
  BookOpen,
  Home,
  Smartphone,
  FileText,
  FileCheck,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  PlusCircle,
  ArrowLeft,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import {
  type StepperFormState,
  type ClasseSuggestion,
  resoudreCycle,
} from './stepper/types'
import EnrollmentSidebarSummary from './stepper/EnrollmentSidebarSummary'
import Step1Eleve from './stepper/Step1Eleve'
import Step2Scolarite from './stepper/Step2Scolarite'
import Step3Famille from './stepper/Step3Famille'
import Step4AccesNumerique from './stepper/Step4AccesNumerique'
import Step5Pieces from './stepper/Step5Pieces'
import Step6Recapitulatif from './stepper/Step6Recapitulatif'

interface Props {
  onSuccess: (onboardingId: string) => void
  onCancel?: () => void
  initialData?: Partial<StepperFormState>
}

const ETAPES = [
  { id: 1, label: 'Élève', icon: Users },
  { id: 2, label: 'Scolarité', icon: BookOpen },
  { id: 3, label: 'Famille', icon: Home },
  { id: 4, label: 'Accès numérique', icon: Smartphone },
  { id: 5, label: 'Pièces', icon: FileText },
  { id: 6, label: 'Récapitulatif', icon: FileCheck },
]

export default function EnrollmentStepperForm({ onSuccess, onCancel, initialData }: Props) {
  const isOnline = useOnlineStatus()
  const { addToQueue } = useSyncQueue()

  const [etapeActive, setEtapeActive] = useState(1)
  const [etapesValidees, setEtapesValidees] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successDossierId, setSuccessDossierId] = useState<string | null>(null)

  // Suggestions de classes
  const [suggestions, setSuggestions] = useState<ClasseSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [doublonsDetectes, setDoublonsDetectes] = useState<Array<{ id: string; nomComplet: string; dateNaissance?: string }>>([])

  // Pièces requises
  const [piecesState, setPiecesState] = useState([
    { code: 'ACTE_NAISSANCE', libelle: 'Copie certifiée de l’acte de naissance', obligatoire: true, received: true },
    { code: 'BULLETINS_PRECEDENTS', libelle: 'Bulletins de l’année précédente', obligatoire: true, received: false },
    { code: 'CERTIFICAT_MEDICAL', libelle: 'Certificat médical récent', obligatoire: true, received: false },
    { code: 'PHOTOS_IDENTITE', libelle: '4 photos d’identité 4x4', obligatoire: false, received: false },
    { code: 'CERTIFICAT_TRANSFERT', libelle: 'Certificat de transfert / radiation', obligatoire: false, received: false },
  ])

  const [form, setForm] = useState<StepperFormState>({
    origine: initialData?.origine || 'HORS_CONCOURS',
    candidatConcoursId: initialData?.candidatConcoursId,
    nom: initialData?.nom || '',
    prenom: initialData?.prenom || '',
    sexe: initialData?.sexe || '',
    dateNaissance: initialData?.dateNaissance || '',
    lieuNaissance: initialData?.lieuNaissance || '',
    nationalite: initialData?.nationalite || 'Camerounaise',
    photoUrl: initialData?.photoUrl,
    sousSysteme: initialData?.sousSysteme || 'FRANCOPHONE',
    matriculeNational: initialData?.matriculeNational,

    level: initialData?.level || '',
    serie: initialData?.serie,
    classId: initialData?.classId || '',
    etablissementOrigine: initialData?.etablissementOrigine || '',
    derniereClasseSuivie: initialData?.derniereClasseSuivie || '',
    anneePrecedente: initialData?.anneePrecedente || '',
    redoublant: initialData?.redoublant || false,
    lv2: initialData?.lv2,
    pebs: initialData?.pebs,
    motifHorsConcours: initialData?.motifHorsConcours,
    derogationCapacite: initialData?.derogationCapacite || false,
    motifDerogation: initialData?.motifDerogation,

    responsables: initialData?.responsables || [
      {
        nom: '',
        prenom: '',
        lien: 'PERE',
        telephone: '',
        email: '',
        profession: '',
        adresse: '',
        estPrincipal: true,
        estFinancier: true,
        contactUrgence: false,
      },
    ],
    aucunTelephoneDisponible: initialData?.aucunTelephoneDisponible || false,

    dispositifEleve: initialData?.dispositifEleve || 'AUCUN',
    dispositifParent: initialData?.dispositifParent || 'SMARTPHONE_ANDROID',
    profilAccesManuel: false,
    compteEleveType: 'READ_ONLY',
    gestionnaireProfil: 'PARENT',
    canalNotification: 'APPLI_PARENT',

    validableSousReserve: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Charger les classes selon le niveau
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

  const updateForm = (updates: Partial<StepperFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }))
    setErrors({})
  }

  const togglePiece = (code: string) => {
    setPiecesState((prev) =>
      prev.map((p) => (p.code === code ? { ...p, received: !p.received } : p)),
    )
  }

  // Calcul du score de complétude
  const totalObligatoires = piecesState.filter((p) => p.obligatoire).length
  const recuesObligatoires = piecesState.filter((p) => p.obligatoire && p.received).length
  const scoreCompletude = totalObligatoires > 0 ? Math.round((recuesObligatoires / totalObligatoires) * 100) : 100
  const piecesManquantesCount = totalObligatoires - recuesObligatoires

  // Validation de l'étape active avant de continuer
  const validerEtape = (step: number): boolean => {
    const errs: Record<string, string> = {}

    if (step === 1) {
      if (!form.nom.trim()) errs.nom = 'Le nom de famille est obligatoire.'
      if (!form.prenom.trim()) errs.prenom = 'Le prénom est obligatoire.'
      if (!form.sexe) errs.sexe = 'Le sexe est obligatoire.'
      if (!form.dateNaissance) errs.dateNaissance = 'La date de naissance est obligatoire.'
    } else if (step === 2) {
      if (!form.level) errs.level = 'Le niveau demandé est obligatoire.'
      if (!form.classId) errs.classId = 'Une classe doit être sélectionnée.'
      const isNiveauConcours = form.level === '6e' || form.level === 'Form 1'
      if (isNiveauConcours && form.origine === 'HORS_CONCOURS' && !form.motifHorsConcours?.trim()) {
        errs.motifHorsConcours = 'Le motif de candidature hors concours est obligatoire pour ce niveau.'
      }
      const classe = suggestions.find((s) => s.id === form.classId)
      if (classe?.estPleine && !form.derogationCapacite) {
        errs.classId = 'Cette classe est pleine. Une demande de dérogation est obligatoire pour continuer.'
      }
      if (classe?.estPleine && form.derogationCapacite && !form.motifDerogation?.trim()) {
        errs.motifDerogation = 'Le motif de dérogation de capacité est obligatoire.'
      }
    } else if (step === 3) {
      if (form.responsables.length === 0) {
        errs.responsables = 'Au moins un responsable légal est requis.'
      } else {
        const principal = form.responsables[0]
        if (!principal.nom.trim() || !principal.prenom.trim()) {
          errs.responsables = 'Le nom et prénom du responsable principal sont obligatoires.'
        }
        if (!form.aucunTelephoneDisponible && !principal.telephone.trim()) {
          errs.responsables = 'Le numéro de téléphone du responsable est requis (ou cochez la case "Aucun téléphone disponible").'
        }
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (!validerEtape(etapeActive)) return
    setEtapesValidees((prev) => Array.from(new Set([...prev, etapeActive])))
    setEtapeActive((prev) => Math.min(6, prev + 1))
  }

  const handlePrev = () => {
    setErrors({})
    setEtapeActive((prev) => Math.max(1, prev - 1))
  }

  const construirePayload = () => {
    const resp = form.responsables[0] || {}
    return {
      nomProvisoire: `${form.nom} ${form.prenom}`.trim(),
      classId: form.classId || null,
      contactEmail: resp.email?.trim() || null,
      contactTelephone: resp.telephone?.trim() || null,
      parentContactEmail: resp.email?.trim() || null,
      parentContactTelephone: resp.telephone?.trim() || null,
      recipientType: 'PARENT',
      sourceType: form.origine === 'CONCOURS' ? 'CONCOURS' : 'AUTOSERVICE',
      examCandidateId: form.candidatConcoursId || null,
      eleveADispositif: form.dispositifEleve !== 'AUCUN',
      eleveDispositifOS: form.dispositifEleve === 'IPHONE' ? 'IOS' : 'ANDROID',
      parentADispositif: form.dispositifParent !== 'AUCUN',
      parentDispositifOS: form.dispositifParent === 'IPHONE' ? 'IOS' : 'ANDROID',
      aucunContactDisponible: form.aucunTelephoneDisponible,
      submittedData: {
        nom: form.nom,
        prenom: form.prenom,
        sexe: form.sexe,
        dateNaissance: form.dateNaissance,
        lieuNaissance: form.lieuNaissance,
        nationalite: form.nationalite,
        matriculeNational: form.matriculeNational,
        level: form.level,
        serie: form.serie,
        etablissementOrigine: form.etablissementOrigine,
        derniereClasseSuivie: form.derniereClasseSuivie,
        redoublant: form.redoublant,
        motifHorsConcours: form.motifHorsConcours,
        derogationCapacite: form.derogationCapacite,
        motifDerogation: form.motifDerogation,
        responsables: form.responsables,
        validableSousReserve: form.validableSousReserve,
      },
    }
  }

  const handleSave = async (soumettreDirectement: boolean) => {
    setLoading(true)
    setError(null)
    const payload = construirePayload()

    try {
      // 1. Créer le dossier
      const res = await fetchApi('/api/v2/eleve-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message || 'Erreur lors de la création du dossier')
      }
      const onboardingId = data.data.onboardingId

      // 2. Initialiser les pièces
      await fetchApi(`/api/v2/eleve-onboarding/${onboardingId}/pieces/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: payload.sourceType }),
      })

      // 3. Si demandé, soumettre à la direction
      if (soumettreDirectement) {
        await fetchApi(`/api/v2/eleve-onboarding/${onboardingId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId: form.classId,
            nomProvisoire: payload.nomProvisoire,
            submittedData: payload.submittedData,
          }),
        })
      }

      setSuccessDossierId(onboardingId)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement')
    } finally {
      setLoading(false)
    }
  }

  // Écran de succès post-soumission
  if (successDossierId) {
    return (
      <div
        style={{
          maxWidth: 640,
          margin: '40px auto',
          background: 'var(--surface, #fff)',
          borderRadius: 14,
          padding: 32,
          border: '1px solid var(--border, #e5e7eb)',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}
      >
        <CheckCircle2 size={56} style={{ color: 'var(--green, #16a34a)', margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text, #111827)', margin: 0 }}>
          Dossier enregistré avec succès !
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text2, #4b5563)', margin: '10px 0 24px', lineHeight: 1.5 }}>
          Le dossier de <strong>{form.nom} {form.prenom}</strong> a été {form.origine === 'CONCOURS' ? 'finalisé' : 'soumis à la direction pour validation'}.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setSuccessDossierId(null)
              setEtapeActive(1)
              setEtapesValidees([])
              setForm((prev) => ({ ...prev, nom: '', prenom: '', dateNaissance: '', classId: '' }))
            }}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <PlusCircle size={15} /> Nouveau dossier
          </button>
          <button
            type="button"
            onClick={() => onSuccess(successDossierId)}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--green, #16a34a)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retour aux dossiers
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Colonne principale (formulaire max 760px) */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Barre d'étapes cliquables pour celles déjà validées */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface, #fff)',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid var(--border, #e5e7eb)',
            overflowX: 'auto',
            gap: 8,
          }}
        >
          {ETAPES.map((step) => {
            const isActif = etapeActive === step.id
            const isValide = etapesValidees.includes(step.id)
            const StepIcon = step.icon
            return (
              <button
                key={step.id}
                type="button"
                disabled={!isValide && !isActif}
                onClick={() => isValide && setEtapeActive(step.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: isActif ? 'rgba(37,99,235,0.08)' : 'transparent',
                  color: isActif ? 'var(--blue, #2563eb)' : isValide ? 'var(--green, #16a34a)' : 'var(--text3, #9ca3af)',
                  fontWeight: isActif ? 800 : 600,
                  fontSize: 12,
                  cursor: isValide ? 'pointer' : 'default',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isActif ? 'var(--blue, #2563eb)' : isValide ? 'var(--green, #16a34a)' : 'var(--border)',
                    color: isActif || isValide ? '#fff' : 'var(--text3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {isValide ? '✓' : step.id}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            )
          })}
        </div>

        {/* Message d'erreur global */}
        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--red, #ef4444)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Formulaire de l'étape active */}
        <div
          style={{
            background: 'var(--surface, #fff)',
            borderRadius: 14,
            padding: 24,
            border: '1px solid var(--border, #e5e7eb)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          {etapeActive === 1 && (
            <Step1Eleve
              form={form}
              onChange={updateForm}
              errors={errors}
              onDoublonDetecte={setDoublonsDetectes}
            />
          )}

          {etapeActive === 2 && (
            <Step2Scolarite
              form={form}
              onChange={updateForm}
              errors={errors}
              suggestions={suggestions}
              loadingSuggestions={loadingSuggestions}
            />
          )}

          {etapeActive === 3 && (
            <Step3Famille
              form={form}
              onChange={updateForm}
              errors={errors}
            />
          )}

          {etapeActive === 4 && (
            <Step4AccesNumerique
              form={form}
              onChange={updateForm}
            />
          )}

          {etapeActive === 5 && (
            <Step5Pieces
              form={form}
              onChange={updateForm}
              scoreCompletude={scoreCompletude}
              piecesState={piecesState}
              onTogglePiece={togglePiece}
            />
          )}

          {etapeActive === 6 && (
            <Step6Recapitulatif
              form={form}
              suggestions={suggestions}
              doublonsDetectes={doublonsDetectes}
              scoreCompletude={scoreCompletude}
              piecesManquantesCount={piecesManquantesCount}
              onGoToStep={setEtapeActive}
              onSaveDraft={() => handleSave(false)}
              onSubmitToDirection={() => handleSave(true)}
              onFinalizeDirect={() => handleSave(false)}
              loading={loading}
            />
          )}

          {/* Boutons de navigation bas de formulaire */}
          {etapeActive < 6 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--border, #e5e7eb)',
              }}
            >
              {etapeActive > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #e5e7eb)',
                    background: 'var(--surface, #fff)',
                    color: 'var(--text, #111827)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ChevronLeft size={16} /> Précédent
                </button>
              ) : (
                onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text3)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Annuler
                  </button>
                )
              )}

              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--blue, #2563eb)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginLeft: 'auto',
                }}
              >
                Continuer <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Panneau latéral fixe 320px sur desktop */}
      <EnrollmentSidebarSummary
        form={form}
        suggestions={suggestions}
        doublonsDetectes={doublonsDetectes}
        scoreCompletude={scoreCompletude}
        piecesManquantesCount={piecesManquantesCount}
      />
    </div>
  )
}
