import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export interface SupprimerCreneauCommande {
  creneauId: string;
  schoolId: string;
  demandeurId: string;
}

export class SupprimerCreneauUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(commande: SupprimerCreneauCommande): Promise<void> {
    const creneau = await this.timetableRepository.findCreneauById(commande.creneauId);
    if (!creneau) throw new Error(`Créneau introuvable : ${commande.creneauId}`);

    const emploiDuTemps = await this.timetableRepository.findById(creneau.timetableId);
    if (!emploiDuTemps || emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : créneau hors de votre établissement');
    }
    if (emploiDuTemps.estPublie()) {
      throw new Error("Impossible de supprimer un créneau d'un EDT publié");
    }

    await this.timetableRepository.deleteCreneau(creneau.id, creneau.timetableId);
    await this.activityLog.log({
      userId: commande.demandeurId,
      schoolId: commande.schoolId,
      action: 'Créneau d\'emploi du temps supprimé',
      details: JSON.stringify({ timetableId: creneau.timetableId, slotId: creneau.id }),
    });
  }
}
