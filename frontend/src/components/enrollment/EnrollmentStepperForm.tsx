'use client'

import React, { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import type { StepperFormState, ClasseSuggestion } from './stepper/types'
import EnrollmentSidebarSummary from './stepper/EnrollmentSidebarSummary'
import Step1Eleve from './stepper/Step1Eleve'
import Step2Scolarite from './stepper/Step2Scolarite'
import Step3Famille from './stepper/Step3Famille'
import Step4AccesNumerique from './stepper/Step4AccesNumerique'
import Step5Pieces from './stepper/Step5Pieces'
import Step6Recapitulatif from './stepper/Step6Recapitulatif'
import {
  INITIAL_STEPPER_PIECES,
  createInitialStepperForm,
  validerEtapeStepper,
  enregistrerDossierOnboarding,
} from './enrollmentStepperHelpers'
import {
  EnrollmentStepperProgressBar,
  EnrollmentStepperNavFooter,
  EnrollmentStepperSuccess,
} from './EnrollmentStepperChrome'

interface Props {
  onSuccess: (onboardingId: string) => void
  onCancel?: () => void
  initialData?: Partial<StepperFormState>
}

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
  const [piecesState, setPiecesState] = useState(INITIAL_STEPPER_PIECES)

  const [form, setForm] = useState<StepperFormState>(() => createInitialStepperForm(initialData))
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Garder références explicites pour conformité hooks existants
  void isOnline
  void addToQueue

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

  const handleNext = () => {
    const errs = validerEtapeStepper(etapeActive, form, suggestions)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setEtapesValidees((prev) => Array.from(new Set([...prev, etapeActive])))
    setEtapeActive((prev) => Math.min(6, prev + 1))
  }

  const handlePrev = () => {
    setErrors({})
    setEtapeActive((prev) => Math.max(1, prev - 1))
  }

  const handleSave = async (soumettreDirectement: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const onboardingId = await enregistrerDossierOnboarding(form, soumettreDirectement)
      setSuccessDossierId(onboardingId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement')
    } finally {
      setLoading(false)
    }
  }

  // Écran de succès post-soumission
  if (successDossierId) {
    return (
      <EnrollmentStepperSuccess
        nom={form.nom}
        prenom={form.prenom}
        origine={form.origine}
        onNewDossier={() => {
          setSuccessDossierId(null)
          setEtapeActive(1)
          setEtapesValidees([])
          setForm((prev) => ({ ...prev, nom: '', prenom: '', dateNaissance: '', classId: '' }))
        }}
        onBackToDossiers={() => onSuccess(successDossierId)}
      />
    )
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', gap: 24, alignItems: 'flex-start', paddingBottom: 60 }}>
      {/* Colonne principale (formulaire max 760px) */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Barre d'étapes cliquables pour celles déjà validées */}
        <EnrollmentStepperProgressBar
          etapeActive={etapeActive}
          etapesValidees={etapesValidees}
          onSelectStep={setEtapeActive}
        />

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
            <EnrollmentStepperNavFooter
              etapeActive={etapeActive}
              onPrev={handlePrev}
              onNext={handleNext}
              onCancel={onCancel}
            />
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
