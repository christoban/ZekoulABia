/**
 * Tests unitaires — InscrireEleveUseCase & ChangerGestionInscriptionsAdminUseCase
 */
import { describe, it, expect } from 'bun:test';
import { InscrireEleveUseCase } from '@application/eleveOnboarding/InscrireEleveUseCase';
import { ChangerGestionInscriptionsAdminUseCase } from '@application/eleveOnboarding/ChangerGestionInscriptionsAdminUseCase';
import { InMemorySchoolRepository } from '../../../helpers/repositories/InMemorySchoolRepository';
import { School } from '@domain/entities/School';

const SCHOOL_ID = 'school-1';

function stubOnboardingRepo(overrides: Record<string, any> = {}) {
  return {
    findOnboardingById: async () => overrides.onboarding ?? {
      id: 'ob-1',
      schoolId: SCHOOL_ID,
      status: 'SUBMITTED',
      nomProvisoire: 'Dupont Jean',
      classId: 'class-1',
      recipientType: 'ELEVE',
      contactEmail: 'jean@example.com',
      contactTelephone: null,
      parentContactEmail: null,
      parentContactTelephone: null,
      eleveADispositif: true,
      eleveDispositifOS: 'ANDROID',
      parentADispositif: false,
      parentDispositifOS: null,
      sourceType: 'AUTOSERVICE',
      examCandidateId: null,
      token: 'tok-1',
      tokenExpiresAt: new Date(Date.now() + 86400000),
      tokenUsedAt: new Date(),
      submittedData: {},
      matchScore: null,
      matchedStudentId: null,
    },
    validerOnboarding: async (_input: any) => ({
      studentProfileId: 'profile-1',
      classeId: 'class-1',
      comptesCrees: [
        {
          role: 'STUDENT',
          userId: 'user-eleve-1',
          temporaryPassword: 'temp-password-123',
          dispositifOS: 'ANDROID',
          contactEmail: 'jean@example.com',
          contactTelephone: null,
          compteExistant: false,
          accessMode: 'FULL_ACCESS',
        },
      ],
      groupeTransfertValide: false,
    }),
    ...overrides,
  };
}

describe('InscrireEleveUseCase', () => {
  it('échoue si le rôle de l utilisateur n est pas autorisé (ex: TEACHER)', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    const school = School.reconstituer({
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
    await schoolRepo.save(school);

    const activityLog = { log: async () => {} };
    const useCase = new InscrireEleveUseCase(stubOnboardingRepo() as any, schoolRepo, activityLog);

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        onboardingId: 'ob-1',
        validatedById: 'user-teacher',
        validatorRole: 'TEACHER',
      })
    ).rejects.toThrow('droits nécessaires');
  });

  it('échoue si l ADMIN essaie d inscrire alors que l option adminGereInscriptions est inactive', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    const school = School.reconstituer({
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
    await schoolRepo.save(school);

    const activityLog = { log: async () => {} };
    const useCase = new InscrireEleveUseCase(stubOnboardingRepo() as any, schoolRepo, activityLog);

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        onboardingId: 'ob-1',
        validatedById: 'user-admin',
        validatorRole: 'ADMIN',
      })
    ).rejects.toThrow('droits nécessaires');
  });

  it('permet à la SECRETAIRE (STAFF avec MANAGE_ENROLLMENT) d inscrire directement le dossier', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    const school = School.reconstituer({
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
    await schoolRepo.save(school);

    let logged = false;
    const activityLog = { log: async () => { logged = true; } };
    const useCase = new InscrireEleveUseCase(stubOnboardingRepo() as any, schoolRepo, activityLog);

    const result = await useCase.execute({
      schoolId: SCHOOL_ID,
      onboardingId: 'ob-1',
      validatedById: 'user-secretaire',
      validatorRole: 'STAFF',
      staffPermissions: ['MANAGE_ENROLLMENT'],
    });

    expect(result.studentProfileId).toBe('profile-1');
    expect(result.comptesCrees.length).toBe(1);
    expect(logged).toBe(true);
  });

  it('permet à l ADMIN d inscrire quand adminGereInscriptions est activé', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    const school = School.reconstituer({
      id: SCHOOL_ID,
      name: 'Lycée Test',
      subdomain: 'lycee-test',
      status: 'ACTIVE',
      plan: 'PREMIUM',
      subsystem: 'FRANCOPHONE',
      educationType: 'GENERAL',
      ownership: 'PUBLIC',
      saturdaySchedule: true,
      adminGereInscriptions: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await schoolRepo.save(school);

    const activityLog = { log: async () => {} };
    const useCase = new InscrireEleveUseCase(stubOnboardingRepo() as any, schoolRepo, activityLog);

    const result = await useCase.execute({
      schoolId: SCHOOL_ID,
      onboardingId: 'ob-1',
      validatedById: 'user-admin',
      validatorRole: 'ADMIN',
    });

    expect(result.studentProfileId).toBe('profile-1');
  });
});

describe('ChangerGestionInscriptionsAdminUseCase', () => {
  it('active l option de gestion admin et trace l événement dans ActivitiesLog', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    const school = School.reconstituer({
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
    await schoolRepo.save(school);

    let loggedAction = '';
    const activityLog = {
      log: async (entry: any) => {
        loggedAction = entry.action;
      },
    };

    const useCase = new ChangerGestionInscriptionsAdminUseCase(schoolRepo, activityLog);

    const res = await useCase.execute({
      schoolId: SCHOOL_ID,
      adminUserId: 'admin-1',
      actif: true,
    });

    expect(res.success).toBe(true);
    expect(res.adminGereInscriptions).toBe(true);
    expect(loggedAction).toBe('INSCRIPTIONS_ADMIN_GESTION_ACTIVEE');

    const updatedSchool = await schoolRepo.findById(SCHOOL_ID);
    expect(updatedSchool?.adminGereInscriptions).toBe(true);
  });

  it('désactive l option de gestion admin et trace l événement', async () => {
    const schoolRepo = new InMemorySchoolRepository();
    const school = School.reconstituer({
      id: SCHOOL_ID,
      name: 'Lycée Test',
      subdomain: 'lycee-test',
      status: 'ACTIVE',
      plan: 'PREMIUM',
      subsystem: 'FRANCOPHONE',
      educationType: 'GENERAL',
      ownership: 'PUBLIC',
      saturdaySchedule: true,
      adminGereInscriptions: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await schoolRepo.save(school);

    let loggedAction = '';
    const activityLog = {
      log: async (entry: any) => {
        loggedAction = entry.action;
      },
    };

    const useCase = new ChangerGestionInscriptionsAdminUseCase(schoolRepo, activityLog);

    const res = await useCase.execute({
      schoolId: SCHOOL_ID,
      adminUserId: 'admin-1',
      actif: false,
    });

    expect(res.success).toBe(true);
    expect(res.adminGereInscriptions).toBe(false);
    expect(loggedAction).toBe('INSCRIPTIONS_ADMIN_GESTION_DESACTIVEE');

    const updatedSchool = await schoolRepo.findById(SCHOOL_ID);
    expect(updatedSchool?.adminGereInscriptions).toBe(false);
  });
});
