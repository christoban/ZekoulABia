import type { SessionPebsSummary } from './types';
import type { PebsExamRepository } from '@domain/ports/repositories/PebsExamRepository';

export class ResumeSessionPebsUseCase {
  constructor(private readonly pebsRepository: PebsExamRepository) {}

  async execute(schoolId: string, sessionId: string): Promise<SessionPebsSummary> {
    const session = await this.pebsRepository.trouverSession(sessionId);
    if (!session) throw new Error('Session PEBS introuvable');
    if (session.schoolId !== schoolId) throw new Error('Accès refusé');

    // Récupérer les candidats avec infos profil
    const rawCandidates = await this.pebsRepository.listerCandidatsAvecProfil(sessionId);

    const candidates = rawCandidates.map(c => ({
      id: c.id,
      studentProfileId: c.studentProfileId,
      firstName: c.studentProfile?.user?.firstName ?? '?',
      lastName: c.studentProfile?.user?.lastName ?? '?',
      currentClassName: c.studentProfile?.enrollmentsYearScoped?.[0]?.class?.name ?? '?',
      examScore: c.examScore,
      selectionResult: c.selectionResult,
    }));

    const pending = candidates.filter(c => c.selectionResult === 'PENDING').length;
    const selectionnes = candidates.filter(c => c.selectionResult === 'SELECTIONNE').length;
    const nonSelectionnes = candidates.filter(c => c.selectionResult === 'NON_SELECTIONNE').length;

    return {
      session: {
        id: session.id,
        name: session.name,
        level: session.level,
        status: session.status,
        examDate: session.examDate,
        targetClassId: session.targetClassId,
        selectionThreshold: session.selectionThreshold,
        availableSeats: session.availableSeats,
      },
      total: candidates.length,
      pending,
      selectionnes,
      nonSelectionnes,
      candidates,
    };
  }
}
