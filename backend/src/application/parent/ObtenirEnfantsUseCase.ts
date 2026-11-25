/**
 * APPLICATION LAYER — Use Case : Obtenir les enfants du parent connecté
 *
 * Améliorations vs controller actuel :
 * - LATE comptabilisé séparément (tauxPonctualite) — retard ≠ absence au Cameroun
 * - healthScore exposé
 * - dernieereMoyenne ajoutée
 */
import type { ParentRepository, EnfantAvecStats } from '@domain/ports/repositories/ParentRepository';

export class ObtenirEnfantsUseCase {
  constructor(private readonly parentRepository: ParentRepository) {}

  async execute(params: {
    parentUserId: string;
    schoolId: string;
  }): Promise<EnfantAvecStats[]> {
    return this.parentRepository.findEnfantsAvecStats(
      params.parentUserId,
      params.schoolId
    );
  }
}
