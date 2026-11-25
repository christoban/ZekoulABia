import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';

export class SupprimerMatiereUseCase {
  constructor(private readonly matiereRepository: MatiereRepository) {}

  async execute(params: { matiereId: string; schoolId: string; demandeurRole: string; demandeurId?: string }): Promise<void> {
    if (params.demandeurRole !== 'ADMIN') {
      throw new Error('Seul un Admin peut supprimer une matière');
    }

    const matiere = await this.matiereRepository.findById(params.matiereId);
    if (!matiere) throw new Error('Matière introuvable');

    if (matiere.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : matière hors de votre établissement');
    }

    await this.matiereRepository.delete(params.matiereId, params.demandeurId);
  }
}
