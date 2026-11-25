import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';

export class SupprimerStudentGroupSetUseCase {
  constructor(private readonly groupSetRepository: StudentGroupSetRepository) {}

  async execute(params: { groupSetId: string; schoolId: string; demandeurRole: string }): Promise<void> {
    const groupSet = await this.groupSetRepository.findById(params.groupSetId);
    if (!groupSet) throw new Error(`GroupSet introuvable : ${params.groupSetId}`);
    if (groupSet.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : GroupSet hors de votre établissement');
    }

    await this.groupSetRepository.delete(params.groupSetId);
  }
}
