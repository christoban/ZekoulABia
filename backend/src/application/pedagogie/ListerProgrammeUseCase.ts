import type { ProgrammeRepository, ProgrammeProps } from '@domain/ports/repositories/ProgrammeRepository';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import { PedagogieForbiddenError } from './errors';
import { resoudreScopePedagogie, type PedagogieActor } from './PedagogieAccessGuard';

export interface ListerProgrammeInput {
  schoolId: string;
  academicYearId?: string;
  subjectId?: string;
  classId?: string;
  level?: string;
  actor?: PedagogieActor;
}

export class ListerProgrammeUseCase {
  constructor(
    private readonly programmeRepository: ProgrammeRepository,
    private readonly departmentRepository?: DepartmentRepository,
  ) {}

  async execute(input: ListerProgrammeInput): Promise<ProgrammeProps[]> {
    let allowedSubjectIds: Set<string> | null = null;

    if (input.actor && this.departmentRepository) {
      const scope = await resoudreScopePedagogie(
        this.departmentRepository,
        input.schoolId,
        input.actor,
      );
      if (scope.kind === 'NONE') {
        throw new PedagogieForbiddenError(
          "Accès refusé : vous n'êtes pas autorisé à consulter le catalogue global des programmes.",
        );
      }
      if (scope.kind === 'DEPARTMENT_SCOPED') {
        allowedSubjectIds = scope.subjectIds;
        if (input.subjectId && !allowedSubjectIds.has(input.subjectId)) {
          return [];
        }
      }
    }

    const programmes = await this.programmeRepository.findByFilters(input.schoolId, {
      academicYearId: input.academicYearId,
      subjectId: input.subjectId,
      classId: input.classId,
      level: input.level,
    });

    if (allowedSubjectIds !== null) {
      return programmes.filter((p) => allowedSubjectIds!.has(p.subjectId));
    }

    return programmes;
  }
}
