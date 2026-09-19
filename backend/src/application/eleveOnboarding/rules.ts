/**
 * APPLICATION — Règles métier pures du module Onboarding Auto-Service Élèves.
 *
 * Extraites des use cases pour être testables sans dépendance Prisma (voir __tests__/rules.test.ts).
 * Aucune de ces fonctions ne fait d'I/O — c'est précisément ce qui les rend unitairement
 * testables à faible coût, contrairement aux use cases qui parlent directement à Prisma
 * (pattern déjà en place dans ce projet pour matricule/paiementMinesec/entranceExam).
 */
import type { OnboardingRecipient, OnboardingSource, OnboardingStatus } from './types';
import type { SectionCycle } from '../../domain/subsystems/SubsystemDefaults';

/**
 * Détermine le destinataire du lien d'onboarding.
 *
 * Règle métier n°3 de la spec : un candidat CONCOURS est quasi systématiquement mineur
 * (admission en 6e) — recipientType=PARENT est donc forcé STRUCTURELLEMENT, indépendamment
 * de tout réglage (ageThresholdForParent, defaultRecipient, ou même une valeur explicite
 * passée par l'appelant). Même chose pour une classe de maternelle/primaire (Axe 3, Plan
 * Diversité Numérique) : l'élève n'a jamais de compte propre, seul le parent en a un — ce
 * sont les DEUX SEULS cas où l'appelant ne peut PAS override.
 *
 * La capacité numérique déclarée (eleveADispositif/parentADispositif) et ageThresholdForParent
 * ne sont que des signaux de repli, appliqués seulement si aucun recipientType explicite n'a
 * été fourni — jamais forcés, car contrairement à CONCOURS/maternelle-primaire ils ne sont pas
 * des faits structurels mais des informations pouvant être erronées ou changer.
 */
export function determinerRecipientType(params: {
  sourceType: OnboardingSource;
  recipientTypeExplicite?: OnboardingRecipient;
  defaultRecipient?: OnboardingRecipient;
  sectionCycle?: SectionCycle | null;
  eleveADispositif?: boolean | null;
  parentADispositif?: boolean | null;
  studentAge?: number | null;
  ageThresholdForParent?: number;
}): OnboardingRecipient {
  if (params.sourceType === 'CONCOURS') return 'PARENT';
  if (params.sectionCycle === 'maternelle' || params.sectionCycle === 'primaire') return 'PARENT';
  if (params.recipientTypeExplicite) return params.recipientTypeExplicite;
  // Élève sans dispositif mais parent équipé → seul le parent peut recevoir/compléter le lien.
  if (params.eleveADispositif === false && params.parentADispositif === true) return 'PARENT';
  if (
    params.studentAge != null &&
    params.ageThresholdForParent != null &&
    params.studentAge < params.ageThresholdForParent
  ) {
    return 'PARENT';
  }
  return params.defaultRecipient ?? 'ELEVE';
}

/**
 * Règle d'éligibilité à l'inscription ou au rejet : un dossier peut être finalisé
 * directement (sans étape intermédiaire de validation) depuis le statut SUBMITTED,
 * ou par secours admin/secrétaire depuis DRAFT / LINK_SENT.
 */
export function peutEtreInscritOuRejete(status: OnboardingStatus): boolean {
  return (['SUBMITTED', 'DRAFT', 'LINK_SENT'] as OnboardingStatus[]).includes(status);
}

/** Alias de compatibilité ascendante */
export function peutTransitionnerDepuisPendingValidation(status: OnboardingStatus): boolean {
  return peutEtreInscritOuRejete(status);
}

/** Un formulaire ne peut être soumis que sur un dossier dont le lien a été envoyé et pas encore utilisé. */
export function peutSoumettreFormulaire(status: OnboardingStatus): boolean {
  return status === 'LINK_SENT';
}
