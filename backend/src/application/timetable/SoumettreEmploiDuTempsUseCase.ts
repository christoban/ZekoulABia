import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export interface SoumettreEmploiDuTempsCommande {
  timetableId: string;
  schoolId: string;
  demandeurId: string;
  demandeurRole: string;
  demandeurPermissions: string[];
}

export class SoumettreEmploiDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(commande: SoumettreEmploiDuTempsCommande): Promise<void> {
    const role = commande.demandeurRole.toUpperCase();
    if (role !== 'ADMIN' && (role !== 'STAFF' || !commande.demandeurPermissions.includes('MANAGE_TIMETABLE'))) {
      throw new Error('Accès refusé : permission MANAGE_TIMETABLE requise');
    }

    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps) throw new Error(`EDT introuvable : ${commande.timetableId}`);
    if (emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : EDT hors de votre établissement');
    }

    const nombreCreneaux = await this.timetableRepository.countCreneaux(commande.timetableId);
    const statutAvant = emploiDuTemps.status;
    emploiDuTemps.soumettre(nombreCreneaux);
    await this.timetableRepository.update(emploiDuTemps);
    await this.activityLog.log({
      userId: commande.demandeurId,
      schoolId: commande.schoolId,
      action: 'Emploi du temps soumis',
      details: JSON.stringify({ timetableId: commande.timetableId, avant: statutAvant, apres: emploiDuTemps.status }),
    });
  }
}
