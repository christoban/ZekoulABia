import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export interface ViderCreneauxClasseCommande {
  timetableId: string;
  schoolId: string;
  demandeurId: string;
}

export class ViderCreneauxClasseUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(commande: ViderCreneauxClasseCommande): Promise<number> {
    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps || emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : emploi du temps hors de votre établissement');
    }
    if (emploiDuTemps.estPublie()) {
      throw new Error("Impossible de vider les créneaux d'un EDT publié");
    }

    const nombreSupprimes = await this.timetableRepository.deleteCreneauxTimetable(commande.timetableId);
    await this.activityLog.log({
      userId: commande.demandeurId,
      schoolId: commande.schoolId,
      action: 'Créneaux de l\'emploi du temps vidés',
      details: JSON.stringify({ timetableId: commande.timetableId, count: nombreSupprimes }),
    });
    return nombreSupprimes;
  }
}
