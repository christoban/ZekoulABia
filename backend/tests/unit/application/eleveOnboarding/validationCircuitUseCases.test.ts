import { describe, it, expect } from 'bun:test';
import { InscrireEleveUseCase } from '@application/eleveOnboarding/InscrireEleveUseCase';
import { SoumettreOnboardingUseCase } from '@application/eleveOnboarding/SoumettreOnboardingUseCase';
import { RenvoyerOnboardingUseCase } from '@application/eleveOnboarding/RenvoyerOnboardingUseCase';
import type { EleveOnboardingRepository, OnboardingRecord } from '@domain/ports/repositories/EleveOnboardingRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import { School } from '@domain/entities/School';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

import { InMemorySchoolRepository } from '../../../helpers/repositories/InMemorySchoolRepository';

describe('Circuit de validation Onboarding (Phase 1A)', () => {
  const schoolId = 'school-123';
  const onboardingId = 'ob-123';

  const baseOnboarding: OnboardingRecord = {
    id: onboardingId,
    schoolId,
    nomProvisoire: 'Mbappe Kylian',
    classId: 'class-6e',
    recipientType: 'ELEVE',
    sourceType: 'AUTOSERVICE',
    status: 'SUBMITTED',
    token: 'tok-123',
    tokenExpiresAt: new Date(Date.now() + 86400000),
    contactEmail: 'kylian@paris.com',
    contactTelephone: '+237699000000',
    parentContactEmail: null,
    parentContactTelephone: null,
    examCandidateId: null,
    eleveADispositif: true,
    eleveDispositifOS: 'ANDROID',
    parentADispositif: null,
    parentDispositifOS: null,
    tokenUsedAt: null,
    matchScore: null,
    matchedStudentId: null,
    submittedData: { nom: 'Mbappe', prenom: 'Kylian', dateNaissance: '20/12/2010', gender: 'M' },
  };

  const mockActivityLog: ActivityLogPort = {
    log: async () => {},
  };

  const createMockSchoolRepo = (adminGereInscriptions = false): SchoolRepository => {
    const repo = new InMemorySchoolRepository();
    repo.ajouter(School.reconstituer({
      id: schoolId,
      name: 'École Test',
      subdomain: 'ecole-test',
      status: 'ACTIVE',
      plan: 'PREMIUM',
      subsystem: 'FRANCOPHONE',
      educationType: 'GENERAL',
      ownership: 'PUBLIC',
      saturdaySchedule: true,
      adminGereInscriptions,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    return repo;
  };

  describe('InscrireEleveUseCase', () => {
    it('refuse si l’utilisateur n’est pas ADMIN (secrétaire ne peut pas valider/inscrire)', async () => {
      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => baseOnboarding,
      };
      const useCase = new InscrireEleveUseCase(
        mockRepo as EleveOnboardingRepository,
        createMockSchoolRepo(false),
        mockActivityLog,
      );

      await expect(
        useCase.execute({
          schoolId,
          onboardingId,
          validatedById: 'user-secr',
          validatorRole: 'STAFF',
          staffPermissions: ['MANAGE_ENROLLMENT'],
          classId: 'class-6e',
        }),
      ).rejects.toThrow('Seul l’administrateur peut valider et inscrire un dossier.');
    });

    it('refuse si dérogation de capacité demandée sans motif', async () => {
      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => baseOnboarding,
      };
      const useCase = new InscrireEleveUseCase(
        mockRepo as EleveOnboardingRepository,
        createMockSchoolRepo(false),
        mockActivityLog,
      );

      await expect(
        useCase.execute({
          schoolId,
          onboardingId,
          validatedById: 'user-admin',
          validatorRole: 'ADMIN',
          classId: 'class-6e',
          derogationCapacite: true,
          motifDerogation: '',
        }),
      ).rejects.toThrow('Le motif de dérogation de capacité est obligatoire.');
    });

    it('refuse si le dossier n’est pas en SUBMITTED ou VALIDATED en flux standard', async () => {
      const draftOnboarding: OnboardingRecord = { ...baseOnboarding, status: 'DRAFT' };
      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => draftOnboarding,
      };
      const useCase = new InscrireEleveUseCase(
        mockRepo as EleveOnboardingRepository,
        createMockSchoolRepo(false),
        mockActivityLog,
      );

      await expect(
        useCase.execute({
          schoolId,
          onboardingId,
          validatedById: 'user-admin',
          validatorRole: 'ADMIN',
          classId: 'class-6e',
        }),
      ).rejects.toThrow('il doit d’abord être soumis pour validation (statut SUBMITTED)');
    });

    it('permet à l’admin d’inscrire directement un dossier DRAFT si adminGereInscriptions est activé', async () => {
      const draftOnboarding: OnboardingRecord = { ...baseOnboarding, status: 'DRAFT' };
      let validerCalledWith: unknown = null;

      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => draftOnboarding,
        validerOnboarding: async (input) => {
          validerCalledWith = input;
          return {
            studentProfileId: 'sp-1',
            comptesCrees: [
              {
                userId: 'u-1',
                role: 'STUDENT',
                temporaryPassword: 'pass',
                dispositifOS: 'ANDROID',
                contactEmail: 'kylian@paris.com',
                contactTelephone: '+237699000000',
                compteExistant: false,
                accessMode: 'FULL_ACCESS',
              },
            ],
          };
        },
      };

      const useCase = new InscrireEleveUseCase(
        mockRepo as EleveOnboardingRepository,
        createMockSchoolRepo(true),
        mockActivityLog,
      );

      const result = await useCase.execute({
        schoolId,
        onboardingId,
        validatedById: 'user-admin',
        validatorRole: 'ADMIN',
        classId: 'class-6e',
        derogationCapacite: true,
        motifDerogation: 'Décision du conseil d’établissement',
      });

      expect(result.studentProfileId).toBe('sp-1');
      expect(result.comptesCrees.length).toBe(1);
      expect((validerCalledWith as any).motifDerogation).toBe('Décision du conseil d’établissement');
      expect((validerCalledWith as any).derogationCapacite).toBe(true);
    });
  });

  describe('SoumettreOnboardingUseCase', () => {
    it('refuse de soumettre un dossier qui n’est ni DRAFT ni RETURNED', async () => {
      const submittedOnboarding: OnboardingRecord = { ...baseOnboarding, status: 'SUBMITTED' };
      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => submittedOnboarding,
      };

      const useCase = new SoumettreOnboardingUseCase(mockRepo as EleveOnboardingRepository);

      await expect(
        useCase.execute({
          schoolId,
          onboardingId,
          submittedById: 'secr-1',
          submitterRole: 'STAFF',
        }),
      ).rejects.toThrow('seuls les dossiers DRAFT ou RETURNED peuvent être soumis');
    });

    it('soumet avec succès un dossier RETURNED ou DRAFT', async () => {
      const returnedOnboarding: OnboardingRecord = { ...baseOnboarding, status: 'RETURNED' };
      let soumettreCalled = false;

      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => returnedOnboarding,
        soumettreOnboarding: async (_id, data) => {
          soumettreCalled = true;
          expect(data.submitterRole).toBe('STAFF');
        },
      };

      const useCase = new SoumettreOnboardingUseCase(mockRepo as EleveOnboardingRepository);

      const result = await useCase.execute({
        schoolId,
        onboardingId,
        submittedById: 'secr-1',
        submitterRole: 'STAFF',
        submittedData: { nom: 'Mbappe', prenom: 'Kylian', acteNaissanceFourni: true },
      });

      expect(soumettreCalled).toBe(true);
      expect(result.status).toBe('SUBMITTED');
    });
  });

  describe('RenvoyerOnboardingUseCase', () => {
    it('refuse si l’appelant n’est pas ADMIN', async () => {
      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => baseOnboarding,
      };
      const useCase = new RenvoyerOnboardingUseCase(mockRepo as EleveOnboardingRepository);

      await expect(
        useCase.execute({
          schoolId,
          onboardingId,
          adminId: 'staff-1',
          adminRole: 'STAFF',
          commentaire: 'Manque l’acte de naissance',
        }),
      ).rejects.toThrow('Seul l’administrateur peut renvoyer un dossier au secrétariat.');
    });

    it('refuse si le commentaire est vide', async () => {
      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => baseOnboarding,
      };
      const useCase = new RenvoyerOnboardingUseCase(mockRepo as EleveOnboardingRepository);

      await expect(
        useCase.execute({
          schoolId,
          onboardingId,
          adminId: 'admin-1',
          adminRole: 'ADMIN',
          commentaire: '   ',
        }),
      ).rejects.toThrow('Un commentaire expliquant le motif du renvoi est obligatoire.');
    });

    it('refuse si le dossier n’est pas SUBMITTED', async () => {
      const draftOnboarding: OnboardingRecord = { ...baseOnboarding, status: 'DRAFT' };
      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => draftOnboarding,
      };
      const useCase = new RenvoyerOnboardingUseCase(mockRepo as EleveOnboardingRepository);

      await expect(
        useCase.execute({
          schoolId,
          onboardingId,
          adminId: 'admin-1',
          adminRole: 'ADMIN',
          commentaire: 'Préciser la filière',
        }),
      ).rejects.toThrow('Seul un dossier soumis pour validation (statut SUBMITTED) peut être renvoyé');
    });

    it('renvoie avec succès un dossier SUBMITTED avec commentaire', async () => {
      let renvoyerCalledWith: any = null;
      const mockRepo: Partial<EleveOnboardingRepository> = {
        findOnboardingById: async () => baseOnboarding,
        renvoyerOnboarding: async (id, data) => {
          renvoyerCalledWith = { id, ...data };
        },
      };
      const useCase = new RenvoyerOnboardingUseCase(mockRepo as EleveOnboardingRepository);

      const result = await useCase.execute({
        schoolId,
        onboardingId,
        adminId: 'admin-1',
        adminRole: 'ADMIN',
        commentaire: 'Photo d’identité illisible, veuillez demander un nouveau scan.',
      });

      expect(result.status).toBe('RETURNED');
      expect(result.commentaire).toBe('Photo d’identité illisible, veuillez demander un nouveau scan.');
      expect(renvoyerCalledWith.commentaire).toBe('Photo d’identité illisible, veuillez demander un nouveau scan.');
      expect(renvoyerCalledWith.adminId).toBe('admin-1');
    });
  });
});
