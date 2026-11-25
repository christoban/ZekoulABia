import type { AssessmentScopeRepository } from '@domain/ports/repositories/AssessmentScopeRepository';
import type { SequenceType } from '@domain/types/enums';
import { AssessmentScope } from '@domain/entities/AssessmentScope';

export interface CreerAssessmentScopeCommande {
  schoolId: string;
  academicYearId: string;
  name: string;
  sequenceType: SequenceType;
  subjectIds: string[];
  classIds: string[];
}

export class CreerAssessmentScopeUseCase {
  constructor(private readonly scopeRepository: AssessmentScopeRepository) {}

  async execute(commande: CreerAssessmentScopeCommande): Promise<{ scopeId: string }> {
    const scope = AssessmentScope.create({
      schoolId: commande.schoolId,
      academicYearId: commande.academicYearId,
      name: commande.name,
      sequenceType: commande.sequenceType,
      subjectIds: commande.subjectIds,
      classIds: commande.classIds,
    });

    await this.scopeRepository.save(scope);

    return { scopeId: scope.id };
  }
}
