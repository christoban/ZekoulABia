import { describe, it, expect } from 'bun:test';
import {
  genererAffectations,
  type CandidatMatiereClasse,
  type EnseignantEligible,
} from '../../../../src/domain/services/AffecterEnseignantsService';

function candidat(
  overrides: Partial<CandidatMatiereClasse> & { classId: string; subjectId: string },
): CandidatMatiereClasse {
  return {
    className: overrides.className ?? `Classe ${overrides.classId}`,
    subjectName: overrides.subjectName ?? `Matière ${overrides.subjectId}`,
    weeklyPeriods: overrides.weeklyPeriods ?? 2,
    dejaAffecte: overrides.dejaAffecte ?? false,
    ...overrides,
  };
}

function enseignant(
  overrides: Partial<EnseignantEligible> & { teacherId: string; subjectId: string },
): EnseignantEligible {
  return {
    estAP: overrides.estAP ?? false,
    chargeActuelleHeures: overrides.chargeActuelleHeures ?? 0,
    ...overrides,
  };
}

describe('AffecterEnseignantsService', () => {
  it('affecte chaque matière à l’enseignant éligible le moins chargé', () => {
    const result = genererAffectations(
      [candidat({ classId: 'c1', subjectId: 's1' })],
      [
        enseignant({ teacherId: 't1', subjectId: 's1', chargeActuelleHeures: 4 }),
        enseignant({ teacherId: 't2', subjectId: 's1', chargeActuelleHeures: 2 }),
      ],
    );

    expect(result.aCreer).toHaveLength(1);
    expect(result.aCreer[0].teacherId).toBe('t2');
    expect(result.nonResolus).toHaveLength(0);
    expect(result.horsPerimetre).toHaveLength(0);
  });

  it('respecte le plafond AP de 14h en choisissant le candidat suivant', () => {
    const result = genererAffectations(
      [candidat({ classId: 'c1', subjectId: 's1', weeklyPeriods: 4 })],
      [
        enseignant({ teacherId: 't1', subjectId: 's1', estAP: true, chargeActuelleHeures: 12 }),
        enseignant({ teacherId: 't2', subjectId: 's1', estAP: false, chargeActuelleHeures: 10 }),
      ],
    );

    // t1 (AP, 12h) ne peut pas prendre 4h de plus → dépassement 14h
    expect(result.aCreer[0].teacherId).toBe('t2');
  });

  it('respecte la capacité hebdomadaire de la grille pour un enseignant ordinaire', () => {
    const result = genererAffectations(
      [candidat({ classId: 'c1', subjectId: 's1', weeklyPeriods: 3 })],
      [
        enseignant({ teacherId: 't1', subjectId: 's1', chargeActuelleHeures: 5, capaciteHeures: 7 }),
        enseignant({ teacherId: 't2', subjectId: 's1', chargeActuelleHeures: 1, capaciteHeures: 10 }),
      ],
    );

    expect(result.aCreer[0].teacherId).toBe('t2');
  });

  it('signale la capacité de grille dépassée quand aucun enseignant ne peut prendre la matière', () => {
    const result = genererAffectations(
      [candidat({ classId: 'c1', subjectId: 's1', weeklyPeriods: 3 })],
      [enseignant({ teacherId: 't1', subjectId: 's1', chargeActuelleHeures: 5, capaciteHeures: 7 })],
    );

    expect(result.nonResolus[0].raison).toBe('TEACHER_WEEKLY_CAP_EXCEEDED');
    expect(result.nonResolus[0].details).toEqual({ weeklyPeriods: 3, candidats: [{ teacherId: 't1', chargeActuelleHeures: 5, capaciteHeures: 7, estAP: false }] });
  });

  it('marque non résolu quand tous les qualifiés dépasseraient le plafond AP', () => {
    const result = genererAffectations(
      [candidat({ classId: 'c1', subjectId: 's1', weeklyPeriods: 3 })],
      [
        enseignant({ teacherId: 't1', subjectId: 's1', estAP: true, chargeActuelleHeures: 12 }),
      ],
    );

    expect(result.aCreer).toHaveLength(0);
    expect(result.nonResolus).toHaveLength(1);
    expect(result.nonResolus[0].raison).toBe('AP_WEEKLY_CAP_EXCEEDED');
  });

  it('marque non résolu quand aucun enseignant qualifié', () => {
    const result = genererAffectations(
      [candidat({ classId: 'c1', subjectId: 's1' })],
      [],
    );

    expect(result.aCreer).toHaveLength(0);
    expect(result.nonResolus).toHaveLength(1);
    expect(result.nonResolus[0].raison).toBe('NO_QUALIFIED_TEACHER');
  });

  it('place dans hors périmètre les candidats sans weeklyPeriods', () => {
    const result = genererAffectations(
      [candidat({ classId: 'c1', subjectId: 's1', weeklyPeriods: null })],
      [enseignant({ teacherId: 't1', subjectId: 's1' })],
    );

    expect(result.aCreer).toHaveLength(0);
    expect(result.nonResolus).toHaveLength(0);
    expect(result.horsPerimetre).toHaveLength(1);
    expect(result.horsPerimetre[0].subjectId).toBe('s1');
  });

  it('ignore silencieusement les couples déjà affectés', () => {
    const result = genererAffectations(
      [candidat({ classId: 'c1', subjectId: 's1', dejaAffecte: true })],
      [enseignant({ teacherId: 't1', subjectId: 's1' })],
    );

    expect(result.aCreer).toHaveLength(0);
    expect(result.nonResolus).toHaveLength(0);
    expect(result.horsPerimetre).toHaveLength(0);
  });

  it('est déterministe pour des entrées identiques', () => {
    const candidats = [candidat({ classId: 'c1', subjectId: 's1' })];
    const enseignants = [
      enseignant({ teacherId: 't1', subjectId: 's1', chargeActuelleHeures: 2 }),
      enseignant({ teacherId: 't2', subjectId: 's1', chargeActuelleHeures: 2 }),
    ];

    const run1 = genererAffectations(candidats, enseignants);
    const run2 = genererAffectations(candidats, enseignants);
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('met à jour la charge en mémoire entre deux couples du même run', () => {
    const result = genererAffectations(
      [
        candidat({ classId: 'c1', subjectId: 's1', weeklyPeriods: 3 }),
        candidat({ classId: 'c2', subjectId: 's1', weeklyPeriods: 3 }),
      ],
      [
        enseignant({ teacherId: 't1', subjectId: 's1', chargeActuelleHeures: 0 }),
        enseignant({ teacherId: 't2', subjectId: 's1', chargeActuelleHeures: 0 }),
      ],
    );

    // t1 reçoit c1 (moins chargé), puis t2 reçoit c2 (car t1 est maintenant à 3)
    expect(result.aCreer).toHaveLength(2);
    const first = result.aCreer.find((a) => a.classId === 'c1')!;
    const second = result.aCreer.find((a) => a.classId === 'c2')!;
    expect(first.teacherId).toBe('t1');
    expect(second.teacherId).toBe('t2');
  });

  it('respecte l’ordre de traitement déterministe (classId, subjectId)', () => {
    // Deux couples identiques en charge initiale ; l’ordre de traitement garantit
    // que le premier obtient t1 et le second t2 (t1 devient plus chargé après).
    const result = genererAffectations(
      [
        candidat({ classId: 'c1', subjectId: 's1' }),
        candidat({ classId: 'c2', subjectId: 's1' }),
      ],
      [
        enseignant({ teacherId: 't1', subjectId: 's1', chargeActuelleHeures: 0 }),
        enseignant({ teacherId: 't2', subjectId: 's1', chargeActuelleHeures: 0 }),
      ],
    );

    expect(result.aCreer[0].teacherId).toBe('t1');
    expect(result.aCreer[1].teacherId).toBe('t2');
  });
});
