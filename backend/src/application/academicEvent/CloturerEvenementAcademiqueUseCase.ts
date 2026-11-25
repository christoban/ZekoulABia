/**
 * APPLICATION LAYER — Clôturer un événement académique.
 * Accessible par l'administrateur.
 * Clôture l'événement et sa ressource liée (session de concours, fenêtre LV2...).
 */
import type { AcademicEventRepository } from '@domain/ports/repositories/AcademicEventRepository';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';
import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import { cloturerRessourceLiee } from './activerRessourceLiee';

export interface CloturerEvenementCommande {
  eventId: string;
  schoolId: string;
  clotureParId: string;
}

export class CloturerEvenementAcademiqueUseCase {
  constructor(
    private readonly academicEventRepository: AcademicEventRepository,
    private readonly lv2ChoiceRepository: Lv2ChoiceRepository,
    private readonly entranceExamRepository?: EntranceExamRepository,
  ) {}

  async execute(cmd: CloturerEvenementCommande): Promise<{ id: string }> {
    const evenement = await this.academicEventRepository.trouverParId(cmd.eventId, cmd.schoolId);
    if (!evenement) {
      throw new Error('Événement académique introuvable.');
    }

    if (evenement.status === 'CLOSED') {
      return { id: evenement.id };
    }

    const maintenant = new Date();

    // Clôture de la ressource liée
    if (evenement.type === 'CONCOURS_ENTREE' && (evenement.entranceExamSessionId || evenement.linkedResourceId)) {
      const sessionId = evenement.entranceExamSessionId || evenement.linkedResourceId!;
      if (this.entranceExamRepository) {
        await this.entranceExamRepository.mettreAJourStatutSession(sessionId, 'CLOSED').catch((err: unknown) => {
          console.error(`[AcademicEvent] Erreur clôture session concours ${sessionId}:`, err);
        });
      }
    } else if (evenement.type === 'CHOIX_LV2' && evenement.linkedResourceId) {
      await cloturerRessourceLiee(this.lv2ChoiceRepository, evenement.type, evenement.linkedResourceId);
    }

    // Mettre à jour l'événement
    await this.academicEventRepository.mettreAJour(evenement.id, {
      status: 'CLOSED',
      closeDate: maintenant,
    });

    return { id: evenement.id };
  }
}
