import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export class PublierTousEmploisDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(commande: { schoolId: string; demandeurId: string; demandeurRole: string }): Promise<{ publies: number; timetableIds: string[] }> {
    if (commande.demandeurRole.toUpperCase() !== 'ADMIN') {
      throw new Error('Accès refusé : seul ADMIN peut publier un EDT');
    }

    const enAttente = await this.timetableRepository.findSubmittedBySchool(commande.schoolId);
    if (enAttente.length === 0) {
      throw new Error('Aucun EDT en attente de publication');
    }

    const publies = await this.timetableRepository.publishSubmittedBySchool(commande.schoolId);
    if (publies.length === 0) {
      throw new Error('Aucun EDT en attente de publication');
    }
    const timetableIds = publies.map(edt => edt.id);
    await this.activityLog.log({
      userId: commande.demandeurId,
      schoolId: commande.schoolId,
      action: 'Emplois du temps publiés en lot',
      details: JSON.stringify({ timetableIds, avant: 'SUBMITTED', apres: 'PUBLISHED' }),
    });
    return { publies: publies.length, timetableIds };
  }
}
