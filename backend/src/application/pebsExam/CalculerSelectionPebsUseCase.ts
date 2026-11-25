import type { CalculerSelectionPebsCommande } from './types';
import type { PebsExamRepository } from '@domain/ports/repositories/PebsExamRepository';

export class CalculerSelectionPebsUseCase {
  constructor(private readonly pebsRepository: PebsExamRepository) {}

  async execute(cmd: CalculerSelectionPebsCommande): Promise<{ selectionnes: number; nonSelectionnes: number }> {
    const session = await this.pebsRepository.trouverSession(cmd.sessionId);
    if (!session) throw new Error('Session PEBS introuvable');
    if (session.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    const threshold = session.selectionThreshold;
    const seats = session.availableSeats;

    const candidates = await this.pebsRepository.listerCandidatsAvecNote(cmd.sessionId);

    if (candidates.length === 0) {
      throw new Error('Aucun candidat avec une note à traiter');
    }

    let selectionnes = 0;
    let nonSelectionnes = 0;
    let seatsUsed = 0;

    for (const c of candidates) {
      let qualifies = false;

      if (threshold !== null && threshold !== undefined) {
        qualifies = (c.examScore ?? 0) >= threshold;
      } else {
        qualifies = true;
      }

      if (qualifies && seats !== null && seats !== undefined) {
        qualifies = seatsUsed < seats;
      }

      const newResult = qualifies ? 'SELECTIONNE' : 'NON_SELECTIONNE';

      await this.pebsRepository.mettreAJourResultatCandidat(c.id, newResult);

      if (qualifies) {
        seatsUsed++;
        selectionnes++;
      } else {
        nonSelectionnes++;
      }
    }

    return { selectionnes, nonSelectionnes };
  }
}
