/**
 * APPLICATION LAYER — Centre d'événements : événements ACTIVE ou UPCOMING (à venir sous 14
 * jours) dont le rôle de l'appelant fait partie des `targetRoles` — jamais les événements déjà
 * clôturés, qui restent consultables uniquement via ListerEvenementsUseCase (vue de gestion
 * Admin), en historique/archive.
 */
import type { AcademicEventRepository } from '@domain/ports/repositories/AcademicEventRepository';

const FENETRE_A_VENIR_JOURS = 14;

export class ObtenirEvenementsActifsUseCase {
  constructor(private readonly academicEventRepository: AcademicEventRepository) {}

  async execute(schoolId: string, role: string) {
    const dansQuatorzeJours = new Date(Date.now() + FENETRE_A_VENIR_JOURS * 24 * 60 * 60 * 1000);
    return this.academicEventRepository.listerActifs(schoolId, role, dansQuatorzeJours);
  }
}
