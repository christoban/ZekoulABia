import type { AjouterCandidatsCommande } from './types';
import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';

export class AjouterCandidatsConcoursUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(cmd: AjouterCandidatsCommande): Promise<{ added: number }> {
    // Vérifier que la session existe et appartient à l'école
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session) throw new Error('Session de concours introuvable');
    if (session.schoolId !== cmd.schoolId) throw new Error('Accès refusé');
    if (session.status === 'CLOSED') throw new Error('La session est clôturée');

    let added = 0;
    for (const c of cmd.candidats) {
      try {
        await this.entranceRepository.creerCandidat({
          sessionId: cmd.sessionId,
          firstName: c.firstName,
          lastName: c.lastName,
          dateOfBirth: c.dateOfBirth ?? null,
          originSchool: c.originSchool ?? null,
          examScore: c.examScore ?? null,
          parentPhone: c.parentPhone ?? null,
        });
        added++;
      } catch {
        // Doublon ou erreur sur une ligne — continuer
      }
    }

    // Mettre à jour le statut de la session
    if (session.status === 'DRAFT' && added > 0) {
      await this.entranceRepository.mettreAJourStatutSession(cmd.sessionId, 'RESULTS_PENDING');
    }

    return { added };
  }
}
