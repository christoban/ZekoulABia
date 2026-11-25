import { describe, it, expect, beforeEach } from 'bun:test';
import { AssignerProfesseurPrincipalUseCase } from '../../../../src/application/class/AssignerProfesseurPrincipalUseCase.ts';
import { InMemoryClasseRepository } from '../../../helpers/repositories/InMemoryClasseRepository.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';
import { Classe } from '@domain/entities/Classe';
import { User } from '@domain/entities/User';

describe('AssignerProfesseurPrincipalUseCase', () => {
  let classeRepo: InMemoryClasseRepository;
  let userRepo: InMemoryUserRepository;
  let useCase: AssignerProfesseurPrincipalUseCase;

  beforeEach(() => {
    classeRepo = new InMemoryClasseRepository();
    userRepo = new InMemoryUserRepository();
    useCase = new AssignerProfesseurPrincipalUseCase(classeRepo, userRepo);

    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-1',
      schoolId: 'school-1',
      academicYearId: 'annee-1',
      name: '2nde C',
      capacity: 40,
      status: 'ACTIVE',
      createdAt: new Date(),
    }));

    userRepo.ajouter(User.reconstituer({
      id: 'teacher-1',
      schoolId: 'school-1',
      role: 'TEACHER',
      email: 'prof@test.cm',
      firstName: 'Jean',
      lastName: 'Mballa',
      isActive: true,
      refreshTokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      staffPermissions: [],
    }));
  });

  it('devrait assigner un professeur principal valide', async () => {
    await useCase.execute({
      classeId: 'classe-1',
      teacherUserId: 'teacher-1',
      schoolId: 'school-1',
      demandeurRole: 'ADMIN',
    });

    const classeApres = await classeRepo.findById('classe-1');
    expect(classeApres?.professorPrincipalId).toBe('teacher-1');
  });

  it("devrait rejeter si demandeur n'est pas Admin", async () => {
    await expect(useCase.execute({
      classeId: 'classe-1',
      teacherUserId: 'teacher-1',
      schoolId: 'school-1',
      demandeurRole: 'STAFF',
    })).rejects.toThrow('Seul un Admin');
  });

  it("devrait rejeter si l'utilisateur n'est pas TEACHER", async () => {
    userRepo.ajouter(User.reconstituer({
      id: 'non-teacher',
      schoolId: 'school-1',
      role: 'PARENT',
      email: 'parent@test.cm',
      firstName: 'Alice',
      lastName: 'Ngo',
      isActive: true,
      refreshTokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      staffPermissions: [],
    }));

    await expect(useCase.execute({
      classeId: 'classe-1',
      teacherUserId: 'non-teacher',
      schoolId: 'school-1',
      demandeurRole: 'ADMIN',
    })).rejects.toThrow("n'est pas un enseignant");
  });

  it("devrait rejeter si l'enseignant est d'une autre école", async () => {
    userRepo.ajouter(User.reconstituer({
      id: 'teacher-autre',
      schoolId: 'school-99',
      role: 'TEACHER',
      email: 'autre@test.cm',
      firstName: 'Paul',
      lastName: 'Biya',
      isActive: true,
      refreshTokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      staffPermissions: [],
    }));

    await expect(useCase.execute({
      classeId: 'classe-1',
      teacherUserId: 'teacher-autre',
      schoolId: 'school-1',
      demandeurRole: 'ADMIN',
    })).rejects.toThrow("n'appartient pas");
  });
});
