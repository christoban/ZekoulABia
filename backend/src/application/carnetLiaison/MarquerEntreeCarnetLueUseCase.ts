/**
 * APPLICATION LAYER — MarquerEntreeCarnetLueUseCase
 * Pose un accusé de lecture horodaté (idempotent) pour un parent ou membre de l'école.
 */
import type { CarnetLiaisonRepository } from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';

export class MarquerEntreeCarnetLueUseCase {
  constructor(
    private readonly carnetRepo: CarnetLiaisonRepository,
    private readonly parentRepo: ParentRepository,
  ) {}

  async execute(params: {
    entryId: string;
    schoolId: string;
    userId: string;
    role: string;
  }): Promise<void> {
    const entry = await this.carnetRepo.trouverParId(params.entryId, params.schoolId);
    if (!entry) {
      throw new Error('NOT_FOUND_CARNET_ENTRY');
    }

    if (params.role.toUpperCase() === 'PARENT') {
      const ok = await this.parentRepo.aAccesEleve(params.userId, entry.studentId);
      if (!ok) {
        throw new Error('FORBIDDEN_PARENT_STUDENT');
      }
    }

    await this.carnetRepo.marquerLue(entry.id, params.userId, params.schoolId);
  }
}

