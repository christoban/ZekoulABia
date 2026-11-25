/**
 * APPLICATION LAYER — Use Case : Synchroniser les matières d'une école ACTIVE
 * Rattrapage : crée les matières + SubjectCoefficients pour une école ACTIVE
 * dont l'activation s'est faite avant que ces étapes soient en place.
 * Reprend EXACTEMENT la logique transactionnelle de l'ancien controller
 * (constantes CYCLE2_LEVELS / NIVEAU_MAP / TEMPLATES_WITH_REFERENCE_DATA incluses).
 */
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import { MasterAdminNotFoundError, MasterAdminValidationError } from './errors';

export interface SynchroniserMatieresResultat {
  schoolName: string;
  subjectsCreated: number;
  subjectCoefficientsUpserted: number;
}

export class SynchroniserMatieresEcoleUseCase {
  constructor(
    private readonly queryRepo: MasterAdminQueryRepository,
  ) {}

  async execute(id: string): Promise<SynchroniserMatieresResultat> {
    const school = await this.queryRepo.findSchoolBasic(id);
    if (!school) throw new MasterAdminNotFoundError('École introuvable');
    if (school.status !== 'ACTIVE') {
      throw new MasterAdminValidationError('Seules les écoles ACTIVE peuvent être synchronisées');
    }

    const { subjectsCreated, subjectCoefficientsUpserted } = await this.queryRepo.synchroniser(id);

    return {
      schoolName: school.name,
      subjectsCreated,
      subjectCoefficientsUpserted,
    };
  }
}
