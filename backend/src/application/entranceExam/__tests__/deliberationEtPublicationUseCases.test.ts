import { describe, expect, it } from 'bun:test';
import { SimulerDeliberationConcoursUseCase } from '../SimulerDeliberationConcoursUseCase';
import { PublierResultatsConcoursUseCase } from '../PublierResultatsConcoursUseCase';
import { ConsulterResultatPublicUseCase } from '../ConsulterResultatPublicUseCase';
import { FinaliserAdmissionsConcoursUseCase } from '../FinaliserAdmissionsConcoursUseCase';
import type {
  EntranceExamRepository,
  EntranceSessionData,
  EntranceCandidateData,
  EntranceSubjectData,
} from '@domain/ports/repositories/EntranceExamRepository';

function createMockRepo(opts: {
  session: EntranceSessionData;
  candidats: EntranceCandidateData[];
  subjects: EntranceSubjectData[];
}): EntranceExamRepository {
  let session = { ...opts.session };
  let candidats = opts.candidats.map(c => ({ ...c }));
  const subjects = [...opts.subjects];

  return {
    async listerSessions() { return [session]; },
    async trouverSession() { return session; },
    async trouverSessionAvecDetails() { return session; },
    async creerSession() { return session; },
    async mettreAJourStatutSession(_id, status, extra) {
      session = { ...session, status, ...extra };
    },
    async compterCandidatsEnAttente() { return 0; },
    async listerMatieres() { return subjects; },
    async listerSalles() { return []; },
    async creerCandidat() { return { id: 'c', candidateNumber: 'C01' }; },
    async listerCandidats() { return candidats; },
    async trouverCandidatAvecSession(id) { return candidats.find(c => c.id === id) ?? null; },
    async trouverCandidatParCodeEtDateNaissance(_sId, code, dob) {
      return candidats.find(c =>
        c.candidateNumber === code &&
        c.dateOfBirth?.toDateString() === dob.toDateString()
      ) ?? null;
    },
    async mettreAJourScoreEtRangCandidat(id, avg, rank) {
      const c = candidats.find(cand => cand.id === id);
      if (c) {
        c.totalAverage = avg;
        c.rank = rank;
      }
    },
    async appliquerDeliberation(_sId, admissions) {
      for (const adm of admissions) {
        const c = candidats.find(cand => cand.id === adm.candidateId);
        if (c) {
          c.admissionStatus = adm.status;
          c.reservationExpiresAt = adm.reservationExpiresAt ?? null;
        }
      }
    },
    async mettreAJourStatutAdmission(id, status) {
      const c = candidats.find(cand => cand.id === id);
      if (c) c.admissionStatus = status;
    },
    async mettreAJourResultatCEP() {},
    async trouverClasseNiveau() { return { id: 'class-6e-A' }; },
  };
}

describe('SimulerDeliberationConcoursUseCase', () => {
  it('calcule la délibération et applique les admissions et réservations', async () => {
    const subjects: EntranceSubjectData[] = [
      { id: 'math', sessionId: 'sess-1', name: 'Math', coefficient: 2, maxScore: 20, eliminatoryScore: null, orderIndex: 0 },
      { id: 'fr', sessionId: 'sess-1', name: 'Français', coefficient: 1, maxScore: 20, eliminatoryScore: null, orderIndex: 1 },
    ];

    const candidats: EntranceCandidateData[] = [
      {
        id: 'c1', sessionId: 'sess-1', candidateNumber: 'EK-C001', firstName: 'Jean', lastName: 'Kamga',
        dateOfBirth: new Date('2014-05-10'), originSchool: null, examScore: 16, totalAverage: 16, rank: null,
        presenceStatus: 'PRESENT', parentPhone: '699001122', admissionStatus: 'PENDING', cepResult: null,
        cepResultDate: null, studentProfileId: null, roomId: null, deskNumber: null, reservationExpiresAt: null,
        grades: [
          { id: 'g1', candidateId: 'c1', subjectId: 'math', score: 16, isAbsent: false, subject: subjects[0] },
          { id: 'g2', candidateId: 'c1', subjectId: 'fr', score: 16, isAbsent: false, subject: subjects[1] },
        ],
      },
      {
        id: 'c2', sessionId: 'sess-1', candidateNumber: 'EK-C002', firstName: 'Paul', lastName: 'Atangana',
        dateOfBirth: new Date('2014-03-12'), originSchool: null, examScore: 12, totalAverage: 12, rank: null,
        presenceStatus: 'PRESENT', parentPhone: '677001122', admissionStatus: 'PENDING', cepResult: null,
        cepResultDate: null, studentProfileId: null, roomId: null, deskNumber: null, reservationExpiresAt: null,
        grades: [
          { id: 'g3', candidateId: 'c2', subjectId: 'math', score: 12, isAbsent: false, subject: subjects[0] },
          { id: 'g4', candidateId: 'c2', subjectId: 'fr', score: 12, isAbsent: false, subject: subjects[1] },
        ],
      },
    ];

    const session: EntranceSessionData = {
      id: 'sess-1', schoolId: 'sch-1', name: 'Concours 2026', examDate: new Date('2026-06-20'),
      academicYearId: 'yr-1', admissionThreshold: 10, availableSeats: 1, status: 'GRADING',
      targetClassId: 'class-6e-A', seatReservationDays: 14,
    };

    const repo = createMockRepo({ session, candidats, subjects });
    const useCase = new SimulerDeliberationConcoursUseCase(repo);

    const res = await useCase.execute({
      schoolId: 'sch-1',
      sessionId: 'sess-1',
      availableSeats: 1,
      admissionThreshold: 10,
      waitingListSeats: 1,
      appliquer: true,
    });

    expect(res.applied).toBe(true);
    expect(res.outcome.admisCount).toBe(1);
    expect(res.outcome.admisIds).toEqual(['c1']);
    expect(res.outcome.listeAttenteIds).toEqual(['c2']);

    const c1MisAJour = await repo.trouverCandidatAvecSession('c1');
    expect(c1MisAJour?.admissionStatus).toBe('ADMIS');
    expect(c1MisAJour?.reservationExpiresAt).not.toBeNull();

    const c2MisAJour = await repo.trouverCandidatAvecSession('c2');
    expect(c2MisAJour?.admissionStatus).toBe('LISTE_ATTENTE');
  });
});

