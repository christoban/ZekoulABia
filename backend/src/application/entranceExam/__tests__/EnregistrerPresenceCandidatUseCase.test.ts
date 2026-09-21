import { describe, expect, it } from 'bun:test';
import { EnregistrerPresenceCandidatUseCase } from '../EnregistrerPresenceCandidatUseCase';
import type {
  EntranceExamRepository,
  EntranceSessionData,
  EntranceCandidateData,
  CandidatePresence,
} from '@domain/ports/repositories/EntranceExamRepository';

function createMockEntranceRepo(initialData?: {
  session?: EntranceSessionData;
  candidats?: EntranceCandidateData[];
}): EntranceExamRepository {
  const session = initialData?.session ?? {
    id: 'sess-1',
    schoolId: 'sch-1',
    name: 'Concours Entrée 6e 2026',
    examDate: new Date('2026-06-20'),
    academicYearId: 'year-1',
    admissionThreshold: 10,
    availableSeats: 50,
    status: 'IN_PROGRESS',
    registrationDeadline: null,
    requireCepForAdmission: false,
    seatReservationDays: 14,
    deliberatedAt: null,
    publishedAt: null,
    targetClassId: null,
  };

  const candidats: EntranceCandidateData[] = initialData?.candidats ? [...initialData.candidats] : [];

  return {
    async listerSessions() { return [session]; },
    async trouverSession(sessionId: string) { return session.id === sessionId ? session : null; },
    async creerSession() { return session; },
    async mettreAJourStatutSession() {},
    async compterCandidatsEnAttente() { return 0; },
    async creerCandidat() { return { id: 'c1', candidateNumber: 'C001' }; },
    async listerCandidats() { return candidats; },
    async trouverCandidatAvecSession(candidateId: string) {
      return candidats.find(c => c.id === candidateId) ?? null;
    },
    async enregistrerPresenceCandidat(candidateId: string, presenceStatus: CandidatePresence) {
      const c = candidats.find(cand => cand.id === candidateId);
      if (c) {
        c.presenceStatus = presenceStatus;
      }
    },
    async mettreAJourResultatCEP() {},
    async mettreAJourStatutAdmission() {},
    async trouverClasseNiveau() { return null; },
  };
}

describe('EnregistrerPresenceCandidatUseCase (Jour J - Offline & Online)', () => {
  const candidatInitial: EntranceCandidateData = {
    id: 'cand-1',
    sessionId: 'sess-1',
    candidateNumber: 'C001',
    firstName: 'Paul',
    lastName: 'Biya',
    dateOfBirth: new Date('2013-02-13'),
    originSchool: 'EP Bastos',
    examScore: null,
    totalAverage: null,
    rank: null,
    presenceStatus: 'PRESENT',
    parentPhone: '699001122',
    admissionStatus: 'PENDING',
    cepResult: null,
    cepResultDate: null,
    studentProfileId: null,
    roomId: 'room-1',
    deskNumber: 5,
    reservationExpiresAt: null,
  };

  it('enregistre l\'absence d\'un candidat avec succès', async () => {
    const repo = createMockEntranceRepo({ candidats: [{ ...candidatInitial }] });
    const useCase = new EnregistrerPresenceCandidatUseCase(repo);

    const res = await useCase.execute({
      schoolId: 'sch-1',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      presenceStatus: 'ABSENT',
    });

    expect(res.success).toBe(true);
    expect(res.candidateId).toBe('cand-1');
    expect(res.presenceStatus).toBe('ABSENT');

    const updated = await repo.trouverCandidatAvecSession('cand-1');
    expect(updated?.presenceStatus).toBe('ABSENT');
  });

  it('enregistre l\'abandon d\'un candidat en cours d\'épreuve', async () => {
    const repo = createMockEntranceRepo({ candidats: [{ ...candidatInitial }] });
    const useCase = new EnregistrerPresenceCandidatUseCase(repo);

    const res = await useCase.execute({
      schoolId: 'sch-1',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      presenceStatus: 'ABANDON',
    });

    expect(res.success).toBe(true);
    expect(res.presenceStatus).toBe('ABANDON');
  });

  it('rejette si la session appartient à un autre établissement', async () => {
    const repo = createMockEntranceRepo({ candidats: [{ ...candidatInitial }] });
    const useCase = new EnregistrerPresenceCandidatUseCase(repo);

    expect(useCase.execute({
      schoolId: 'autre-ecole',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      presenceStatus: 'PRESENT',
    })).rejects.toThrow('Session de concours introuvable ou non autorisée');
  });

  it('rejette si le candidat n\'appartient pas à la session', async () => {
    const repo = createMockEntranceRepo({ candidats: [{ ...candidatInitial, sessionId: 'autre-sess' }] });
    const useCase = new EnregistrerPresenceCandidatUseCase(repo);

    expect(useCase.execute({
      schoolId: 'sch-1',
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      presenceStatus: 'PRESENT',
    })).rejects.toThrow('Candidat introuvable dans cette session de concours');
  });
});
