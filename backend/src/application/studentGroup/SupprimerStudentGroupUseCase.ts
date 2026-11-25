import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';

export class SupprimerStudentGroupUseCase {
  constructor(
    private readonly groupRepository: StudentGroupRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
  ) {}

  async execute(params: { groupId: string; schoolId: string; demandeurRole: string }): Promise<void> {
    const group = await this.groupRepository.findById(params.groupId);
    if (!group) throw new Error(`Group introuvable : ${params.groupId}`);

    const groupSet = await this.groupSetRepository.findById(group.groupSetId);
    if (!groupSet || groupSet.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : Group hors de votre établissement');
    }

    await this.groupRepository.delete(params.groupId);
  }
}
