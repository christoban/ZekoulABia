import { describe, it, expect } from 'bun:test';
import { GenererAffectationsUseCase } from '../../../../src/application/teachingAssignment/GenererAffectationsUseCase';
import type {
  TeachingAssignmentGeneratorRepository,
  DonneesGenerationAffectations,
  AssignmentACreerPayload,
} from '@domain/ports/repositories/TeachingAssignmentGeneratorRepository';

class FakeGeneratorRepository implements TeachingAssignmentGeneratorRepository {
  data: DonneesGenerationAffectations = {
    classes: [],
    matieres: [],
    enseignants: [],
    affectations: [],
  };
  created: AssignmentACreerPayload[] = [];

  async loadGenerationData(): Promise<DonneesGenerationAffectations> {
    return this.data;
  }

  async createAssignmentsInTransaction(assignments: AssignmentACreerPayload[]): Promise<number> {
    this.created = assignments;
    return assignments.length;
  }

  async syncLv2Groups(): Promise<void> {
    // no-op dans les tests unitaires
  }
}

describe('GenererAffectationsUseCase', () => {
  it('calcule la charge actuelle à partir des affectations existantes', async () => {
    const repo = new FakeGeneratorRepository();
    repo.data = {
      classes: [{ id: 'c1', name: '6e A', level: '6e', serie: null, filiere: 'FR_GENERAL', academicYearId: 'ay1' }],
      matieres: [
        { classId: 'c1', className: '6e A', subjectId: 's1', subjectName: 'Mathématiques', weeklyPeriods: 4 },
        { classId: 'c1', className: '6e A', subjectId: 's2', subjectName: 'Français', weeklyPeriods: 3 },
      ],
      enseignants: [
        { teacherId: 't1', subjectId: 's1', estAP: true },
        { teacherId: 't1', subjectId: 's2', estAP: true },
      ],
      affectations: [
        // t1 a déjà 12h de maths
        { classId: 'c1', subjectId: 's1', teacherId: 't1' },
      ],
    };

    const uc = new GenererAffectationsUseCase(repo);
    const result = await uc.execute({ schoolId: 's1', academicYearId: 'ay1' });

    // s1 déjà affecté → skip ; s2 = 3h, t1 AP a 12h+3 <= 14 → créé
    expect(result.createdCount).toBe(1);
    expect(repo.created).toHaveLength(1);
    expect(repo.created[0]).toEqual({
      classId: 'c1',
      subjectId: 's2',
      teacherId: 't1',
      schoolId: 's1',
      academicYearId: 'ay1',
    });
  });

  it('ne crée rien quand tout est déjà affecté', async () => {
    const repo = new FakeGeneratorRepository();
    repo.data = {
      classes: [{ id: 'c1', name: '6e A', level: '6e', serie: null, filiere: 'FR_GENERAL', academicYearId: 'ay1' }],
      matieres: [{ classId: 'c1', className: '6e A', subjectId: 's1', subjectName: 'Mathématiques', weeklyPeriods: 4 }],
      enseignants: [{ teacherId: 't1', subjectId: 's1', estAP: false }],
      affectations: [{ classId: 'c1', subjectId: 's1', teacherId: 't1' }],
    };

    const uc = new GenererAffectationsUseCase(repo);
    const result = await uc.execute({ schoolId: 's1', academicYearId: 'ay1' });

    expect(result.createdCount).toBe(0);
    expect(result.nonResolus).toHaveLength(0);
    expect(result.horsPerimetre).toHaveLength(0);
  });
});
