/**
 * APPLICATION LAYER — Use Case : Vérifier l'accès d'un parent à un élève
 * Règle domaine : un parent ne peut consulter QUE ses propres enfants.
 * Utilisé par les autres Use Cases du module parent.
 */
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';

export class VerifierAccesEnfantUseCase {
  constructor(private readonly parentRepository: ParentRepository) {}

  async execute(parentUserId: string, studentId: string): Promise<void> {
    await this.parentRepository.verifierRelationEnfant(parentUserId, studentId);
  }
}
