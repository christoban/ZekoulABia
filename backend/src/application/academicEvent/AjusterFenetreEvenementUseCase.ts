/**
 * APPLICATION LAYER — Ajuste la date de clôture d'un événement SLIDING_WINDOW (Type 3).
 * Seul ce type de catégorie a une clôture ajustable par l'admin — un FIXED_DATE respecte le
 * calendrier programmé, un MANUAL_TRIGGER se clôture par le même mécanisme que son ouverture.
 */
import type { AcademicEventRepository } from '@domain/ports/repositories/AcademicEventRepository';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';
import { synchroniserClotureRessourceLiee } from './activerRessourceLiee';

export interface AjusterFenetreCommande {
  eventId: string;
  schoolId: string;
  nouvelleCloture: Date;
}

export class AjusterFenetreEvenementUseCase {
  constructor(
    private readonly academicEventRepository: AcademicEventRepository,
    private readonly lv2ChoiceRepository: Lv2ChoiceRepository,
  ) {}

  async execute(cmd: AjusterFenetreCommande): Promise<{ id: string }> {
    const evenement = await this.academicEventRepository.trouverParId(cmd.eventId, cmd.schoolId);
    if (!evenement) throw new Error('Événement introuvable');
    if (evenement.category !== 'SLIDING_WINDOW') {
      throw new Error('Seuls les événements à fenêtre glissante ont une date de clôture ajustable.');
    }
    if (evenement.status === 'CLOSED') {
      throw new Error('Cet événement est déjà clôturé.');
    }
    if (evenement.openDate && cmd.nouvelleCloture <= evenement.openDate) {
      throw new Error('La date de clôture doit être postérieure à la date d\'ouverture.');
    }

    await this.academicEventRepository.mettreAJour(cmd.eventId, {
      closeDate: cmd.nouvelleCloture,
      reminderSentAt: null,
    });
    await synchroniserClotureRessourceLiee(this.lv2ChoiceRepository, evenement.type, evenement.linkedResourceId, cmd.nouvelleCloture);
    return { id: cmd.eventId };
  }
}
