/**
 * Tests de caractérisation — EnregistrerResultatCepUseCase
 */
import { describe, it, expect } from 'bun:test';
import { EnregistrerResultatCepUseCase } from '@application/entranceExam/EnregistrerResultatCepUseCase';
import type { EntranceExamRepository, EntranceCandidateData } from '@domain/ports/repositories/EntranceExamRepository';
import type { CreerSqueletteOnboardingUseCase } from '@application/eleveOnboarding/CreerSqueletteOnboardingUseCase';

const SCHOOL_ID = 'school-1';
const CANDIDATE_ID = 'cand-1';

function createCandidate(overrides: Partial<EntranceCandidateData> = {}): EntranceCandidateData {
  return {
    id: CANDIDATE_ID,
    sessionId: 'session-1',
    firstName: 'Paul',
    lastName: 'Biya',
    dateOfBirth: null,
    originSchool: null,
    examScore: 15,
    parentPhone: '+237699000111',
    admissionStatus: 'ADMIS_PROVISOIRE',
    cepResult: null,
    cepResultDate: null,
    studentProfileId: null,
    session: {
      id: 'session-1',
      schoolId: SCHOOL_ID,
      name: 'Concours 6e 2026',
      examDate: new Date('2026-06-01'),
      academicYearId: 'year-1',
      admissionThreshold: 10,
      availableSeats: null,
      status: 'RESULTS_PENDING',
      targetClassId: 'classe-6e-1',
    },
    ...overrides,
  };
}

describe('EnregistrerResultatCepUseCase', () => {
  it('rejette si le candidat est introuvable', async () => {
    const entranceRepo = {
      trouverCandidatAvecSession: async () => null,
      mettreAJourResultatCEP: async () => {},
      trouverClasseNiveau: async () => null,
    } as unknown as EntranceExamRepository;

    const useCase = new EnregistrerResultatCepUseCase(
      entranceRepo,
      {} as CreerSqueletteOnboardingUseCase,
      async () => {},
    );

    expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        candidateId: CANDIDATE_ID,
        enregistreParId: 'user-validator-1',
        cepResult: 'REUSSI',
      }),
    ).rejects.toThrow('Candidat introuvable');
  });

  it('rejette si le schoolId ne correspond pas à la session', async () => {
    const entranceRepo = {
      trouverCandidatAvecSession: async () => createCandidate(),
      mettreAJourResultatCEP: async () => {},
      trouverClasseNiveau: async () => null,
    } as unknown as EntranceExamRepository;

    const useCase = new EnregistrerResultatCepUseCase(
      entranceRepo,
      {} as CreerSqueletteOnboardingUseCase,
      async () => {},
    );

    expect(
      useCase.execute({
        schoolId: 'other-school',
        candidateId: CANDIDATE_ID,
        enregistreParId: 'user-validator-1',
        cepResult: 'REUSSI',
      }),
    ).rejects.toThrow('Accès refusé');
  });

  it('rejette si le statut d’admission n’est pas ADMIS_PROVISOIRE', async () => {
    const entranceRepo = {
      trouverCandidatAvecSession: async () => createCandidate({ admissionStatus: 'PENDING' }),
      mettreAJourResultatCEP: async () => {},
      trouverClasseNiveau: async () => null,
    } as unknown as EntranceExamRepository;

    const useCase = new EnregistrerResultatCepUseCase(
      entranceRepo,
      {} as CreerSqueletteOnboardingUseCase,
      async () => {},
    );

    expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        candidateId: CANDIDATE_ID,
        enregistreParId: 'user-validator-1',
        cepResult: 'REUSSI',
      }),
    ).rejects.toThrow('Seuls les candidats ADMIS_PROVISOIRE peuvent recevoir un résultat CEP');
  });

  it('confirme l’admission et crée un squelette onboarding quand le CEP est REUSSI', async () => {
    let resultatMisAJour: any = null;
    let squeletteAppeleAvec: any = null;
    let notificationEnvoyee = false;

    const entranceRepo = {
      trouverCandidatAvecSession: async () => createCandidate(),
      mettreAJourResultatCEP: async (_id: string, data: any) => {
        resultatMisAJour = data;
      },
      compterCandidatsEnAttente: async () => 0,
      mettreAJourStatutSession: async () => {},
      trouverClasseNiveau: async () => null,
    } as unknown as EntranceExamRepository;

    const fakeSqueletteUC = {
      execute: async (cmd: any) => {
        squeletteAppeleAvec = cmd;
        return {
          onboarding: {
            id: 'onb-1',
            token: 'tok-123',
            tokenExpiresAt: new Date(Date.now() + 86400000),
            contactEmail: null,
            contactTelephone: '+237699000111',
          },
        };
      },
    } as unknown as CreerSqueletteOnboardingUseCase;

    const fakeNotifier = async () => {
      notificationEnvoyee = true;
    };

    const useCase = new EnregistrerResultatCepUseCase(
      entranceRepo,
      fakeSqueletteUC,
      fakeNotifier,
    );

    const result = await useCase.execute({
      schoolId: SCHOOL_ID,
      candidateId: CANDIDATE_ID,
      enregistreParId: 'user-validator-1',
      cepResult: 'REUSSI',
    });

    expect(result.status).toBe('CONFIRME');
    expect(result.onboardingCreated).toBe(true);
    expect(result.parentPhone).toBe('+237699000111');
    expect(resultatMisAJour).toEqual({
      cepResult: 'REUSSI',
      admissionStatus: 'CONFIRME',
    });
    expect(squeletteAppeleAvec.classId).toBe('classe-6e-1');
    expect(squeletteAppeleAvec.recipientType).toBe('PARENT');
    expect(squeletteAppeleAvec.sourceType).toBe('CONCOURS');
    expect(notificationEnvoyee).toBe(true);
  });

  it('refuse définitivement le candidat quand le CEP est ECHOUE', async () => {
    let resultatMisAJour: any = null;

    const entranceRepo = {
      trouverCandidatAvecSession: async () => createCandidate(),
      mettreAJourResultatCEP: async (_id: string, data: any) => {
        resultatMisAJour = data;
      },
      compterCandidatsEnAttente: async () => 0,
      mettreAJourStatutSession: async () => {},
      trouverClasseNiveau: async () => null,
    } as unknown as EntranceExamRepository;

    const useCase = new EnregistrerResultatCepUseCase(
      entranceRepo,
      {} as CreerSqueletteOnboardingUseCase,
      async () => {},
    );

    const result = await useCase.execute({
      schoolId: SCHOOL_ID,
      candidateId: CANDIDATE_ID,
      enregistreParId: 'user-validator-1',
      cepResult: 'ECHOUE',
    });

    expect(result.status).toBe('ANNULE');
    expect(result.onboardingCreated).toBe(false);
    expect(resultatMisAJour).toEqual({
      cepResult: 'ECHOUE',
      admissionStatus: 'ANNULE',
    });
  });
});
