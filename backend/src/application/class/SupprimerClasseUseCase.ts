import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export class SupprimerClasseUseCase {
  constructor(private readonly classeRepository: ClasseRepository) {}

  async execute(params: { classeId: string; schoolId: string; demandeurId?: string }): Promise<void> {
    const classe = await this.classeRepository.findById(params.classeId);
    if (!classe) throw new Error(`Classe introuvable : ${params.classeId}`);

    if (classe.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : classe hors de votre établissement');
    }

    await this.classeRepository.supprimerAvecCascade(params.classeId, params.demandeurId);
  }
}
