import { describe, expect, it } from 'bun:test';
import {
  EntranceExamScoringEngine,
  type SubjectConfig,
  type CandidateEvaluationInput,
} from '../EntranceExamScoringEngine';

describe('EntranceExamScoringEngine', () => {
  const subjects: SubjectConfig[] = [
    { id: 'sub-math', name: 'Mathématiques', coefficient: 3, maxScore: 20, eliminatoryScore: 5 },
    { id: 'sub-fr', name: 'Dictée & Questions', coefficient: 2, maxScore: 20, eliminatoryScore: 5 },
    { id: 'sub-ang', name: 'Anglais', coefficient: 1, maxScore: 20 },
  ];

  it('calcule la moyenne pondérée avec exactitude', () => {
    const candidat: CandidateEvaluationInput = {
      candidateId: 'cand-1',
      dateOfBirth: new Date('2014-05-10'),
      grades: [
        { subjectId: 'sub-math', score: 14 }, // 14 * 3 = 42
        { subjectId: 'sub-fr', score: 12 },   // 12 * 2 = 24
        { subjectId: 'sub-ang', score: 16 },  // 16 * 1 = 16
        // Total points = 82 / 6 = 13.67
      ],
    };

    const res = EntranceExamScoringEngine.evaluerCandidat(candidat, subjects);
    expect(res.isComplete).toBe(true);
    expect(res.isEliminated).toBe(false);
    expect(res.totalAverage).toBe(13.67);
  });

  it('élimine un candidat ayant une note inférieure au seuil éliminatoire', () => {
    const candidat: CandidateEvaluationInput = {
      candidateId: 'cand-2',
      grades: [
        { subjectId: 'sub-math', score: 4.5 }, // éliminatoire (< 5)
        { subjectId: 'sub-fr', score: 18 },
        { subjectId: 'sub-ang', score: 18 },
      ],
    };

    const res = EntranceExamScoringEngine.evaluerCandidat(candidat, subjects);
    expect(res.isEliminated).toBe(true);
    expect(res.eliminationReason).toContain('Mathématiques');
  });

  it('traite une absence comme note 0 et élimine si l épreuve a un seuil éliminatoire', () => {
    const candidat: CandidateEvaluationInput = {
      candidateId: 'cand-absent',
      grades: [
        { subjectId: 'sub-math', isAbsent: true },
        { subjectId: 'sub-fr', score: 15 },
        { subjectId: 'sub-ang', score: 15 },
      ],
    };

    const res = EntranceExamScoringEngine.evaluerCandidat(candidat, subjects);
    expect(res.isEliminated).toBe(true);
    expect(res.subjectResults.find(s => s.subjectId === 'sub-math')?.isAbsent).toBe(true);
  });

  it('classe les candidats avec départage par fort coefficient puis par âge', () => {
    const c1 = EntranceExamScoringEngine.evaluerCandidat(
      {
        candidateId: 'c1-fort-math',
        dateOfBirth: new Date('2014-01-01'),
        grades: [
          { subjectId: 'sub-math', score: 15 },
          { subjectId: 'sub-fr', score: 10 },
          { subjectId: 'sub-ang', score: 10 },
        ], // Total = 45 + 20 + 10 = 75 / 6 = 12.50
      },
      subjects
    );

    const c2 = EntranceExamScoringEngine.evaluerCandidat(
      {
        candidateId: 'c2-faible-math',
        dateOfBirth: new Date('2014-01-01'),
        grades: [
          { subjectId: 'sub-math', score: 11 },
          { subjectId: 'sub-fr', score: 15 },
          { subjectId: 'sub-ang', score: 12 },
        ], // Total = 33 + 30 + 12 = 75 / 6 = 12.50
      },
      subjects
    );

    const c3 = EntranceExamScoringEngine.evaluerCandidat(
      {
        candidateId: 'c3-tres-fort',
        dateOfBirth: new Date('2014-03-01'),
        grades: [
          { subjectId: 'sub-math', score: 18 },
          { subjectId: 'sub-fr', score: 17 },
          { subjectId: 'sub-ang', score: 16 },
        ], // Total = 54 + 34 + 16 = 104 / 6 = 17.33
      },
      subjects
    );

    const ranked = EntranceExamScoringEngine.classerCandidats([c1, c2, c3], subjects);

    expect(ranked[0].candidateId).toBe('c3-tres-fort');
    expect(ranked[0].rank).toBe(1);

    // c1 et c2 ont la même moyenne (12.50), mais c1 a 15 en Math (coef 3) contre 11 pour c2
    expect(ranked[1].candidateId).toBe('c1-fort-math');
    expect(ranked[1].rank).toBe(2);

    expect(ranked[2].candidateId).toBe('c2-faible-math');
    expect(ranked[2].rank).toBe(3);
  });

  it('départage par l âge (le plus jeune en premier) en cas d égalité parfaite de notes', () => {
    const cVieux = EntranceExamScoringEngine.evaluerCandidat(
      {
        candidateId: 'vieux',
        dateOfBirth: new Date('2013-01-01'),
        grades: [
          { subjectId: 'sub-math', score: 14 },
          { subjectId: 'sub-fr', score: 14 },
          { subjectId: 'sub-ang', score: 14 },
        ],
      },
      subjects
    );

    const cJeune = EntranceExamScoringEngine.evaluerCandidat(
      {
        candidateId: 'jeune',
        dateOfBirth: new Date('2014-06-15'), // plus jeune
        grades: [
          { subjectId: 'sub-math', score: 14 },
          { subjectId: 'sub-fr', score: 14 },
          { subjectId: 'sub-ang', score: 14 },
        ],
      },
      subjects
    );

    const ranked = EntranceExamScoringEngine.classerCandidats([cVieux, cJeune], subjects);
    expect(ranked[0].candidateId).toBe('jeune');
    expect(ranked[1].candidateId).toBe('vieux');
  });

  it('simule la délibération avec places disponibles et liste d attente', () => {
    const scores = [
      { candidateId: 'a', totalAverage: 16.0, isComplete: true, isEliminated: false, subjectResults: [] },
      { candidateId: 'b', totalAverage: 14.5, isComplete: true, isEliminated: false, subjectResults: [] },
      { candidateId: 'c', totalAverage: 12.0, isComplete: true, isEliminated: false, subjectResults: [] },
      { candidateId: 'd', totalAverage: 11.5, isComplete: true, isEliminated: false, subjectResults: [] },
      { candidateId: 'e', totalAverage: 9.5, isComplete: true, isEliminated: false, subjectResults: [] },
      { candidateId: 'f', totalAverage: 15.0, isComplete: true, isEliminated: true, subjectResults: [] }, // éliminé
    ];

    const simulation = EntranceExamScoringEngine.simulerDeliberation({
      scoredCandidates: scores,
      availableSeats: 2,
      admissionThreshold: 10.0,
      waitingListSeats: 1,
    });

    expect(simulation.admisIds).toEqual(['a', 'b']);
    expect(simulation.admisCount).toBe(2);
    expect(simulation.listeAttenteIds).toEqual(['c']);
    expect(simulation.listeAttenteCount).toBe(1);
    expect(simulation.refusesIds).toContain('d');
    expect(simulation.refusesIds).toContain('e');
    expect(simulation.refusesIds).toContain('f');
    expect(simulation.effectiveThreshold).toBe(14.5);
  });
});
