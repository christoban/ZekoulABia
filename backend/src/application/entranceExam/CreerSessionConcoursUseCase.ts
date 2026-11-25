import type { CreerSessionConcoursCommande } from './types';
import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';

export interface NotifierEvenementAcademique {
  (schoolId: string, targetRoles: string[], titre: string, corps: string): Promise<void>;
}

export class CreerSessionConcoursUseCase {
  constructor(
    private readonly entranceRepository: EntranceExamRepository,
    private readonly notifier: NotifierEvenementAcademique,
  ) {}

  async execute(cmd: CreerSessionConcoursCommande): Promise<{ sessionId: string }> {
    const session = await this.entranceRepository.creerSession({
      schoolId: cmd.schoolId,
      name: cmd.name,
      examDate: cmd.examDate,
      academicYearId: cmd.academicYearId,
      admissionThreshold: cmd.admissionThreshold ?? null,
      availableSeats: cmd.availableSeats ?? null,
    });

    // Le statut réel de la session (pas un AcademicEvent séparé) pilote la visibilité du menu
    // « Concours d'entrée » — voir gating côté frontend. La notification accompagne ce
    // changement de visibilité, elle ne le remplace pas.
    void this.notifier(
      cmd.schoolId, ['ADMIN', 'STAFF'],
      'Concours d\'entrée en 6e ouvert',
      `La session « ${cmd.name} » est créée — le menu Concours d'entrée est maintenant accessible.`,
    ).catch((err) => console.error('[EntranceExam] notification ouverture:', err?.message));

    return { sessionId: session.id };
  }
}
