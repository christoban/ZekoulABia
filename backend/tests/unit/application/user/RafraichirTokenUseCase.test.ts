/**
 * Tests unitaires — RafraichirTokenUseCase
 */
import { describe, it, expect } from 'bun:test';
import { RafraichirTokenUseCase } from '@application/user/RafraichirTokenUseCase';
import { User } from '@domain/entities/User';
import { School } from '@domain/entities/School';
import { InMemorySchoolRepository } from '../../../helpers/repositories/InMemorySchoolRepository';

const SCHOOL_ID = 'school-refresh-1';

function createMockSchool(status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE'): School {
  return School.reconstituer({
    id: SCHOOL_ID,
    name: 'Lycée Test',
    subdomain: 'lycee-test',
    status,
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

function createUser(accessMode: 'FULL_ACCESS' | 'SMS_ONLY' = 'FULL_ACCESS', isActive = true): User {
  return User.reconstituer({
    id: 'user-1',
    schoolId: SCHOOL_ID,
    role: 'STUDENT',
    firstName: 'Jean',
    lastName: 'Ewane',
    email: 'jean@test.cm',
    isActive,
    accessMode,
    refreshTokenVersion: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('RafraichirTokenUseCase', () => {
  it('rafraîchit les tokens si l utilisateur et l école sont actifs', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    await schoolRepo.save(createMockSchool('ACTIVE'));

    const user = createUser('FULL_ACCESS', true);
    const mockUserRepo: any = {
      findByIdWithRefreshVersion: async () => ({
        user,
        refreshTokenVersion: 2,
      }),
    };

    const mockTokenService: any = {
      genererTokens: (payload: any) => ({
        accessToken: `access-${payload.userId}`,
        refreshToken: `refresh-${payload.userId}`,
      }),
    };

    const useCase = new RafraichirTokenUseCase(mockUserRepo, schoolRepo, mockTokenService);

    const res = await useCase.execute({
      userId: 'user-1',
      schoolId: SCHOOL_ID,
      role: 'STUDENT',
      permissions: [],
      tokenType: 'refresh',
      refreshTokenVersion: 2,
    });

    expect(res.accessToken).toBe('access-user-1');
    expect(res.refreshToken).toBe('refresh-user-1');
  });

  it('refuse si accessMode est différent de FULL_ACCESS (ex: SMS_ONLY)', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    await schoolRepo.save(createMockSchool('ACTIVE'));

    const user = createUser('SMS_ONLY', true);
    const mockUserRepo: any = {
      findByIdWithRefreshVersion: async () => ({
        user,
        refreshTokenVersion: 2,
      }),
    };

    const useCase = new RafraichirTokenUseCase(mockUserRepo, schoolRepo, {} as any);

    await expect(
      useCase.execute({
        userId: 'user-1',
        schoolId: SCHOOL_ID,
        role: 'STUDENT',
        permissions: [],
        tokenType: 'refresh',
        refreshTokenVersion: 2,
      })
    ).rejects.toThrow("Ce compte ne dispose pas d'un accès de connexion direct.");
  });

  it('refuse si la version du refreshToken ne correspond pas (session révoquée)', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    await schoolRepo.save(createMockSchool('ACTIVE'));

    const user = createUser('FULL_ACCESS', true);
    const mockUserRepo: any = {
      findByIdWithRefreshVersion: async () => ({
        user,
        refreshTokenVersion: 3, // révoqué / incrémenté
      }),
    };

    const useCase = new RafraichirTokenUseCase(mockUserRepo, schoolRepo, {} as any);

    await expect(
      useCase.execute({
        userId: 'user-1',
        schoolId: SCHOOL_ID,
        role: 'STUDENT',
        permissions: [],
        tokenType: 'refresh',
        refreshTokenVersion: 2,
      })
    ).rejects.toThrow('Session expirée');
  });

  it('refuse si l école est suspendue ou inactive', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    await schoolRepo.save(createMockSchool('SUSPENDED'));

    const user = createUser('FULL_ACCESS', true);
    const mockUserRepo: any = {
      findByIdWithRefreshVersion: async () => ({
        user,
        refreshTokenVersion: 2,
      }),
    };

    const useCase = new RafraichirTokenUseCase(mockUserRepo, schoolRepo, {} as any);

    await expect(
      useCase.execute({
        userId: 'user-1',
        schoolId: SCHOOL_ID,
        role: 'STUDENT',
        permissions: [],
        tokenType: 'refresh',
        refreshTokenVersion: 2,
      })
    ).rejects.toThrow("Cet établissement n'est plus actif");
  });
});
