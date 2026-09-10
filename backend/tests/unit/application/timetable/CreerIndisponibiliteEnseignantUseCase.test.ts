import { describe, it, expect } from 'bun:test';
import { CreerIndisponibiliteEnseignantUseCase } from '../../../../src/application/timetable/CreerIndisponibiliteEnseignantUseCase.ts';
import { TeacherUnavailability } from '@domain/entities/TeacherUnavailability';
import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { UserRole } from '@domain/types/enums';

function userStub(role: UserRole = 'TEACHER', schoolId = 'school-1'): User {
  return User.reconstituer({
    id: 'prof-1',
    schoolId,
    role,
    firstName: 'M.',
    lastName: 'Test',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** Stub complet de UserRepository : toutes les méthodes en no-op, findById seul configurable. */
function userRepositoryStub(user: User | null): UserRepository {
  return {
    findById: async () => user,
    findByEmail: async () => null,
    findByPhone: async () => null,
    findByPhoneContient: async () => null,
    findBySchool: async () => [],
    findByRole: async () => [],
    findActiveByRoles: async () => [],
    findByClass: async () => [],
    existsByEmail: async () => false,
    save: async () => {},
    update: async () => {},
    delete: async () => {},
    findByIdWithRefreshVersion: async () => null,
    authentifier: async () => null,
    listerRolesAvecMotDePasse: async () => [],
    findMatchingAccountsByEmailPassword: async () => [],
    findActiveUsersByEmail: async () => [],
    saveAvecProfil: async () => {},
    mettreAJourAvecProfil: async () => {},
    supprimerAvecCascade: async () => {},
    restaurer: async () => {},
    listerSupprimes: async () => [],
    trouverSupprime: async () => null,
    findByIds: async () => [],
    transfererEleve: async () => {},
    findEmailsParentsParEleve: async () => [],
    findEmployeeById: async () => null,
    findEmployees: async () => [],
    findStudentsForBulletinGeneration: async () => [],
    findStudentNotificationContext: async () => null,
    findAuthDataById: async () => null,
    saveLoginEmailOtp: async () => {},
    incrementLoginEmailOtpAttempts: async () => {},
    clearLoginEmailOtp: async () => {},
    updateMfaRecoveryCodeHashes: async () => {},
    updateMfaTempSecret: async () => {},
    updateMfa: async () => {},
    isMfaEnabled: async () => false,
    creerJetonReinitialisation: async () => {},
    trouverParJetonReinitialisation: async () => null,
    reinitialiserMotDePasse: async () => {},
    verifierMotDePasse: async () => false,
    mettreAJourMotDePasse: async () => {},
    definirMotDePasseInvitation: async () => {},
  };
}

function repositoryStub(existantes: TeacherUnavailability[] = []): {
  findById: (id: string) => Promise<TeacherUnavailability | null>;
  findBySchool: (schoolId: string, activeOnly?: boolean) => Promise<TeacherUnavailability[]>;
  findByTeacher: (teacherId: string, schoolId: string, activeOnly?: boolean) => Promise<TeacherUnavailability[]>;
  save: (u: TeacherUnavailability) => Promise<void>;
  update: (u: TeacherUnavailability) => Promise<void>;
  delete: (id: string, schoolId: string) => Promise<void>;
} {
  return {
    findById: async (id) => existantes.find(t => t.id === id) ?? null,
    findBySchool: async (schoolId, activeOnly) => {
      return existantes.filter(t => t.schoolId === schoolId && (!activeOnly || t.active));
    },
    findByTeacher: async (teacherId, schoolId, activeOnly) => {
      return existantes.filter(t => t.teacherId === teacherId && t.schoolId === schoolId && (!activeOnly || t.active));
    },
    save: async (u) => { existantes.push(u); },
    update: async () => {},
    delete: async () => {},
  };
}

describe('CreerIndisponibiliteEnseignantUseCase (V2.4)', () => {
  it('crée une indisponibilité valide', async () => {
    const repo = repositoryStub();
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, userRepositoryStub(userStub()));
    const resultat = await useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    });
    expect(resultat.id).toBeDefined();
    expect(await repo.findByTeacher('prof-1', 'school-1', true)).toHaveLength(1);
  });

  it('rejette si l\'enseignant n\'existe pas', async () => {
    const repo = repositoryStub();
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, userRepositoryStub(null));
    await expect(useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    })).rejects.toThrow('Enseignant introuvable');
  });

  it('rejette si l\'utilisateur n\'est pas un enseignant', async () => {
    const repo = repositoryStub();
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, userRepositoryStub(userStub('ADMIN')));
    await expect(useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    })).rejects.toThrow("n'est pas un enseignant");
  });

  it('rejette un enseignant d\'une autre école', async () => {
    const repo = repositoryStub();
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, userRepositoryStub(userStub('TEACHER', 'school-2')));
    await expect(useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    })).rejects.toThrow("n'appartient pas");
  });

  it('rejette un chevauchement avec une plage active du même enseignant', async () => {
    const existante = TeacherUnavailability.create({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '10:00',
    });
    const repo = repositoryStub([existante]);
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, userRepositoryStub(userStub()));
    await expect(useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:30', endTime: '09:30',
    })).rejects.toThrow('chevauchement');
  });
});
