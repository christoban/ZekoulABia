import type {
  AnneeAcademiqueRepository,
  CalendrierPeriode,
} from '@domain/ports/repositories/AnneeAcademiqueRepository';

export interface MettreAJourCalendrierCommande {
  academicYearId: string;
  schoolId: string;
  periodes: CalendrierPeriode[];
}

export class MettreAJourCalendrierUseCase {
  constructor(private readonly anneeRepository: AnneeAcademiqueRepository) {}

  async execute(commande: MettreAJourCalendrierCommande): Promise<void> {
    const annee = await this.anneeRepository.findById(commande.academicYearId);
    if (!annee) {
      throw new Error(`Année académique introuvable : ${commande.academicYearId}`);
    }
    if (annee.status === 'ARCHIVED') {
      throw new Error("Impossible de modifier le calendrier d'une année archivée");
    }
    if (annee.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : année hors de votre établissement');
    }

    for (const periode of commande.periodes) {
      if (periode.startDate >= periode.endDate) {
        throw new Error(
          `Période "${periode.name}" : la date de début doit être avant la date de fin`
        );
      }
      for (const seq of periode.sequences) {
        if (seq.startDate && seq.endDate && seq.startDate >= seq.endDate) {
          throw new Error(
            `Séquence "${seq.name}" : la date de début doit être avant la date de fin`
          );
        }
      }
    }

    await this.anneeRepository.upsertCalendrier(
      commande.academicYearId,
      commande.schoolId,
      commande.periodes
    );
  }
}
