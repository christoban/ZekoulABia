import type { CreerSessionPebsCommande } from './types';
import type { PebsExamRepository } from '@domain/ports/repositories/PebsExamRepository';

export interface NotifierEvenementAcademique {
  (schoolId: string, targetRoles: string[], titre: string, corps: string): Promise<void>;
}

export class CreerSessionPebsUseCase {
  constructor(
    private readonly pebsRepository: PebsExamRepository,
    private readonly notifier: NotifierEvenementAcademique,
  ) {}

  async execute(cmd: CreerSessionPebsCommande): Promise<{ sessionId: string }> {
    // Vérifier que la classe cible existe et appartient à l'école
    const targetClass = await this.pebsRepository.trouverClasseCible(cmd.targetClassId);
    if (!targetClass || targetClass.schoolId !== cmd.schoolId) throw new Error('Classe cible introuvable');

    const session = await this.pebsRepository.creerSession({
      schoolId: cmd.schoolId,
      name: cmd.name,
      examDate: cmd.examDate,
      level: cmd.level,
      academicYearId: cmd.academicYearId,
      selectionThreshold: cmd.selectionThreshold ?? null,
      availableSeats: cmd.availableSeats ?? null,
      targetClassId: cmd.targetClassId,
    });

    void this.notifier(
      cmd.schoolId, ['ADMIN', 'STAFF'],
      'Sélection PEBS ouverte',
      `La session « ${cmd.name} » (niveau ${cmd.level}) est créée — le menu Sélection PEBS est maintenant accessible.`,
    ).catch((err) => console.error('[PebsExam] notification ouverture:', err?.message));

    return { sessionId: session.id };
  }
}
