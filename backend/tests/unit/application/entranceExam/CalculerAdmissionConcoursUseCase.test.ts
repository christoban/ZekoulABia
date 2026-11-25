/**
 * Tests unitaires — CalculerAdmissionConcoursUseCase
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import type { EntranceExamRepository, EntranceSessionData, EntranceCandidateData } from '@domain/ports/repositories/EntranceExamRepository';

function createStubRepo(overrides: Partial<EntranceExamRepository> = {}): EntranceExamRepository {
  return {
    listerSessions: async () => [],
    trouverSession: async () => null,
    creerSession: async () => { throw new Error('not implemented'); },
    mettreAJourStatutSession: async () => {},
    compterCandidatsEnAttente: async () => 0,
    creerCandidat: async () => { throw new Error('not implemented'); },
    listerCandidats: async () => [],
    trouverCandidatAvecSession: async () => null,
    mettreAJourResultatCEP: async () => {},
    mettreAJourStatutAdmission: async () => {},
    trouverClasseNiveau: async () => null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<EntranceSessionData> = {}): EntranceSessionData {
  return {
    id: 'session-1',
    schoolId: 'school-1',
    name: 'Concours 2026',
    examDate: new Date('2026-06-01'),
    academicYearId: 'year-1',
    admissionThreshold: 10,
    availableSeats: null,
    status: 'RESULTS_PENDING',
    targetClassId: null,
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<EntranceCandidateData> = {}): EntranceCandidateData {
  return {
    id: 'cand-1',
    sessionId: 'session-1',
    firstName: 'Alice',
    lastName: 'Ngo',
    dateOfBirth: null,
    originSchool: null,
    examScore: 14,
    parentPhone: '699000000',
    admissionStatus: 'PENDING',
    cepResult: null,
    cepResultDate: null,
    studentProfileId: null,
    ...overrides,
  };
}

let useCase: CalculerAdmissionConcoursUseCase;

describe('CalculerAdmissionConcoursUseCase', () => {
  describe('Gates', () => {
    it('rejette si la session est introuvable', async () => {
      useCase = new CalculerAdmissionConcoursUseCase(createStubRepo());
      await expect(
        useCase.execute({ schoolId: 'school-1', sessionId: 'missing' })
      ).rejects.toThrow('Session de concours introuvable');
    });

    it('rejette si le schoolId ne correspond pas', async () => {
      useCase = new CalculerAdmissionConcoursUseCase(createStubRepo({
        trouverSession: async () => makeSession({ schoolId: 'school-1' }),
      }));
      await expect(
        useCase.execute({ schoolId: 'school-wrong', sessionId: 'session-1' })
      ).rejects.toThrow('Accès refusé');
    });

    it('rejette si aucun candidat avec une note', async () => {
      useCase = new CalculerAdmissionConcoursUseCase(createStubRepo({
        trouverSession: async () => makeSession(),
        listerCandidats: async () => [],
      }));
      await expect(
        useCase.execute({ schoolId: 'school-1', sessionId: 'session-1' })
      ).rejects.toThrow('Aucun candidat avec une note à traiter');
    });
  });

  describe('Calcul avec seuil', () => {
    it('admet les candidats au-dessus du seuil et rejette les autres', async () => {
      const updates: { id: string; status: string }[] = [];
      useCase = new CalculerAdmissionConcoursUseCase(createStubRepo({
        trouverSession: async () => makeSession({ admissionThreshold: 10, availableSeats: null }),
        listerCandidats: async () => [
          makeCandidate({ id: 'c1', examScore: 14 }),
          makeCandidate({ id: 'c2', examScore: 8 }),
          makeCandidate({ id: 'c3', examScore: 10 }),
        ],
        mettreAJourStatutAdmission: async (id, status) => { updates.push({ id, status }); },
      }));

      const r = await useCase.execute({ schoolId: 'school-1', sessionId: 'session-1' });

      expect(r.admis).toBe(2);
      expect(r.nonAdmis).toBe(1);
      expect(r.admisCandidats).toHaveLength(2);
      expect(r.admisCandidats.map(c => c.id)).toEqual(expect.arrayContaining(['c1', 'c3']));
      expect(updates).toEqual([
        { id: 'c1', status: 'ADMIS_PROVISOIRE' },
        { id: 'c2', status: 'NON_ADMIS' },
        { id: 'c3', status: 'ADMIS_PROVISOIRE' },
      ]);
    });

    it('admet tous si pas de seuil (threshold null)', async () => {
      useCase = new CalculerAdmissionConcoursUseCase(createStubRepo({
        trouverSession: async () => makeSession({ admissionThreshold: null }),
        listerCandidats: async () => [
          makeCandidate({ id: 'c1', examScore: 5 }),
          makeCandidate({ id: 'c2', examScore: 0 }),
        ],
        mettreAJourStatutAdmission: async () => {},
      }));

      const r = await useCase.execute({ schoolId: 'school-1', sessionId: 'session-1' });
      expect(r.admis).toBe(2);
      expect(r.nonAdmis).toBe(0);
    });
  });

  describe('Calcul avec nombre de places limité', () => {
    it('n\'admet que les places disponibles', async () => {
      useCase = new CalculerAdmissionConcoursUseCase(createStubRepo({
        trouverSession: async () => makeSession({ admissionThreshold: null, availableSeats: 2 }),
        listerCandidats: async () => [
          makeCandidate({ id: 'c1', firstName: 'A', lastName: 'A', examScore: 15 }),
          makeCandidate({ id: 'c2', firstName: 'B', lastName: 'B', examScore: 14 }),
          makeCandidate({ id: 'c3', firstName: 'C', lastName: 'C', examScore: 13 }),
        ],
        mettreAJourStatutAdmission: async () => {},
      }));

      const r = await useCase.execute({ schoolId: 'school-1', sessionId: 'session-1' });
      expect(r.admis).toBe(2);
      expect(r.nonAdmis).toBe(1);
      expect(r.admisCandidats).toHaveLength(2);
    });
  });

  describe('Cas nominal — retour', () => {
    it('retourne les infos des candidats admis', async () => {
      useCase = new CalculerAdmissionConcoursUseCase(createStubRepo({
        trouverSession: async () => makeSession({ admissionThreshold: 10 }),
        listerCandidats: async () => [
          makeCandidate({ id: 'c1', firstName: 'Alice', lastName: 'Ngo', examScore: 15, parentPhone: '699111222' }),
        ],
        mettreAJourStatutAdmission: async () => {},
      }));

      const r = await useCase.execute({ schoolId: 'school-1', sessionId: 'session-1' });
      expect(r.admisCandidats[0]).toEqual({
        id: 'c1',
        firstName: 'Alice',
        lastName: 'Ngo',
        parentPhone: '699111222',
      });
    });
  });
});
