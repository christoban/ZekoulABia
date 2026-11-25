/**
 * APPLICATION LAYER — Liste des écoles membres d'un groupe, infos publiques uniquement.
 */
import type { GroupeScolaireQueryRepository } from '@domain/ports/repositories/GroupeScolaireQueryRepository';

export class ListerEcolesGroupeUseCase {
  constructor(private readonly queryRepository: GroupeScolaireQueryRepository) {}

  async execute(groupId: string) {
    return this.queryRepository.listerEcolesDuGroupe(groupId);
  }
}
