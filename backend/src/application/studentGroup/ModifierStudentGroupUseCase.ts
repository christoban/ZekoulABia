import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';

export interface ModifierStudentGroupCommande {
  groupId: string;
  schoolId: string;
  demandeurRole: string;
  name?: string;
  subjectId?: string | null;
}

export class ModifierStudentGroupUseCase {
  constructor(
    private readonly groupRepository: StudentGroupRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
  ) {}

  async execute(commande: ModifierStudentGroupCommande): Promise<void> {
    const group = await this.groupRepository.findById(commande.groupId);
    if (!group) throw new Error(`Group introuvable : ${commande.groupId}`);

    const groupSet = await this.groupSetRepository.findById(group.groupSetId);
    if (!groupSet || groupSet.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : Group hors de votre établissement');
    }

    if (commande.name && commande.name !== group.name) {
      const dejaExiste = await this.groupRepository.existsByName(group.groupSetId, commande.name, commande.groupId);
      if (dejaExiste) {
        throw new Error(`Un autre Group nommé "${commande.name}" existe déjà dans ce GroupSet`);
      }
    }

    await this.groupRepository.update({
      ...group,
      ...(commande.name && { name: commande.name.trim() }),
      ...(commande.subjectId !== undefined && { subjectId: commande.subjectId ?? undefined }),
    });
  }
}
