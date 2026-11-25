import type { StudentGroupSetRepository, StudentGroupSetProps } from '@domain/ports/repositories/StudentGroupSetRepository';

export interface CreerStudentGroupSetCommande {
  schoolId: string;
  code: string;
  name: string;
  demandeurRole: string;
}

export interface CreerStudentGroupSetResultat {
  groupSetId: string;
  code: string;
  name: string;
}

export class CreerStudentGroupSetUseCase {
  constructor(private readonly groupSetRepository: StudentGroupSetRepository) {}

  async execute(commande: CreerStudentGroupSetCommande): Promise<CreerStudentGroupSetResultat> {
    if (!commande.code?.trim()) {
      throw new Error('Le code du GroupSet est obligatoire');
    }

    const dejaExiste = await this.groupSetRepository.existsByCode(commande.schoolId, commande.code.trim());
    if (dejaExiste) {
      throw new Error(`Un GroupSet avec le code "${commande.code}" existe déjà dans cet établissement`);
    }

    const groupSet: StudentGroupSetProps = {
      id: crypto.randomUUID(),
      schoolId: commande.schoolId,
      code: commande.code.trim(),
      name: commande.name.trim(),
    };

    await this.groupSetRepository.save(groupSet);

    return { groupSetId: groupSet.id, code: groupSet.code, name: groupSet.name };
  }
}
