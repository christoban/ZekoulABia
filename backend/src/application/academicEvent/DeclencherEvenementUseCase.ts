/**
 * APPLICATION LAYER — Déclenchement manuel d'un événement MANUAL_TRIGGER (Type 2).
 * Jamais automatique par construction : seul un administrateur (humain) déclenche, au moment
 * réel où le fait externe imprévisible se produit (ex. publication des résultats d'un examen).
 * Notifie immédiatement les rôles cibles à l'ouverture.
 */
import type { AcademicEventRepository } from '@domain/ports/repositories/AcademicEventRepository';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import { activerRessourceLieeSiApplicable } from './activerRessourceLiee';

export type NotifierEvenementFn = (schoolId: string, roles: string[], titre: string, corps: string) => Promise<void>;

export interface DeclencherEvenementCommande {
  eventId: string;
  schoolId: string;
  declencheParId: string;
  // Date de clôture au moment du déclenchement — la date d'ouverture d'un MANUAL_TRIGGER n'est
  // jamais connue à l'avance (voir Type 2), donc la clôture ne peut être fixée qu'ici, pas à la
  // création. Requis si le type d'événement ouvre une ressource liée (ex. CHOIX_LV2).
  closeDate?: Date;
}

export class DeclencherEvenementUseCase {
  constructor(
    private readonly academicEventRepository: AcademicEventRepository,
    private readonly lv2ChoiceRepository: Lv2ChoiceRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly notifier: NotifierEvenementFn,
    private readonly smsNotification: SmsNotificationPort,
    private readonly entranceExamRepository?: EntranceExamRepository,
  ) {}

  async execute(cmd: DeclencherEvenementCommande): Promise<{ id: string }> {
    const evenement = await this.academicEventRepository.trouverParId(cmd.eventId, cmd.schoolId);
    if (!evenement) throw new Error('Événement introuvable');
    if (evenement.category !== 'MANUAL_TRIGGER') {
      throw new Error('Seuls les événements à déclenchement manuel peuvent être ouverts de cette façon.');
    }
    if (evenement.status !== 'UPCOMING') {
      throw new Error('Cet événement est déjà ouvert ou clôturé.');
    }

    const maintenant = new Date();
    const closeDate = cmd.closeDate ?? evenement.closeDate ?? null;

    // Ouvre la ressource réelle AVANT de faire passer l'événement à ACTIVE — si ça échoue,
    // l'événement reste UPCOMING plutôt que de mentir sur son propre statut.
    let linkedResourceId = await activerRessourceLieeSiApplicable(this.lv2ChoiceRepository, this.anneeRepository, {
      id: evenement.id, schoolId: cmd.schoolId, type: evenement.type,
      level: evenement.level, openDate: maintenant, closeDate,
    }, this.smsNotification);

    if (evenement.type === 'CONCOURS_ENTREE') {
      const sessionId = evenement.entranceExamSessionId || evenement.linkedResourceId;
      if (sessionId && this.entranceExamRepository) {
        await this.entranceExamRepository.mettreAJourStatutSession(sessionId, 'REGISTRATION_OPEN').catch((err: unknown) => {
          console.error(`[AcademicEvent] Erreur ouverture session concours ${sessionId}:`, err);
        });
        linkedResourceId = sessionId;
      }
    }

    await this.academicEventRepository.mettreAJour(cmd.eventId, {
      status: 'ACTIVE',
      openDate: maintenant,
      closeDate,
      triggeredById: cmd.declencheParId,
      triggeredAt: maintenant,
      linkedResourceId: linkedResourceId ?? evenement.linkedResourceId,
    });

    await this.notifier(
      cmd.schoolId,
      evenement.targetRoles,
      evenement.title,
      evenement.description ?? `« ${evenement.title} » est désormais ouvert.`,
    );

    return { id: cmd.eventId };
  }
}
