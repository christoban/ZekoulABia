import type { NoteRepository, NoteFilters } from '@domain/ports/repositories/NoteRepository';
import type { GradeValidationStatus } from '@domain/types/enums';
import type { NoteProps } from '@domain/entities/Note';

export interface StatutParClasseRequete {
  schoolId: string;
  classId: string;
  sequenceId?: string;
}

export interface StatutSujet {
  subjectId: string;
  total: number;
  validated: number;
  locked: number;
}

export interface StatutClasseResultat {
  classId: string;
  stats: Record<GradeValidationStatus, number>;
  bySubject: Record<string, StatutSujet>;
  canGenerateReportCard: boolean;
  grades: NoteProps[];
}

export class StatutParClasseUseCase {
  constructor(private readonly noteRepository: NoteRepository) {}

  async execute(requete: StatutParClasseRequete): Promise<StatutClasseResultat> {
    const { schoolId, classId, sequenceId } = requete;

    const filters: NoteFilters = { schoolId, classId };
    if (sequenceId) filters.sequenceId = sequenceId;

    const result = await this.noteRepository.find(filters, 1, 100000);
    const grades = result.items.map(n => n.toObject());

    const stats: Record<GradeValidationStatus, number> = {
      DRAFT: 0, LOCKED: 0,
    };
    for (const g of grades) {
      stats[g.validationStatus]++;
    }

    const bySubject: Record<string, StatutSujet> = {};
    for (const g of grades) {
      if (!bySubject[g.subjectId]) {
        bySubject[g.subjectId] = { subjectId: g.subjectId, total: 0, validated: 0, locked: 0 };
      }
      bySubject[g.subjectId].total++;
      if (g.validationStatus === 'LOCKED') bySubject[g.subjectId].locked++;
    }

    const canGenerateReportCard =
      grades.length > 0 &&
      grades.every(g => g.validationStatus === 'LOCKED');

    return { classId, stats, bySubject, canGenerateReportCard, grades };
  }
}
