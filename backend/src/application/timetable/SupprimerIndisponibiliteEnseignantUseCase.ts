import type { TeacherUnavailabilityRepository } from '@domain/ports/repositories/TeacherUnavailabilityRepository';

export interface SupprimerIndisponibiliteEnseignantCommande {
  id: string;
  schoolId: string;
}

export class SupprimerIndisponibiliteEnseignantUseCase {
  constructor(private readonly repository: TeacherUnavailabilityRepository) {}

  async execute(commande: SupprimerIndisponibiliteEnseignantCommande): Promise<void> {
    const existante = await this.repository.findById(commande.id);
    if (!existante || existante.schoolId !== commande.schoolId) {
      throw new Error(`Indisponibilité introuvable : ${commande.id}`);
    }

    await this.repository.delete(commande.id, commande.schoolId);
  }
}