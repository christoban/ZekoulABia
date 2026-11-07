import { describe, expect, it } from 'bun:test';
import { ConfigurerTuteurPrincipalUseCase } from '../../../../src/application/studentTransfer/ConfigurerTuteurPrincipalUseCase.ts';
import type {
  GuardianCandidate,
  StudentGuardianRepository,
} from '../../../../src/domain/ports/repositories/StudentGuardianRepository.ts';

class InMemoryStudentGuardianRepository implements StudentGuardianRepository {
  private readonly guardians: GuardianCandidate[];
  configured: { studentProfileId: string; schoolId: string; parentProfileId: string } | null = null;

  constructor(guardians: GuardianCandidate[]) {
    this.guardians = guardians;
  }

  async findGuardiansByStudent(studentProfileId: string, schoolId: string): Promise<GuardianCandidate[]> {
    return this.guardians.filter(
      guardian => guardian.studentProfileId === studentProfileId && guardian.schoolId === schoolId,
    );
  }

  async setPrimaryGuardian(command: {
    studentProfileId: string;
    schoolId: string;
    parentProfileId: string;
  }): Promise<void> {
    this.configured = command;
  }
}

describe('ConfigurerTuteurPrincipalUseCase', () => {
  it('configure un tuteur de la même école déjà vérifié', async () => {
    const repository = new InMemoryStudentGuardianRepository([
      {
        studentProfileId: 'student-a', schoolId: 'school-a', parentProfileId: 'parent-a',
        phone: '+237600000001', phoneVerified: true,
      },
    ]);
    const useCase = new ConfigurerTuteurPrincipalUseCase(repository);

    await useCase.execute({
      studentProfileId: 'student-a', schoolId: 'school-a', parentProfileId: 'parent-a',
    });

    expect(repository.configured).toEqual({
      studentProfileId: 'student-a', schoolId: 'school-a', parentProfileId: 'parent-a',
    });
  });

  it('autorise la désignation avant vérification OTP (sinon le circuit serait bloqué)', async () => {
    const repository = new InMemoryStudentGuardianRepository([
      {
        studentProfileId: 'student-a', schoolId: 'school-a', parentProfileId: 'parent-a',
        phone: '+237600000001', phoneVerified: false,
      },
    ]);
    const useCase = new ConfigurerTuteurPrincipalUseCase(repository);

    await useCase.execute({
      studentProfileId: 'student-a', schoolId: 'school-a', parentProfileId: 'parent-a',
    });

    expect(repository.configured).toEqual({
      studentProfileId: 'student-a', schoolId: 'school-a', parentProfileId: 'parent-a',
    });
  });

  it('refuse un tuteur sans téléphone', async () => {
    const repository = new InMemoryStudentGuardianRepository([
      {
        studentProfileId: 'student-a', schoolId: 'school-a', parentProfileId: 'parent-a',
        phone: null, phoneVerified: false,
      },
    ]);
    const useCase = new ConfigurerTuteurPrincipalUseCase(repository);

    await expect(useCase.execute({
      studentProfileId: 'student-a', schoolId: 'school-a', parentProfileId: 'parent-a',
    })).rejects.toThrow('téléphone');
  });

  it('refuse un parent provenant d’une autre école', async () => {
    const repository = new InMemoryStudentGuardianRepository([
      {
        studentProfileId: 'student-a', schoolId: 'school-b', parentProfileId: 'parent-a',
        phone: '+237600000001', phoneVerified: true,
      },
    ]);
    const useCase = new ConfigurerTuteurPrincipalUseCase(repository);

    await expect(useCase.execute({
      studentProfileId: 'student-a', schoolId: 'school-a', parentProfileId: 'parent-a',
    })).rejects.toThrow('tuteur enregistré');
  });
});
