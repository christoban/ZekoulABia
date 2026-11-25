/**
 * Un AcademicEvent de type CHOIX_LV2 ne se contente pas de notifier/tracer : son activation
 * ouvre RÉELLEMENT la fenêtre de choix LV2 (Lv2ChoiceWindow, mécanisme métier préexistant à ce
 * chantier). Un seul geste admin, un seul système — jamais un événement académique "actif" sans
 * que la fonctionnalité réelle qu'il représente ne le soit aussi.
 *
 * Si l'activation de la ressource liée échoue (ex. une fenêtre LV2 est déjà ouverte pour ce
 * niveau), l'appelant ne doit PAS faire passer l'AcademicEvent à ACTIVE — un événement "actif"
 * sans ressource réelle derrière serait un mensonge d'interface (c'est exactement le défaut
 * signalé en revue : le menu ne doit jamais s'afficher pour une fonctionnalité qui n'est pas
 * réellement ouverte).
 */
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import { OuvrirFenetreChoixLV2UseCase } from '../lv2Choice/OuvrirFenetreChoixLV2UseCase';

export interface EvenementPourActivation {
  id: string;
  schoolId: string;
  type: string;
  level: string | null;
  openDate: Date | null;
  closeDate: Date | null;
}

/**
 * Ouvre la ressource métier liée au type d'événement, si applicable, et retourne son id à
 * persister dans AcademicEvent.linkedResourceId. Retourne `null` si ce type d'événement n'a pas
 * de ressource liée (RENTREE_6E_5E, MIGRATION_BILINGUE, CLOTURE_ANNEE, AUTRE — simples
 * rappels/notifications, rien à ouvrir automatiquement pour eux aujourd'hui).
 */
export async function activerRessourceLieeSiApplicable(
  lv2ChoiceRepository: Lv2ChoiceRepository,
  anneeRepository: AnneeAcademiqueRepository,
  event: EvenementPourActivation,
  smsNotification: SmsNotificationPort,
): Promise<string | null> {
  if (event.type !== 'CHOIX_LV2') return null;

  if (!event.level) {
    throw new Error('Un événement CHOIX_LV2 requiert un niveau (level) pour ouvrir la fenêtre de choix LV2 réelle.');
  }
  if (!event.openDate || !event.closeDate) {
    throw new Error('Un événement CHOIX_LV2 requiert une date d\'ouverture et de clôture pour ouvrir la fenêtre réelle.');
  }

  const anneeCourante = await anneeRepository.findCourante(event.schoolId);
  if (!anneeCourante) {
    throw new Error('Aucune année scolaire courante configurée — impossible d\'ouvrir la fenêtre de choix LV2.');
  }

  const resultat = await new OuvrirFenetreChoixLV2UseCase(lv2ChoiceRepository).execute({
    schoolId: event.schoolId,
    level: event.level,
    academicYearId: anneeCourante.id,
    openDate: event.openDate,
    closeDate: event.closeDate,
  });

  // Ce chemin passe par le use case directement (pas par Lv2ChoiceController.creerFenetre),
  // donc le SMS aux parents que le contrôleur envoyait normalement à l'ouverture doit être
  // rappelé ici explicitement — sinon un parent sans push activé ne serait jamais informé
  // qu'une fenêtre de choix LV2 vient de s'ouvrir pour son enfant.
  for (const eleve of resultat.eleves) {
    void smsNotification.notifyLv2WindowOpenSms({
      schoolId: event.schoolId,
      studentUserId: eleve.studentUserId,
      studentName: eleve.studentName,
      level: resultat.level,
      closeDate: resultat.closeDate,
    }).catch((err) => console.error('[AcademicEvent] SMS ouverture LV2:', err?.message));
  }

  return resultat.windowId;
}

/**
 * Répercute un changement de closeDate sur la ressource liée (ajustement manuel d'une fenêtre
 * glissante, ou prolongation automatique par le job quotidien) — sans ça, l'AcademicEvent et la
 * vraie fenêtre LV2 divergeraient silencieusement l'un de l'autre.
 */
export async function synchroniserClotureRessourceLiee(
  lv2ChoiceRepository: Lv2ChoiceRepository,
  type: string,
  linkedResourceId: string | null,
  nouvelleCloture: Date,
): Promise<void> {
  if (type !== 'CHOIX_LV2' || !linkedResourceId) return;
  await lv2ChoiceRepository.mettreAJourCloture(linkedResourceId, nouvelleCloture)
    .catch((err: unknown) => console.error('[AcademicEvent] sync clôture Lv2ChoiceWindow:', err instanceof Error ? err.message : String(err)));
}

/** Clôture la ressource liée quand l'AcademicEvent lui-même passe CLOSED. */
export async function cloturerRessourceLiee(
  lv2ChoiceRepository: Lv2ChoiceRepository,
  type: string,
  linkedResourceId: string | null,
): Promise<void> {
  if (type !== 'CHOIX_LV2' || !linkedResourceId) return;
  await lv2ChoiceRepository.cloreFenetre(linkedResourceId)
    .catch((err: unknown) => console.error('[AcademicEvent] clôture Lv2ChoiceWindow:', err instanceof Error ? err.message : String(err)));
}
