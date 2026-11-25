/**
 * APPLICATION LAYER — Liste tous les événements académiques d'un établissement (vue de gestion
 * Admin), tous statuts confondus — à l'inverse d'ObtenirEvenementsActifsUseCase qui alimente le
 * centre d'événements (actifs/à venir uniquement, filtré par rôle de l'appelant).
 */
import type { AcademicEventRepository } from '@domain/ports/repositories/AcademicEventRepository';

export class ListerEvenementsUseCase {
  constructor(private readonly academicEventRepository: AcademicEventRepository) {}

  async execute(schoolId: string) {
    return this.academicEventRepository.listerTous(schoolId);
  }
}