describe('ConsulterResultatPublicUseCase', () => {
  it('permet la consultation individuelle quand la session est publiée', async () => {
    const session: EntranceSessionData = {
      id: 'sess-pub', schoolId: 'sch-1', name: 'Concours 2026', examDate: new Date('2026-06-20'),
      academicYearId: 'yr-1', admissionThreshold: 10, availableSeats: 50, status: 'PUBLISHED',
      targetClassId: null,
    };

    const c1: EntranceCandidateData = {
      id: 'cand-pub-1', sessionId: 'sess-pub', candidateNumber: 'EK-C042', firstName: 'Alice', lastName: 'Ngo',
      dateOfBirth: new Date('2014-08-20'), originSchool: null, examScore: 15.5, totalAverage: 15.5, rank: 3,
      presenceStatus: 'PRESENT', parentPhone: null, admissionStatus: 'ADMIS', cepResult: null,
      cepResultDate: null, studentProfileId: null, roomId: null, deskNumber: null, reservationExpiresAt: new Date('2026-07-15'),
      grades: [],
    };

    const repo = createMockRepo({ session, candidats: [c1], subjects: [] });
    const useCase = new ConsulterResultatPublicUseCase(repo);

    const res = await useCase.execute({
      sessionId: 'sess-pub',
      candidateNumber: 'EK-C042',
      dateOfBirth: new Date('2014-08-20'),
    });

    expect(res.candidateNumber).toBe('EK-C042');
    expect(res.admissionStatus).toBe('ADMIS');
    expect(res.rank).toBe(3);
    expect(res.message).toContain('Félicitations');
  });

  it('rejette la consultation si la session n est pas encore publiée', async () => {
    const session: EntranceSessionData = {
      id: 'sess-draft', schoolId: 'sch-1', name: 'Concours', examDate: new Date(),
      academicYearId: 'yr-1', admissionThreshold: 10, availableSeats: 10, status: 'DELIBERATION',
      targetClassId: null,
    };

    const repo = createMockRepo({ session, candidats: [], subjects: [] });
    const useCase = new ConsulterResultatPublicUseCase(repo);

    await expect(
      useCase.execute({ sessionId: 'sess-draft', candidateNumber: 'X', dateOfBirth: new Date() })
    ).rejects.toThrow('pas encore publiés');
  });
});

describe('FinaliserAdmissionsConcoursUseCase', () => {
  it('crée les dossiers onboarding et bascule les admis en INSCRIT', async () => {
    const session: EntranceSessionData = {
      id: 'sess-1', schoolId: 'sch-1', name: 'Concours', examDate: new Date(),
      academicYearId: 'yr-1', admissionThreshold: 10, availableSeats: 10, status: 'PUBLISHED',
      targetClassId: 'class-6e', seatReservationDays: 14,
    };

    const candidats: EntranceCandidateData[] = [
      {
        id: 'c-admis', sessionId: 'sess-1', candidateNumber: 'EK-C010', firstName: 'Marc', lastName: 'Fouda',
        dateOfBirth: new Date('2014-01-01'), originSchool: null, examScore: 14, totalAverage: 14, rank: 1,
        presenceStatus: 'PRESENT', parentPhone: '699112233', admissionStatus: 'ADMIS', cepResult: null,
        cepResultDate: null, studentProfileId: null, roomId: null, deskNumber: null, reservationExpiresAt: null,
      },
    ];

    const repo = createMockRepo({ session, candidats, subjects: [] });
    let creeCallCount = 0;
    const mockCreerSquelette = {
      execute: async () => {
        creeCallCount++;
        return { id: 'onb-1', token: 'tok-123', tokenExpiresAt: new Date(), contactEmail: null, contactTelephone: '699112233' };
      },
    };

    const useCase = new FinaliserAdmissionsConcoursUseCase(repo, mockCreerSquelette as any);
    const res = await useCase.execute({
      schoolId: 'sch-1',
      sessionId: 'sess-1',
      executantId: 'usr-admin',
    });

    expect(res.totalAdmisTraites).toBe(1);
    expect(res.dossiersCrees).toBe(1);
    expect(creeCallCount).toBe(1);

    const cMisAJour = await repo.trouverCandidatAvecSession('c-admis');
    expect(cMisAJour?.admissionStatus).toBe('INSCRIT');
  });
});
