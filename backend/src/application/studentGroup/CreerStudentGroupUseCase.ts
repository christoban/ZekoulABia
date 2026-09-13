import type { StudentGroupRepository, StudentGroupProps } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';

export interface CreerStudentGroupCommande {
  groupSetId: string;
  schoolId: string;
  name: string;
  subjectId?: string;
  demandeurRole: string;
}

export interface CreerStudentGroupResultat {
  groupId: string;
  name: string;
}

export class CreerStudentGroupUseCase {
  constructor(
    private readonly groupRepository: StudentGroupRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
  ) {}

  async execute(commande: CreerStudentGroupCommande): Promise<CreerStudentGroupResultat> {
    const groupSet = await this.groupSetRepository.findById(commande.groupSetId);
    if (!groupSet) throw new Error(`GroupSet introuvable : ${commande.groupSetId}`);
    if (groupSet.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : GroupSet hors de votre établissement');
    }

    if (!commande.name?.trim()) {
      throw new Error('Le nom du Group est obligatoire');
    }

    const dejaExiste = await this.groupRepository.existsByName(commande.groupSetId, commande.name.trim());
    if (dejaExiste) {
      throw new Error(`Un Group nommé "${commande.name}" existe déjà dans ce GroupSet`);
    }

    const group: StudentGroupProps = {
      id: crypto.randomUUID(),
      groupSetId: commande.groupSetId,
      name: commande.name.trim(),
      subjectId: commande.subjectId,
    };

    await this.groupRepository.save(group);

    return { groupId: group.id, name: group.name };
  }
}
