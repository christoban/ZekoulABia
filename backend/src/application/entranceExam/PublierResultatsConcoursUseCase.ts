import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';

export interface PublierResultatsCommande {
  schoolId: string;
  sessionId: string;
}

export class PublierResultatsConcoursUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(cmd: PublierResultatsCommande): Promise<{ publishedAt: Date }> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    if (session.status !== 'DELIBERATION') {
      throw new Error('La session doit être délibérée avant d être publiée');
    }

    const now = new Date();
    await this.entranceRepository.mettreAJourStatutSession(cmd.sessionId, 'PUBLISHED', {
      publishedAt: now,
    });

    return { publishedAt: now };
  }
}
