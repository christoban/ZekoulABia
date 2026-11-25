/**
 * APPLICATION LAYER — Use Case : Supprimer définitivement une école
 * Transaction atomique : TeacherSubject → User → School (DELETE en cascade).
 * L'audit (journal master) reste dans le controller qui connaît `req`.
 */
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import { MasterAdminNotFoundError } from './errors';

export class SupprimerEcoleUseCase {
  constructor(
    private readonly queryRepo: MasterAdminQueryRepository,
  ) {}

  async execute(id: string): Promise<{ schoolName: string }> {
    const school = await this.queryRepo.findSchoolBasic(id);
    if (!school) throw new MasterAdminNotFoundError('École introuvable');

    await this.queryRepo.supprimerEcole(id);

    return { schoolName: school.name };
  }
}
