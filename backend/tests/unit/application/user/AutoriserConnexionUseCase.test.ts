/**
 * Tests unitaires — AutoriserConnexionUseCase
 */
import { describe, it, expect } from 'bun:test';
import { AutoriserConnexionUseCase } from '@application/user/AutoriserConnexionUseCase';
import { User } from '@domain/entities/User';
import { School } from '@domain/entities/School';
import { InMemorySchoolRepository } from '../../../helpers/repositories/InMemorySchoolRepository';

const SCHOOL_ID = 'school-aut-1';

function createMockSchool(): School {
  return School.reconstituer({
    id: SCHOOL_ID,
    name: 'Lycée Test',
    subdomain: 'lycee-test',
    status: 'ACTIVE',
    plan: 'PREMIUM',
    subsystem: 'FRANCOPHONE',
    educationType: 'GENERAL',
    ownership: 'PUBLIC',
    saturdaySchedule: true,
    adminGereInscriptions: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function createStudentUser(overrides: Partial<Parameters<typeof User.reconstituer>[0]> = {}): User {
  return User.reconstituer({
    id: 'student-1',
    schoolId: SCHOOL_ID,
    role: 'STUDENT',
    firstName: 'Junior',
    lastName: 'Kotto',
    email: 'junior@test.cm',
    phone: '+237699999999',
    isActive: true,
    mustChangePassword: false,
    accessMode: 'SMS_ONLY',
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('AutoriserConnexionUseCase', () => {
  it('échoue si l opérateur n a pas les droits nécessaires (ex: TEACHER)', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    const useCase = new AutoriserConnexionUseCase(
      {} as any,
      schoolRepo,
      {} as any,
      {} as any,
    );

    await expect(
      useCase.execute({
        operatorUserId: 'teacher-1',
        operatorRole: 'TEACHER',
        schoolId: SCHOOL_ID,
        targetUserId: 'student-1',
      })
    ).rejects.toThrow('droits nécessaires');
  });

  it('échoue si le rôle cible n est ni STUDENT ni PARENT (ex: TEACHER)', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    await schoolRepo.save(createMockSchool());

    const teacherTarget = User.reconstituer({
      id: 'target-teacher',
      schoolId: SCHOOL_ID,
      role: 'TEACHER',
      firstName: 'Prof',
      lastName: 'Maths',
      email: 'prof@test.cm',
      isActive: true,
      refreshTokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockUserRepo: any = {
      findById: async () => teacherTarget,
    };

    const useCase = new AutoriserConnexionUseCase(
      mockUserRepo,
      schoolRepo,
      {} as any,
      {} as any,
    );

    await expect(
      useCase.execute({
        operatorUserId: 'admin-1',
        operatorRole: 'ADMIN',
        schoolId: SCHOOL_ID,
        targetUserId: 'target-teacher',
      })
    ).rejects.toThrow('Seuls les comptes élèves et parents');
  });

  it('échoue si l utilisateur n appartient pas à l établissement', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    await schoolRepo.save(createMockSchool());

    const studentOtherSchool = createStudentUser({ schoolId: 'other-school' });

    const mockUserRepo: any = {
      findById: async () => studentOtherSchool,
    };

    const useCase = new AutoriserConnexionUseCase(
      mockUserRepo,
      schoolRepo,
      {} as any,
      {} as any,
    );

    await expect(
      useCase.execute({
        operatorUserId: 'admin-1',
        operatorRole: 'ADMIN',
        schoolId: SCHOOL_ID,
        targetUserId: 'student-1',
      })
    ).rejects.toThrow('dans cet établissement');
  });

  it('permet à la SECRETAIRE (STAFF avec MANAGE_ENROLLMENT) d autoriser la connexion', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    await schoolRepo.save(createMockSchool());

    const student = createStudentUser({ accessMode: 'SMS_ONLY' });
    let updatedUserId = '';
    let updatedHash = '';
    const mockUserRepo: any = {
      findById: async () => student,
      definirMotDePasseTemporaire: async (id: string, hash: string) => {
        updatedUserId = id;
        updatedHash = hash;
      },
    };

    let sentCredentialsParams: any = null;
    const mockCredentialsNotifier: any = {
      sendCredentials: async (params: any) => {
        sentCredentialsParams = params;
        return 'EMAIL';
      },
    };

    let loggedActivity: any = null;
    const mockActivityLog: any = {
      log: async (entry: any) => {
        loggedActivity = entry;
      },
    };

    const useCase = new AutoriserConnexionUseCase(
      mockUserRepo,
      schoolRepo,
      mockCredentialsNotifier,
      mockActivityLog,
    );

    const result = await useCase.execute({
      operatorUserId: 'staff-secretaire',
      operatorRole: 'STAFF',
      operatorPermissions: ['MANAGE_ENROLLMENT'],
      schoolId: SCHOOL_ID,
      targetUserId: 'student-1',
    });

    expect(result.success).toBe(true);
    expect(result.accessMode).toBe('FULL_ACCESS');
    expect(result.channelUtilise).toBe('EMAIL');
    expect(updatedUserId).toBe('student-1');
    expect(updatedHash.length).toBeGreaterThan(10);
    expect(sentCredentialsParams.email).toBe('junior@test.cm');
    expect(sentCredentialsParams.roleLabel).toBe('Élève');
    expect(loggedActivity.action).toBe('USER_ACCESS_MODE_UPDATED');
    expect(loggedActivity.userId).toBe('staff-secretaire');
  });
});
