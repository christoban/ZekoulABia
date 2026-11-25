import type { AjouterCandidatsPebsCommande } from './types';
import type { PebsExamRepository } from '@domain/ports/repositories/PebsExamRepository';

export class AjouterCandidatsPebsUseCase {
  constructor(private readonly pebsRepository: PebsExamRepository) {}

  async execute(cmd: AjouterCandidatsPebsCommande): Promise<{ added: number }> {
    const session = await this.pebsRepository.trouverSession(cmd.sessionId);
    if (!session) throw new Error('Session PEBS introuvable');
    if (session.schoolId !== cmd.schoolId) throw new Error('Accès refusé');
    if (session.status === 'APPLIED') throw new Error('La session a déjà été appliquée');

    let added = 0;
    for (const profileId of cmd.studentProfileIds) {
      try {
        // Vérifier que le profil appartient à l'école
        const profile = await this.pebsRepository.trouverProfilAvecClasse(profileId, cmd.schoolId);
        if (!profile) continue;

        // Vérifier doublon
        const existing = await this.pebsRepository.trouverCandidatParProfil(cmd.sessionId, profileId);
        if (existing) continue;

        await this.pebsRepository.creerCandidat({
          sessionId: cmd.sessionId,
          studentProfileId: profileId,
          currentClassId: profile.classId,
        });
        added++;
      } catch {
        // Erreur sur un candidat — continuer
      }
    }

    if (session.status === 'DRAFT' && added > 0) {
      await this.pebsRepository.mettreAJourStatutSession(cmd.sessionId, 'RESULTS_PENDING');
    }

    return { added };
  }
}
