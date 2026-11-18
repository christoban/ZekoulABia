import { fetchApi } from '@/lib/fetchApi'
import type { StepperFormState, ClasseSuggestion } from './stepper/types'

export interface StepperPieceItem {
  code: string
  libelle: string
  obligatoire: boolean
  received: boolean
}

export const INITIAL_STEPPER_PIECES: StepperPieceItem[] = [
  { code: 'ACTE_NAISSANCE', libelle: 'Copie certifiée de l’acte de naissance', obligatoire: true, received: true },
  { code: 'BULLETINS_PRECEDENTS', libelle: 'Bulletins de l’année précédente', obligatoire: true, received: false },
  { code: 'CERTIFICAT_MEDICAL', libelle: 'Certificat médical récent', obligatoire: true, received: false },
  { code: 'PHOTOS_IDENTITE', libelle: '4 photos d’identité 4x4', obligatoire: false, received: false },
  { code: 'CERTIFICAT_TRANSFERT', libelle: 'Certificat de transfert / radiation', obligatoire: false, received: false },
]

export function createInitialStepperForm(initialData?: Partial<StepperFormState>): StepperFormState {
  return {
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
  }
}

export function validerEtapeStepper(
  step: number,
  form: StepperFormState,
  suggestions: ClasseSuggestion[],
): Record<string, string> {
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

  return errs
}

export function construireOnboardingPayload(form: StepperFormState) {
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

export async function enregistrerDossierOnboarding(
  form: StepperFormState,
  soumettreDirectement: boolean,
): Promise<string> {
  const payload = construireOnboardingPayload(form)

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
  const onboardingId: string = data.data.onboardingId

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

  return onboardingId
}
