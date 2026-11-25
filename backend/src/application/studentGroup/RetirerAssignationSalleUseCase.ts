import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository';

export class RetirerAssignationSalleUseCase {
  constructor(private readonly classRoomAssignmentRepository: ClassRoomAssignmentRepository) {}

  async execute(params: { classId: string; academicYearId: string; schoolId: string; demandeurRole: string }): Promise<void> {
    const existante = await this.classRoomAssignmentRepository.findByClasseAndAnnee(
      params.classId, params.academicYearId
    );
    if (!existante) throw new Error('Aucune assignation de salle trouvée pour cette classe');
    if (existante.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : assignation hors de votre établissement');
    }

    await this.classRoomAssignmentRepository.delete(params.classId, params.academicYearId);
  }
}
