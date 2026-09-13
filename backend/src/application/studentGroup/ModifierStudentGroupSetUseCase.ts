import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';

export interface ModifierStudentGroupSetCommande {
  groupSetId: string;
  schoolId: string;
  demandeurRole: string;
  code?: string;
  name?: string;
}

export class ModifierStudentGroupSetUseCase {
  constructor(private readonly groupSetRepository: StudentGroupSetRepository) {}

  async execute(commande: ModifierStudentGroupSetCommande): Promise<void> {
    const groupSet = await this.groupSetRepository.findById(commande.groupSetId);
    if (!groupSet) throw new Error(`GroupSet introuvable : ${commande.groupSetId}`);
    if (groupSet.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : GroupSet hors de votre établissement');
    }

    if (commande.code && commande.code !== groupSet.code) {
      const dejaExiste = await this.groupSetRepository.existsByCode(
        commande.schoolId, commande.code, commande.groupSetId
      );
      if (dejaExiste) {
        throw new Error(`Un autre GroupSet avec le code "${commande.code}" existe déjà`);
      }
    }

    await this.groupSetRepository.update({
      ...groupSet,
      ...(commande.code && { code: commande.code.trim() }),
      ...(commande.name && { name: commande.name.trim() }),
    });
  }
}
