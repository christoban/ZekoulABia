import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerMatiereUseCase } from '../../../../src/application/subject/CreerMatiereUseCase.ts';
import { InMemoryMatiereRepository } from '../../../helpers/repositories/InMemoryMatiereRepository.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';
import { User } from '@domain/entities/User';

describe('CreerMatiereUseCase', () => {
  let matiereRepo: InMemoryMatiereRepository;
  let userRepo: InMemoryUserRepository;
  let useCase: CreerMatiereUseCase;

  beforeEach(() => {
    matiereRepo = new InMemoryMatiereRepository();
    userRepo = new InMemoryUserRepository();
    userRepo.ajouter(User.reconstituer({
      id: 'teacher-1',
      schoolId: 'school-1',
      role: 'TEACHER',
      email: 'prof@test.cm',
      firstName: 'Marie',
      lastName: 'Ndi',
      isActive: true,
      refreshTokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      staffPermissions: [],
    }));
    useCase = new CreerMatiereUseCase(matiereRepo, userRepo);
  });

  it('devrait créer une matière avec défaults', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      name: 'Mathématiques',
      demandeurRole: 'ADMIN',
    });

    expect(resultat.matiereId).toBeDefined();
    expect(resultat.name).toBe('Mathématiques');

    const matiere = await matiereRepo.findById(resultat.matiereId);
    expect(matiere?.coefficient).toBe(1);
    expect(matiere?.hoursPerWeek).toBe(2);
    expect(matiere?.subjectType).toBe('THEORETICAL');
  });

  it('devrait rejeter si code déjà utilisé', async () => {
    await useCase.execute({
      schoolId: 'school-1',
      name: 'Maths',
      code: 'MATH',
      demandeurRole: 'ADMIN',
    });

    await expect(useCase.execute({
      schoolId: 'school-1',
      name: 'Mathématiques avancées',
      code: 'MATH',
      demandeurRole: 'ADMIN',
    })).rejects.toThrow('code');
  });

  it('devrait autoriser deux matières sans code', async () => {
    await useCase.execute({ schoolId: 'school-1', name: 'Maths', demandeurRole: 'ADMIN' });
    const r = await useCase.execute({ schoolId: 'school-1', name: 'Physique', demandeurRole: 'ADMIN' });
    expect(r.matiereId).toBeDefined();
  });

  it('devrait appeler syncEnseignants si teacherUserIds fourni', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      name: 'SVT',
      demandeurRole: 'ADMIN',
      teacherUserIds: ['teacher-1'],
    });

    expect(matiereRepo.syncAppels).toHaveLength(1);
    expect(matiereRepo.syncAppels[0].subjectId).toBe(resultat.matiereId);
    expect(matiereRepo.syncAppels[0].teacherUserIds).toContain('teacher-1');
  });

  it("devrait rejeter si demandeur n'est pas Admin", async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      name: 'Histoire',
      demandeurRole: 'TEACHER',
    })).rejects.toThrow('Admin');
  });
});
