/**
 * APPLICATION LAYER — Use Case : Réactiver une école
 * SUSPENDED → ACTIVE
 * REJECTED → PENDING (second chance)
 */
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';

export class ReactiverEcoleUseCase {
  constructor(private readonly schoolRepository: SchoolRepository) {}

  async execute(schoolId: string): Promise<void> {
    const school = await this.schoolRepository.findById(schoolId);
    if (!school) throw new Error(`École introuvable : ${schoolId}`);

    if (school.status === 'SUSPENDED') {
      school.reactiver();
    } else if (school.status === 'REJECTED') {
      // Second chance : repasse en PENDING pour réexamen
      school.redonnerUneChanceApresRejet();
    } else {
      throw new Error(
        `Impossible de réactiver une école avec le statut "${school.status}"`
      );
    }

    await this.schoolRepository.update(school);
  }
}
