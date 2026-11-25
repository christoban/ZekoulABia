import { describe, it, expect } from 'bun:test';
import { AssignerEnseignantMatiereUseCase } from '../../../../src/application/subject/AssignerEnseignantMatiereUseCase.ts';
import { User } from '@domain/entities/User';

function userTeacher(overrides: Partial<{ id: string; schoolId: string }> = {}): User {
  return User.reconstituer({
    id: overrides.id ?? 'teacher-1',
    schoolId: overrides.schoolId ?? 'school-1',
    role: 'TEACHER',
    firstName: 'Jean',
    lastName: 'Prof',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function userAdmin(overrides: Partial<{ id: string; schoolId: string }> = {}): User {
  return User.reconstituer({
    id: overrides.id ?? 'admin-1',
    schoolId: overrides.schoolId ?? 'school-1',
    role: 'ADMIN',
    firstName: 'Admin',
    lastName: 'Test',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function matiere(schoolId = 'school-1') {
  return { id: 'matiere-1', schoolId, name: 'Maths', coefficient: 1, hoursPerWeek: 2, subjectType: 'THEORETICAL' as const };
}

describe('AssignerEnseignantMatiereUseCase (V1.2)', () => {
  it('ADMIN peut assigner un enseignant à une matière', async () => {
    let assigne = false;
    const useCase = new AssignerEnseignantMatiereUseCase(
      {
        findById: async () => matiere(),
        estEnseignantAssigne: async () => false,
        assignerEnseignant: async () => { assigne = true; },
        retirerEnseignant: async () => {},
      } as never,
      { findById: async () => userTeacher() } as never,
    );
    await useCase.execute({ teacherUserId: 'teacher-1', matiereId: 'matiere-1', schoolId: 'school-1', demandeurRole: 'ADMIN', action: 'ASSIGNER' });
    expect(assigne).toBe(true);
  });

  it('refuse si le demandeur n est pas ADMIN', async () => {
    const useCase = new AssignerEnseignantMatiereUseCase({} as never, {} as never);
    await expect(useCase.execute({ teacherUserId: 't1', matiereId: 'm1', schoolId: 's1', demandeurRole: 'TEACHER', action: 'ASSIGNER' })).rejects.toThrow('Seul un Admin');
  });

  it('rejette si l enseignant est introuvable', async () => {
    const useCase = new AssignerEnseignantMatiereUseCase(
      { findById: async () => matiere() } as never,
      { findById: async () => null } as never,
    );
    await expect(useCase.execute({ teacherUserId: 't1', matiereId: 'm1', schoolId: 's1', demandeurRole: 'ADMIN', action: 'ASSIGNER' })).rejects.toThrow('Enseignant introuvable');
  });

  it('rejette si l utilisateur n est pas un enseignant', async () => {
    const useCase = new AssignerEnseignantMatiereUseCase(
      { findById: async () => matiere() } as never,
      { findById: async () => userAdmin({ id: 't1' }) } as never,
    );
    await expect(useCase.execute({ teacherUserId: 't1', matiereId: 'm1', schoolId: 's1', demandeurRole: 'ADMIN', action: 'ASSIGNER' })).rejects.toThrow("n'est pas un enseignant");
  });

  it("rejette si l enseignant n appartient pas à l établissement", async () => {
    const useCase = new AssignerEnseignantMatiereUseCase(
      { findById: async () => matiere('school-1') } as never,
      { findById: async () => userTeacher({ id: 't1', schoolId: 'school-2' }) } as never,
    );
    await expect(useCase.execute({ teacherUserId: 't1', matiereId: 'm1', schoolId: 'school-1', demandeurRole: 'ADMIN', action: 'ASSIGNER' })).rejects.toThrow("n'appartient pas");
  });

  it('rejette si la matière est introuvable dans l établissement', async () => {
    const useCase = new AssignerEnseignantMatiereUseCase(
      { findById: async () => null } as never,
      { findById: async () => userTeacher() } as never,
    );
    await expect(useCase.execute({ teacherUserId: 't1', matiereId: 'm1', schoolId: 'school-1', demandeurRole: 'ADMIN', action: 'ASSIGNER' })).rejects.toThrow('Matière introuvable');
  });

  it('rejette si déjà assigné', async () => {
    const useCase = new AssignerEnseignantMatiereUseCase(
      { findById: async () => matiere(), estEnseignantAssigne: async () => true } as never,
      { findById: async () => userTeacher() } as never,
    );
    await expect(useCase.execute({ teacherUserId: 't1', matiereId: 'm1', schoolId: 'school-1', demandeurRole: 'ADMIN', action: 'ASSIGNER' })).rejects.toThrow('déjà assigné');
  });

  it('RETIRER retire l assignation sans vérifier le doublon', async () => {
    let retire = false;
    const useCase = new AssignerEnseignantMatiereUseCase(
      { findById: async () => matiere(), retirerEnseignant: async () => { retire = true; } } as never,
      { findById: async () => userTeacher() } as never,
    );
    await useCase.execute({ teacherUserId: 't1', matiereId: 'm1', schoolId: 'school-1', demandeurRole: 'ADMIN', action: 'RETIRER' });
    expect(retire).toBe(true);
  });
});
