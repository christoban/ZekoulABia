import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export interface PublierEmploiDuTempsCommande {
  timetableId: string;
  schoolId: string;
  demandeurId: string;
  demandeurRole: string;
}

export class PublierEmploiDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(commande: PublierEmploiDuTempsCommande): Promise<void> {
    if (commande.demandeurRole.toUpperCase() !== 'ADMIN') {
      throw new Error('Accès refusé : seul ADMIN peut publier un EDT');
    }

    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps) throw new Error(`EDT introuvable : ${commande.timetableId}`);
    if (emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : EDT hors de votre établissement');
    }

    const statutAvant = emploiDuTemps.status;
    emploiDuTemps.publier();
    await this.timetableRepository.update(emploiDuTemps);
    await this.activityLog.log({
      userId: commande.demandeurId,
      schoolId: commande.schoolId,
      action: 'Emploi du temps publié',
      details: JSON.stringify({ timetableId: commande.timetableId, avant: statutAvant, apres: emploiDuTemps.status }),
    });
  }
}
