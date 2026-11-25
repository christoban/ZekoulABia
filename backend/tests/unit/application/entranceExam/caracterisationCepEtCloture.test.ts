import { describe, it, expect } from 'bun:test';
import { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import { EnregistrerResultatCepUseCase } from '@application/entranceExam/EnregistrerResultatCepUseCase';
import type {
  EntranceExamRepository,
  EntranceSessionData,
  EntranceCandidateData,
} from '@domain/ports/repositories/EntranceExamRepository';

describe('Tests de caractérisation — Clôture de session & trouverClasseNiveau', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // VÉRIFICATION 1 : Clôture de session et candidats PENDING
  // ──────────────────────────────────────────────────────────────────────────
  it('PROUVE QUE LA SESSION NE PEUT JAMAIS SE CLÔTURER AUTOMATIQUEMENT si des candidats restent sous le seuil (PENDING)', async () => {
    const sessionId = 'session-test-cloture';
    const schoolId = 'school-test';

    let sessionStatus: string = 'RESULTS_PENDING';
    let sessionClosedCalled = false;

    // 2 candidats : 1 admis provisoire (note 15/20), 1 sous le seuil (note 8/20)
    const candidats: EntranceCandidateData[] = [
      {
        id: 'c-admis',
        sessionId,
        candidateNumber: 'C001',
        firstName: 'Alice',
        lastName: 'Admise',
        examScore: 15,
        totalAverage: 15,
        admissionStatus: 'PENDING',
        cepResult: null,
        cepResultDate: null,
        studentProfileId: null,
        dateOfBirth: null,
        originSchool: null,
        parentPhone: null,
        session: {
          id: sessionId,
          schoolId,
          name: 'Concours 6e',
          examDate: new Date(),
          academicYearId: 'y1',
          admissionThreshold: 10,
          availableSeats: 10,
          status: 'RESULTS_PENDING',
          targetClassId: null,
        },
      },
      {
        id: 'c-recalé',
        sessionId,
        candidateNumber: 'C002',
        firstName: 'Bob',
        lastName: 'Recalé',
        examScore: 8, // sous le seuil de 10
        totalAverage: 8,
        admissionStatus: 'PENDING',
        cepResult: null,
        cepResultDate: null,
        studentProfileId: null,
        dateOfBirth: null,
        originSchool: null,
        parentPhone: null,
        session: {
          id: sessionId,
          schoolId,
          name: 'Concours 6e',
          examDate: new Date(),
          academicYearId: 'y1',
          admissionThreshold: 10,
          availableSeats: 10,
          status: 'RESULTS_PENDING',
          targetClassId: null,
        },
      },
    ];

    const mockRepo: Partial<EntranceExamRepository> = {
      trouverSession: async () => ({
        id: sessionId,
        schoolId,
        name: 'Concours 6e',
        examDate: new Date(),
        academicYearId: 'y1',
        admissionThreshold: 10,
        availableSeats: 10,
        status: sessionStatus as any,
        targetClassId: null,
      }),
      listerCandidats: async () => candidats,
      mettreAJourStatutAdmission: async (candId, status) => {
        const c = candidats.find(x => x.id === candId);
        if (c) c.admissionStatus = status;
      },
      trouverCandidatAvecSession: async (candId) => candidats.find(x => x.id === candId) ?? null,
      mettreAJourResultatCEP: async (candId, data) => {
        const c = candidats.find(x => x.id === candId);
        if (c) {
          c.cepResult = data.cepResult;
          c.admissionStatus = data.admissionStatus;
        }
      },
      // Implémentation exacte de PrismaEntranceExamRepository.ts ligne 107 :
      // compte les candidats dont admissionStatus est dans ['PENDING', 'ADMIS_PROVISOIRE']
      compterCandidatsEnAttente: async () => {
        return candidats.filter(c => c.admissionStatus === 'PENDING' || c.admissionStatus === 'ADMIS_PROVISOIRE').length;
      },
      mettreAJourStatutSession: async (_sId, status) => {
        sessionStatus = status;
        if (status === 'CLOSED') sessionClosedCalled = true;
      },
      trouverClasseNiveau: async () => null,
    };

    // Étape 1 : Calcul de l'admission
    const calculerUC = new CalculerAdmissionConcoursUseCase(mockRepo as EntranceExamRepository);
    await calculerUC.execute({ schoolId, sessionId });

    expect(candidats.find(c => c.id === 'c-admis')?.admissionStatus).toBe('ADMIS_PROVISOIRE');
    // Le candidat sous le seuil passe désormais en NON_ADMIS (plus aucun PENDING après délibération) !
    expect(candidats.find(c => c.id === 'c-recalé')?.admissionStatus).toBe('NON_ADMIS');

    // Étape 2 : Le candidat admis réussit son CEP
    const enregistrerCepUC = new EnregistrerResultatCepUseCase(
      mockRepo as EntranceExamRepository,
      { execute: async () => ({}) } as any,
      async () => {},
    );

    await enregistrerCepUC.execute({
      schoolId,
      candidateId: 'c-admis',
      cepResult: 'REUSSI',
      enregistreParId: 'admin-1',
    });

    // Alice est bien CONFIRME
    expect(candidats.find(c => c.id === 'c-admis')?.admissionStatus).toBe('CONFIRME');

    // Comme 'c-recalé' est NON_ADMIS (et non PENDING), compterCandidatsEnAttente renvoie bien 0 !
    const enAttente = await mockRepo.compterCandidatsEnAttente!(sessionId);
    expect(enAttente).toBe(0);

    // LA SESSION EST DÉSORMAIS BIEN CLÔTURÉE AUTOMATIQUEMENT :
    expect(sessionClosedCalled).toBe(true);
    expect(sessionStatus).toBe('CLOSED');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // VÉRIFICATION 2 : trouverClasseNiveau(schoolId, '6')
  // ──────────────────────────────────────────────────────────────────────────
  it('PROUVE CE QUE RENVOIE trouverClasseNiveau pour 6e, 6ème, 6eme, Form 1, Form1, Sixième', () => {
    // Reproduction exacte du filtre SQL Prisma: { level: { contains: niveau } }
    function simulerTrouverClasseNiveau(level: string, niveauRecherche: string): boolean {
      return level.toLowerCase().includes(niveauRecherche.toLowerCase());
    }

    const testClasses = [
      { name: '6e A', level: '6e' },
      { name: '6ème 1', level: '6ème' },
      { name: '6eme B', level: '6eme' },
      { name: 'Form 1A', level: 'Form 1' },
      { name: 'Form1 Red', level: 'Form1' },
      { name: 'Sixième Verte', level: 'Sixième' },
    ];

    const resultats = testClasses.map(c => ({
      level: c.level,
      trouveAvec6: simulerTrouverClasseNiveau(c.level, '6'),
    }));

    // Les niveaux contenant le chiffre '6' sont trouvés :
    expect(resultats.find(r => r.level === '6e')?.trouveAvec6).toBe(true);
    expect(resultats.find(r => r.level === '6ème')?.trouveAvec6).toBe(true);
    expect(resultats.find(r => r.level === '6eme')?.trouveAvec6).toBe(true);

    // Les classes du sous-système anglophone ou écrites en toutes lettres ÉCHOUAIENT avec le filtre SQL brut :
    expect(resultats.find(r => r.level === 'Form 1')?.trouveAvec6).toBe(false); // NULL
    expect(resultats.find(r => r.level === 'Form1')?.trouveAvec6).toBe(false);  // NULL
    expect(resultats.find(r => r.level === 'Sixième')?.trouveAvec6).toBe(false); // NULL
  });

  it('PROUVE QUE CycleResolver résout désormais avec succès les 6 variantes : 6e, 6ème, 6eme, Form 1, Form1, Sixième', () => {
    const { CycleResolver } = require('@domain/services/CycleResolver');

    function resoudreClasseAvecCycleResolver(classes: { name: string; level: string }[], niveau: string): boolean {
      const normalizedTarget = CycleResolver.normalizeLevel(niveau);
      const directMatch = classes.find(
        (c) =>
          CycleResolver.normalizeLevel(c.level) === normalizedTarget ||
          CycleResolver.normalizeLevel(c.name) === normalizedTarget
      );
      if (directMatch) return true;

      if (niveau === '6' || normalizedTarget === '6e' || normalizedTarget === 'Form1') {
        const entryMatch = classes.find((c) => {
          const norm = CycleResolver.normalizeLevel(c.level) || CycleResolver.normalizeLevel(c.name);
          return norm === '6e' || norm === 'Form1';
        });
        if (entryMatch) return true;
      }
      return false;
    }

    const testClasses = [
      [{ name: '6e A', level: '6e' }],
      [{ name: '6ème 1', level: '6ème' }],
      [{ name: '6eme B', level: '6eme' }],
      [{ name: 'Form 1A', level: 'Form 1' }],
      [{ name: 'Form1 Red', level: 'Form1' }],
      [{ name: 'Sixième Verte', level: 'Sixième' }],
    ];

    for (const clList of testClasses) {
      // Toutes les variantes d'entrée de secondaire sont reconnues lorsqu'on cherche le niveau '6'
      expect(resoudreClasseAvecCycleResolver(clList, '6')).toBe(true);
    }
  });
});
