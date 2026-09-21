import { describe, expect, it } from 'bun:test';
import { InscrireCandidatConcoursUseCase } from '../InscrireCandidatConcoursUseCase';
import { RepartirCandidatsSallesUseCase } from '../RepartirCandidatsSallesUseCase';
import type {
  EntranceExamRepository,
  EntranceSessionData,
  EntranceCandidateData,
  EntranceRoomData,
} from '@domain/ports/repositories/EntranceExamRepository';

function createMockEntranceRepo(initialData?: {
  session?: EntranceSessionData;
  candidats?: EntranceCandidateData[];
  salles?: EntranceRoomData[];
}): EntranceExamRepository {
  let session = initialData?.session ?? {
    id: 'sess-1',
    schoolId: 'sch-1',
    name: 'Concours Entrée 6e 2026',
    examDate: new Date('2026-06-20'),
    academicYearId: 'year-1',
    admissionThreshold: 10,
    availableSeats: 50,
    status: 'REGISTRATION_OPEN',
    registrationDeadline: null,
    requireCepForAdmission: false,
    seatReservationDays: 14,
    deliberatedAt: null,
    publishedAt: null,
    targetClassId: null,
  };

  const candidats: EntranceCandidateData[] = initialData?.candidats ? [...initialData.candidats] : [];
  const salles: EntranceRoomData[] = initialData?.salles ? [...initialData.salles] : [];

  return {
    async listerSessions() { return [session]; },
    async trouverSession() { return session; },
    async trouverSessionAvecDetails() { return session; },
    async creerSession() { return session; },
    async mettreAJourStatutSession(_id, status) { session = { ...session, status }; },
    async compterCandidatsEnAttente() { return 0; },
    async compterCandidatsSession() { return candidats.length; },
    async listerMatieres() { return []; },
    async configurerMatieres() { return []; },
    async listerSalles() { return salles; },
    async creerSalle(_sId, name, cap) {
      const s = { id: `room-${salles.length + 1}`, sessionId: 'sess-1', name, capacity: cap };
      salles.push(s);
      return s;
    },
    async supprimerSalle(rId) {
      const idx = salles.findIndex(s => s.id === rId);
      if (idx !== -1) salles.splice(idx, 1);
    },
    async assignerSallePlace(candId, roomId, deskNumber) {
      const c = candidats.find(cand => cand.id === candId);
      if (c) {
        c.roomId = roomId;
        c.deskNumber = deskNumber;
      }
    },
    async creerCandidat(data) {
      const c: EntranceCandidateData = {
        id: `cand-${candidats.length + 1}`,
        sessionId: data.sessionId,
        candidateNumber: data.candidateNumber ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ?? null,
        originSchool: data.originSchool ?? null,
        examScore: null,
        totalAverage: null,
        rank: null,
        presenceStatus: 'PRESENT',
        parentPhone: data.parentPhone ?? null,
        admissionStatus: 'PENDING',
        cepResult: 'NON_PASSE',
        cepResultDate: null,
        studentProfileId: null,
        roomId: null,
        deskNumber: null,
        reservationExpiresAt: null,
      };
      candidats.push(c);
      return { id: c.id, candidateNumber: c.candidateNumber };
    },
    async trouverDernierNumeroSequence() { return candidats.length; },
    async listerCandidats() { return candidats; },
    async trouverCandidatAvecSession(id) { return candidats.find(c => c.id === id) ?? null; },
    async trouverCandidatParCodeEtDateNaissance(_sId, code) {
      return candidats.find(c => c.candidateNumber === code) ?? null;
    },
    async sauvegarderNotesCandidat() {},
    async mettreAJourScoreEtRangCandidat() {},
    async appliquerDeliberation() {},
    async mettreAJourResultatCEP() {},
    async mettreAJourStatutAdmission() {},
    async trouverClasseNiveau() { return null; },
  };
}

describe('InscrireCandidatConcoursUseCase', () => {
  it('inscrit un candidat avec un code anonymisé généré automatiquement', async () => {
    const repo = createMockEntranceRepo();
    const useCase = new InscrireCandidatConcoursUseCase(repo);

    const res = await useCase.execute({
      schoolId: 'sch-1',
      sessionId: 'sess-1',
      firstName: 'Jean',
      lastName: 'Kamga',
      schoolCodeOrName: 'EK',
    });

    expect(res.candidateId).toBeDefined();
    expect(res.candidateNumber).toBe('EK-C001');
    expect(res.lastName).toBe('Kamga');
  });

  it('rejette les doublons sur nom, prénom et date de naissance', async () => {
    const repo = createMockEntranceRepo();
    const useCase = new InscrireCandidatConcoursUseCase(repo);

    await useCase.execute({
      schoolId: 'sch-1',
      sessionId: 'sess-1',
      firstName: 'Paul',
      lastName: 'Biya',
      dateOfBirth: new Date('2014-02-13'),
    });

    await expect(
      useCase.execute({
        schoolId: 'sch-1',
        sessionId: 'sess-1',
        firstName: 'Paul',
        lastName: 'Biya',
        dateOfBirth: new Date('2014-02-13'),
      })
    ).rejects.toThrow('déjà inscrit');
  });
});

