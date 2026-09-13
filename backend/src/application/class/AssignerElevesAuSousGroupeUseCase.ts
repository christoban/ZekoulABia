import type { SousGroupeRepository } from '@domain/ports/repositories/SousGroupeRepository';

export interface AssignerElevesCommande {
  subGroupId: string;
  studentProfileIds: string[];
  schoolId: string;
  demandeurRole: string;
}

export class AssignerElevesAuSousGroupeUseCase {
  constructor(private readonly sousGroupeRepository: SousGroupeRepository) {}

  async execute(commande: AssignerElevesCommande): Promise<{ assignes: number }> {
    if (!commande.studentProfileIds?.length) {
      throw new Error("La liste d'élèves ne peut pas être vide");
    }

    const sousGroupe = await this.sousGroupeRepository.findById(commande.subGroupId);
    if (!sousGroupe) throw new Error(`Sous-groupe introuvable : ${commande.subGroupId}`);

    await this.sousGroupeRepository.assignerEleves(
      commande.subGroupId,
      commande.studentProfileIds,
      commande.schoolId
    );

    return { assignes: commande.studentProfileIds.length };
  }
}
