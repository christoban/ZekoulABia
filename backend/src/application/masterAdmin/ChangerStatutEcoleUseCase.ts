/**
 * APPLICATION LAYER — Use Case : Changer le statut d'une école (remise en attente)
 * - annulerApprobation : APPROVED → PENDING
 * - reexaminer         : REJECTED → PENDING
 * Chaque méthode garde son invariant de statut métier.
 */
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import { MasterAdminNotFoundError, MasterAdminValidationError } from './errors';

export class ChangerStatutEcoleUseCase {
  constructor(
    private readonly queryRepo: MasterAdminQueryRepository,
  ) {}

  async annulerApprobation(id: string): Promise<{ schoolName: string }> {
    const school = await this.queryRepo.findSchoolBasic(id);
    if (!school) throw new MasterAdminNotFoundError('École introuvable');
    if (school.status !== 'APPROVED') {
      throw new MasterAdminValidationError('Seule une école approuvée peut voir son approbation annulée');
    }
    await this.queryRepo.changerStatutEcole(id, 'PENDING');
    return { schoolName: school.name };
  }

  async reexaminer(id: string): Promise<{ schoolName: string }> {
    const school = await this.queryRepo.findSchoolBasic(id);
    if (!school) throw new MasterAdminNotFoundError('École introuvable');
    if (school.status !== 'REJECTED') {
      throw new MasterAdminValidationError('Seule une école rejetée peut être réexaminée');
    }
    await this.queryRepo.changerStatutEcole(id, 'PENDING');
    return { schoolName: school.name };
  }
}
