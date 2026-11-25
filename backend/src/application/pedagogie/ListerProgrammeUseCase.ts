import type { ProgrammeRepository, ProgrammeProps } from '@domain/ports/repositories/ProgrammeRepository';

export interface ListerProgrammeInput {
  schoolId: string;
  academicYearId?: string;
  subjectId?: string;
  classId?: string;
  level?: string;
}

export class ListerProgrammeUseCase {
  constructor(private readonly programmeRepository: ProgrammeRepository) {}

  async execute(input: ListerProgrammeInput): Promise<ProgrammeProps[]> {
    return this.programmeRepository.findByFilters(input.schoolId, {
      academicYearId: input.academicYearId,
      subjectId: input.subjectId,
      classId: input.classId,
      level: input.level,
    });
  }
}
