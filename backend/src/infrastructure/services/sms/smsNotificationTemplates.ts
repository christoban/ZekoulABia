import type { Language } from '../../../domain/policies/LanguagePolicy.ts'

export type SmsType = 'ABSENCE' | 'PAYMENT' | 'BULLETIN' | 'DISCIPLINE' | 'ADMISSION' | 'PEBS' | 'LV2' | 'ONBOARDING' | 'LIBRARY'

export const DISCIPLINE_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  WARNING_ORAL:        { fr: 'Avertissement oral',                 en: 'Verbal warning' },
  WARNING_WRITTEN:     { fr: 'Avertissement écrit',                en: 'Written warning' },
  TEMP_EXCLUSION:      { fr: 'Exclusion temporaire',               en: 'Temporary exclusion' },
  COUNCIL_DECISION:    { fr: 'Décision du conseil de discipline',  en: 'Disciplinary council decision' },
  PERMANENT_EXCLUSION: { fr: 'Exclusion définitive',               en: 'Permanent exclusion' },
}

export function formatSmsDate(date: Date, lang: Language): string {
  return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatSmsAmount(amount: number, lang: Language): string {
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(amount)
}

// ── Templates SMS bilingues (fr/en) ─────────────────────────────────────────
// La langue est résolue par resolveSmsLanguage() (sous-système + section si bilingue).
export const smsTemplates = {
  absence: {
    fr: (name: string, date: string, subjectPart: string) => `ZekoulABia: ${name} a été marqué(e) absent(e) le ${date}${subjectPart}.`,
    en: (name: string, date: string, subjectPart: string) => `ZekoulABia: ${name} was marked absent on ${date}${subjectPart}.`,
  },
  payment: {
    fr: (name: string, amount: string) => `ZekoulABia: Paiement de ${amount} XAF reçu pour ${name}. Merci !`,
    en: (name: string, amount: string) => `ZekoulABia: Payment of ${amount} XAF received for ${name}. Thank you!`,
  },
  overdue: {
    fr: (name: string, label: string, amount: string, days: number) => `ZekoulABia: RAPPEL — Facture "${label}" de ${amount} XAF pour ${name} est en retard de ${days} jour(s). Veuillez régulariser.`,
    en: (name: string, label: string, amount: string, days: number) => `ZekoulABia: REMINDER — Invoice "${label}" of ${amount} XAF for ${name} is ${days} day(s) overdue. Please settle it.`,
  },
  discipline: {
    fr: (name: string, typeLabel: string, reason: string) => `ZekoulABia: ${name} a fait l'objet d'une sanction (${typeLabel}). Motif : ${reason}. Contactez l'établissement pour plus d'informations.`,
    en: (name: string, typeLabel: string, reason: string) => `ZekoulABia: ${name} received a disciplinary sanction (${typeLabel}). Reason: ${reason}. Please contact the school for more information.`,
  },
  libraryOverdue: {
    fr: (name: string, title: string) => `ZekoulABia: RAPPEL — L'ouvrage "${title}" emprunté par ${name} est en retard. Merci de le retourner à la bibliothèque.`,
    en: (name: string, title: string) => `ZekoulABia: REMINDER — The book "${title}" borrowed by ${name} is overdue. Please return it to the library.`,
  },
  absenceThreshold: {
    fr: (name: string, count: number, threshold: number) => `ZekoulABia: ALERTE — ${name} cumule ${count} absences non justifiées (seuil : ${threshold}). Merci de contacter l'établissement.`,
    en: (name: string, count: number, threshold: number) => `ZekoulABia: ALERT — ${name} has ${count} unexcused absences (threshold: ${threshold}). Please contact the school.`,
  },
  bulletin: {
    fr: (name: string, period: string) => `ZekoulABia: Le bulletin de ${name} (${period}) est disponible. Connectez-vous pour le consulter.`,
    en: (name: string, period: string) => `ZekoulABia: ${name}'s report card (${period}) is available. Log in to view it.`,
  },
  admissionProvisoire: {
    fr: (name: string, schoolName = 'Établissement', level = '6e', examName = 'CEP', nextStep?: string) =>
      `${schoolName}: ${name} est admis(e) provisoirement en ${level} au concours d'entrée, sous réserve de la réussite au ${examName}.${nextStep ? ' ' + nextStep : ' Merci de vous présenter au secrétariat pour la suite des démarches.'}`,
    en: (name: string, schoolName = 'School', level = 'Form 1', examName = 'FSLC', nextStep?: string) =>
      `${schoolName}: ${name} has been provisionally admitted into ${level} on the entrance exam, subject to passing ${examName}.${nextStep ? ' ' + nextStep : ' Please contact the school administration for the next steps.'}`,
  },
  concoursNonAdmis: {
    fr: (name: string, schoolName = 'Établissement', level = '6e') =>
      `${schoolName}: Nous vous informons que ${name} n'a pas été retenu(e) au concours d'entrée en ${level}. Nous vous remercions pour votre confiance et lui souhaitons plein succès.`,
    en: (name: string, schoolName = 'School', level = 'Form 1') =>
      `${schoolName}: We regret to inform you that ${name} was not admitted into ${level} through the entrance exam. We thank you for your application and wish them great success.`,
  },
  concoursListeAttente: {
    fr: (name: string, schoolName = 'Établissement', level = '6e', rank?: number) =>
      `${schoolName}: ${name} est placé(e) sur la liste complémentaire du concours d'entrée en ${level}${rank ? ' (rang ' + rank + ')' : ''}. Vous serez contacté(e) en cas de libération d'une place.`,
    en: (name: string, schoolName = 'School', level = 'Form 1', rank?: number) =>
      `${schoolName}: ${name} is on the waiting list for entrance exam into ${level}${rank ? ' (rank ' + rank + ')' : ''}. You will be contacted should a place become available.`,
  },
  concoursPromotionListeAttente: {
    fr: (name: string, schoolName = 'Établissement', level = '6e', examName = 'CEP') =>
      `${schoolName}: Excellente nouvelle ! Une place s'est libérée et ${name} est désormais admis(e) provisoirement en ${level}, sous réserve de réussite au ${examName}. Merci de vous présenter au secrétariat.`,
    en: (name: string, schoolName = 'School', level = 'Form 1', examName = 'FSLC') =>
      `${schoolName}: Great news! A seat has become available and ${name} is now provisionally admitted into ${level}, subject to passing ${examName}. Please contact the school administration.`,
  },
  cepConfirme: {
    fr: (name: string) => `ZekoulABia: Félicitations ! ${name} a réussi le CEP, son admission en 6e est confirmée.`,
    en: (name: string) => `ZekoulABia: Congratulations! ${name} passed the CEP, admission into Form 1 is confirmed.`,
  },
  cepAnnule: {
    fr: (name: string) => `ZekoulABia: ${name} n'a pas obtenu le CEP. L'admission en 6e ne peut malheureusement pas être maintenue. Contactez l'établissement pour plus d'informations.`,
    en: (name: string) => `ZekoulABia: ${name} did not pass the CEP. Admission into Form 1 unfortunately cannot be maintained. Please contact the school for more information.`,
  },
  pebsSelectionne: {
    fr: (name: string) => `ZekoulABia: ${name} a été sélectionné(e) pour le Programme Spécial Bilingue (PEBS) et a été transféré(e) dans la classe correspondante.`,
    en: (name: string) => `ZekoulABia: ${name} has been selected for the Special Bilingual Programme (PEBS) and has been transferred to the corresponding class.`,
  },
  pebsNonSelectionne: {
    fr: (name: string) => `ZekoulABia: ${name} n'a pas été sélectionné(e) pour le Programme Spécial Bilingue (PEBS) cette année.`,
    en: (name: string) => `ZekoulABia: ${name} was not selected for the Special Bilingual Programme (PEBS) this year.`,
  },
  lv2WindowOpen: {
    fr: (name: string, level: string, closeDate: string) => `ZekoulABia: La période de choix de la LV2 pour ${level} est ouverte jusqu'au ${closeDate}. Merci de faire le choix de ${name} depuis son compte élève.`,
    en: (name: string, level: string, closeDate: string) => `ZekoulABia: The LV2 choice period for ${level} is open until ${closeDate}. Please submit ${name}'s choice from their student account.`,
  },
  minesecOverdue: {
    fr: (name: string, amount: string, types: string) => `ZekoulABia: RAPPEL — Frais MINESEC (${types}) de ${amount} XAF en retard pour ${name}. Ce paiement se fait exclusivement sur cartescolaire.cm.`,
    en: (name: string, amount: string, types: string) => `ZekoulABia: REMINDER — MINESEC fees (${types}) of ${amount} XAF overdue for ${name}. This payment is made exclusively on cartescolaire.cm.`,
  },
  onboardingLink: {
    // Le lien est inclus directement dans le SMS (pas seulement "consultez votre email") : le
    // contact peut n'avoir aucune adresse email du tout (Axe 2, Plan_Diversite_Numerique) — le
    // SMS doit rester exploitable seul, sans dépendre du canal email.
    fr: (nomProvisoire: string, schoolName: string, expiryDays: number, formUrl: string) => `ZekoulABia: ${schoolName} vous invite à compléter le dossier d'inscription de ${nomProvisoire} (valable ${expiryDays} jours) : ${formUrl}`,
    en: (nomProvisoire: string, schoolName: string, expiryDays: number, formUrl: string) => `ZekoulABia: ${schoolName} invites you to complete ${nomProvisoire}'s enrollment file (valid ${expiryDays} days): ${formUrl}`,
  },
  onboardingReminder: {
    fr: (nomProvisoire: string, schoolName: string, formUrl: string) => `ZekoulABia: RAPPEL — Le dossier d'inscription de ${nomProvisoire} pour ${schoolName} n'est pas encore complété : ${formUrl}`,
    en: (nomProvisoire: string, schoolName: string, formUrl: string) => `ZekoulABia: REMINDER — ${nomProvisoire}'s enrollment file for ${schoolName} is not yet completed: ${formUrl}`,
  },
  onboardingActivated: {
    fr: (schoolName: string, setupUrl: string) => `ZekoulABia: Le dossier d'inscription a été validé par ${schoolName}. Configurez votre mot de passe : ${setupUrl}`,
    en: (schoolName: string, setupUrl: string) => `ZekoulABia: The enrollment file has been validated by ${schoolName}. Set up your password: ${setupUrl}`,
  },
  // accessMode=SMS_ONLY : aucun lien d'activation n'est jamais envoyé (le contact n'a aucun
  // dispositif capable de l'ouvrir) — le compte existe, mais sa configuration se fait en
  // présentiel à l'établissement.
  onboardingActivatedSmsOnly: {
    fr: (schoolName: string) => `ZekoulABia: Le dossier d'inscription a été validé par ${schoolName}. Présentez-vous à l'établissement pour finaliser l'accès au compte.`,
    en: (schoolName: string) => `ZekoulABia: The enrollment file has been validated by ${schoolName}. Please visit the school in person to finalize account access.`,
  },
}