describe('RepartirCandidatsSallesUseCase', () => {
  it('répartit correctement les candidats dans les salles avec numéros de table', async () => {
    const candidats: EntranceCandidateData[] = [
      { id: 'c1', sessionId: 'sess-1', candidateNumber: 'C001', firstName: 'Alice', lastName: 'Zra', dateOfBirth: null, originSchool: null, examScore: null, totalAverage: null, rank: null, presenceStatus: 'PRESENT', parentPhone: null, admissionStatus: 'PENDING', cepResult: null, cepResultDate: null, studentProfileId: null, roomId: null, deskNumber: null, reservationExpiresAt: null },
      { id: 'c2', sessionId: 'sess-1', candidateNumber: 'C002', firstName: 'Bob', lastName: 'Abena', dateOfBirth: null, originSchool: null, examScore: null, totalAverage: null, rank: null, presenceStatus: 'PRESENT', parentPhone: null, admissionStatus: 'PENDING', cepResult: null, cepResultDate: null, studentProfileId: null, roomId: null, deskNumber: null, reservationExpiresAt: null },
      { id: 'c3', sessionId: 'sess-1', candidateNumber: 'C003', firstName: 'Chantal', lastName: 'Mbia', dateOfBirth: null, originSchool: null, examScore: null, totalAverage: null, rank: null, presenceStatus: 'PRESENT', parentPhone: null, admissionStatus: 'PENDING', cepResult: null, cepResultDate: null, studentProfileId: null, roomId: null, deskNumber: null, reservationExpiresAt: null },
    ];

    const salles: EntranceRoomData[] = [
      { id: 'salle-A', sessionId: 'sess-1', name: 'Salle A', capacity: 2 },
      { id: 'salle-B', sessionId: 'sess-1', name: 'Salle B', capacity: 2 },
    ];

    const repo = createMockEntranceRepo({ candidats, salles });
    const useCase = new RepartirCandidatsSallesUseCase(repo);

    const res = await useCase.execute({
      schoolId: 'sch-1',
      sessionId: 'sess-1',
      mode: 'ALPHABETIQUE',
    });

    expect(res.totalCandidats).toBe(3);
    expect(res.salles[0].candidatsAssignes).toBe(2);
    expect(res.salles[1].candidatsAssignes).toBe(1);

    // Par ordre alphabétique : Abena (c2) puis Mbia (c3) vont dans salle A, Zra (c1) dans salle B
    expect(candidats.find(c => c.id === 'c2')?.roomId).toBe('salle-A');
    expect(candidats.find(c => c.id === 'c2')?.deskNumber).toBe(1);

    expect(candidats.find(c => c.id === 'c3')?.roomId).toBe('salle-A');
    expect(candidats.find(c => c.id === 'c3')?.deskNumber).toBe(2);

    expect(candidats.find(c => c.id === 'c1')?.roomId).toBe('salle-B');
    expect(candidats.find(c => c.id === 'c1')?.deskNumber).toBe(1);
  });

  it('lève une erreur si la capacité totale des salles est insuffisante', async () => {
    const candidats: EntranceCandidateData[] = [
      { id: 'c1', sessionId: 'sess-1', candidateNumber: 'C001', firstName: 'A', lastName: 'B', dateOfBirth: null, originSchool: null, examScore: null, totalAverage: null, rank: null, presenceStatus: 'PRESENT', parentPhone: null, admissionStatus: 'PENDING', cepResult: null, cepResultDate: null, studentProfileId: null, roomId: null, deskNumber: null, reservationExpiresAt: null },
      { id: 'c2', sessionId: 'sess-1', candidateNumber: 'C002', firstName: 'C', lastName: 'D', dateOfBirth: null, originSchool: null, examScore: null, totalAverage: null, rank: null, presenceStatus: 'PRESENT', parentPhone: null, admissionStatus: 'PENDING', cepResult: null, cepResultDate: null, studentProfileId: null, roomId: null, deskNumber: null, reservationExpiresAt: null },
    ];
    const salles: EntranceRoomData[] = [
      { id: 'salle-petite', sessionId: 'sess-1', name: 'Salle Petite', capacity: 1 },
    ];

    const repo = createMockEntranceRepo({ candidats, salles });
    const useCase = new RepartirCandidatsSallesUseCase(repo);

    await expect(
      useCase.execute({ schoolId: 'sch-1', sessionId: 'sess-1' })
    ).rejects.toThrow('Capacité insuffisante');
  });
});
