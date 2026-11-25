/**
 * Tests de l'adaptateur CP-SAT réel (pas de mock) — c'est la seule pièce dont le comportement
 * concret compte : un faux solveur ne prouverait rien sur la traduction du problème métier en
 * modèle CP-SAT, qui est exactement ce qu'on veut vérifier ici.
 */
import { describe, it, expect } from 'bun:test';
import { ORToolsWasmAdapter } from '../../../src/infrastructure/scheduling/ORToolsWasmAdapter.ts';
import type { ProposerEmploiDuTempsInput } from '@domain/ports/services/SchedulingSolverPort';

const adapter = new ORToolsWasmAdapter();

const GRILLE = [
  { dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
  { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
  { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
  { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
];

const SALLE_HABITUELLE = { roomId: 'salle-habituelle', type: 'NORMAL' as const, capacity: 40 };
const SALLE_LABO = { roomId: 'salle-labo', type: 'LABORATORY' as const, capacity: 24 };

function input(surcharge: Partial<ProposerEmploiDuTempsInput> = {}): ProposerEmploiDuTempsInput {
  return {
    classId: 'classe-1',
    salleHabituelleId: SALLE_HABITUELLE.roomId,
    exigences: [
      { subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'prof-A', durationMinutes: 60 },
      { subjectId: 'francais', subjectType: 'THEORETICAL', teacherId: 'prof-B', durationMinutes: 60 },
    ],
    grille: GRILLE,
    sallesDisponibles: [SALLE_HABITUELLE, SALLE_LABO],
    occupationExistante: [],
    ...surcharge,
  };
}

describe('ORToolsWasmAdapter — modèle CP-SAT', () => {
  it('place toutes les séances demandées, une seule fois chacune', async () => {
    const resultat = await adapter.proposer(input());

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(resultat.seances).toHaveLength(2);
    expect(resultat.seances.map(s => s.subjectId).sort()).toEqual(['francais', 'maths']);
  });

  it('respecte la contrainte souple : matières théoriques dans la salle habituelle', async () => {
    const resultat = await adapter.proposer(input());

    for (const seance of resultat.seances) {
      expect(seance.roomId).toBe(SALLE_HABITUELLE.roomId);
    }
    // 2 séances × 10 points — l'optimum est bien atteint, pas juste une solution faisable.
    expect(resultat.scoreObjectif).toBe(20);
  });

  it('DUR — la classe ne suit jamais deux séances au même créneau', async () => {
    const resultat = await adapter.proposer(input());

    const cases = resultat.seances.map(s => `${s.dayOfWeek}|${s.startTime}`);
    expect(new Set(cases).size).toBe(cases.length);
  });

  it('DUR — un enseignant n\'est jamais sur deux séances au même créneau', async () => {
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'prof-A', durationMinutes: 60 },
        { subjectId: 'physique', subjectType: 'THEORETICAL', teacherId: 'prof-A', durationMinutes: 60 },
      ],
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    const creneauxProfA = resultat.seances
      .filter(s => s.teacherId === 'prof-A')
      .map(s => `${s.dayOfWeek}|${s.startTime}`);
    expect(new Set(creneauxProfA).size).toBe(creneauxProfA.length);
  });

  it('DUR — une matière PRACTICAL va en salle spécialisée, jamais en salle NORMAL', async () => {
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'svt-tp', subjectType: 'PRACTICAL', teacherId: 'prof-A', durationMinutes: 60 },
      ],
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(resultat.seances).toHaveLength(1);
    expect(resultat.seances[0]!.roomId).toBe(SALLE_LABO.roomId);
  });

  it('solution de secours — signale une règle pédagogique non respectée', async () => {
    const resultat = await adapter.proposer(input({
      exigences: Array.from({ length: 3 }, () => ({
        subjectId: 'maths', subjectType: 'THEORETICAL' as const,
        teacherId: 'prof-A', durationMinutes: 60,
      })),
      grille: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
        { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
        { dayOfWeek: 0, startTime: '10:00', endTime: '11:00' },
      ],
    }));

    expect(resultat.statut).toBe('FEASIBLE');
    expect(resultat.avertissements?.length).toBeGreaterThan(0);
  });

  it('DUR — trois occurrences d’une matière restent possibles si elles sont réparties sur deux jours', async () => {
    const resultat = await adapter.proposer(input({
      exigences: Array.from({ length: 3 }, () => ({
        subjectId: 'maths', subjectType: 'THEORETICAL' as const,
        teacherId: 'prof-A', durationMinutes: 60,
      })),
      grille: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
        { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
        { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
      ],
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(resultat.seances).toHaveLength(3);
    for (const day of [0, 1]) {
      expect(resultat.seances.filter(seance => seance.dayOfWeek === day && seance.subjectId === 'maths').length).toBeLessThanOrEqual(2);
    }
  });

  it('DUR — deux occurrences journalières sont contiguës dans les cases de cours', async () => {
    const resultat = await adapter.proposer(input({
      exigences: [
        ...Array.from({ length: 2 }, () => ({ subjectId: 'maths', subjectType: 'THEORETICAL' as const, teacherId: 'prof-A', durationMinutes: 60 })),
        ...Array.from({ length: 2 }, (_, i) => ({ subjectId: `matiere-${i}`, subjectType: 'THEORETICAL' as const, teacherId: 'prof-A', durationMinutes: 60 })),
      ],
      grille: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
        { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
        { dayOfWeek: 0, startTime: '10:00', endTime: '11:00' },
        { dayOfWeek: 0, startTime: '11:00', endTime: '12:00' },
      ],
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    const maths = resultat.seances
      .filter(seance => seance.subjectId === 'maths')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    expect(Number(maths[1]!.startTime.slice(0, 2)) - Number(maths[0]!.startTime.slice(0, 2))).toBe(1);
  });

  it('DUR — EPS à 2 occurrences occupe deux jours et est exempté du bloc de 2 h', async () => {
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'eps', subjectType: 'PRACTICAL' as const, teacherId: 'prof-A', durationMinutes: 60, subjectName: 'EPS', blocDureeCases: 2, volumeHebdomadaire: 2, nbOccurrencesHebdomadaires: 2, categorieJoursDistincts: 'EPS_TM' },
        { subjectId: 'eps', subjectType: 'PRACTICAL' as const, teacherId: 'prof-A', durationMinutes: 60, subjectName: 'EPS', blocDureeCases: 2, volumeHebdomadaire: 2, nbOccurrencesHebdomadaires: 2, categorieJoursDistincts: 'EPS_TM' },
        { subjectId: 'maths', subjectType: 'THEORETICAL' as const, teacherId: 'prof-B', durationMinutes: 60, blocDureeCases: 2 },
        { subjectId: 'maths', subjectType: 'THEORETICAL' as const, teacherId: 'prof-B', durationMinutes: 60, blocDureeCases: 2 },
      ],
      grille: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
        { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
        { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
        { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
        { dayOfWeek: 2, startTime: '08:00', endTime: '09:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '10:00' },
      ],
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(new Set(resultat.seances.filter(seance => seance.subjectId === 'eps').map(seance => seance.dayOfWeek)).size).toBe(2);
  });

  it('DUR — subjectType seul ne classe pas une matière dans EPS/TM', async () => {
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'sport', subjectType: 'PRACTICAL' as const, teacherId: 'prof-A', durationMinutes: 60, subjectName: 'Matière quelconque', blocDureeCases: 2, volumeHebdomadaire: 2, nbOccurrencesHebdomadaires: 2 },
        { subjectId: 'sport', subjectType: 'PRACTICAL' as const, teacherId: 'prof-A', durationMinutes: 60, subjectName: 'Matière quelconque', blocDureeCases: 2, volumeHebdomadaire: 2, nbOccurrencesHebdomadaires: 2 },
      ],
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(new Set(resultat.seances.map(seance => seance.dayOfWeek)).size).toBe(1);
  });

  it('DUR — ne place jamais un enseignant déjà occupé par une autre classe', async () => {
    // prof-A est pris toute la journée 0 ; sa séance doit basculer sur la journée 1.
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'prof-A', durationMinutes: 60 },
      ],
      occupationExistante: [
        { teacherId: 'prof-A', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
        { teacherId: 'prof-A', dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
      ],
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(resultat.seances[0]!.dayOfWeek).toBe(1);
  });

  it('DUR (V2.4) — ne place jamais une séance sur un créneau où l\'enseignant est indisponible', async () => {
    // prof-A est indisponible toute la journée 0 → sa séance doit basculer sur la journée 1.
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'prof-A', durationMinutes: 60 },
      ],
      indisponibilitesEnseignants: [
        { teacherId: 'prof-A', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
        { teacherId: 'prof-A', dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
      ],
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(resultat.seances[0]!.dayOfWeek).toBe(1);
  });

  it('DUR (V2.4) — indisponibilité d\'un enseignant n\'empêche pas un autre enseignant d\'être placé', async () => {
    // prof-B est indisponible sur le créneau matin de la journée 0, mais prof-A reste libre partout.
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'prof-A', durationMinutes: 60 },
        { subjectId: 'francais', subjectType: 'THEORETICAL', teacherId: 'prof-B', durationMinutes: 60 },
      ],
      indisponibilitesEnseignants: [
        { teacherId: 'prof-B', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
        { teacherId: 'prof-B', dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
      ],
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(resultat.seances).toHaveLength(2);
    const seanceProfA = resultat.seances.find(s => s.teacherId === 'prof-A');
    expect(seanceProfA).toBeDefined();
  });

  it('INFAISABLE (V2.4) — enseignant indisponible sur toute la grille → aucune séance plaçable', async () => {
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'prof-A', durationMinutes: 60, subjectName: 'Maths', teacherName: 'M. A' },
      ],
      indisponibilitesEnseignants: GRILLE.map(c => ({
        teacherId: 'prof-A', dayOfWeek: c.dayOfWeek, startTime: c.startTime, endTime: c.endTime,
      })),
    }));

    expect(resultat.statut).toBe('INFAISABLE');
    expect(resultat.seances).toHaveLength(0);
    // Réparation auto : la suggestion nomme la matière concernée.
    expect(resultat.suggestions!.some(suggestion => suggestion.includes('Maths'))).toBe(true);
  });

  it('DUR — ne place jamais une séance dans une salle déjà occupée par une autre classe', async () => {
    // La salle habituelle est prise toute la grille → la séance part en labo malgré la
    // préférence souple pour la salle habituelle (le dur prime toujours sur le souple).
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'maths', subjectType: 'THEORETICAL', teacherId: 'prof-A', durationMinutes: 60 },
      ],
      occupationExistante: GRILLE.map(c => ({
        roomId: SALLE_HABITUELLE.roomId, dayOfWeek: c.dayOfWeek, startTime: c.startTime, endTime: c.endTime,
      })),
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(resultat.seances[0]!.roomId).toBe(SALLE_LABO.roomId);
  });

  it('INFAISABLE explicite — matière PRACTICAL sans aucune salle spécialisée', async () => {
    const resultat = await adapter.proposer(input({
      exigences: [
        { subjectId: 'svt-tp', subjectType: 'PRACTICAL', teacherId: 'prof-A', durationMinutes: 60 },
      ],
      sallesDisponibles: [SALLE_HABITUELLE],
    }));

    expect(resultat.statut).toBe('INFAISABLE');
    expect(resultat.seances).toHaveLength(0);
    expect(resultat.raisonInfaisabilite).toContain('Aucune salle compatible');
    expect(resultat.suggestions?.[0]).toContain('salle spécialisée');
  });

  it('INFAISABLE explicite — plus de séances à placer que de créneaux disponibles', async () => {
    const resultat = await adapter.proposer(input({
      exigences: Array.from({ length: 5 }, (_, i) => ({
        subjectId: `matiere-${i}`, subjectType: 'THEORETICAL' as const,
        teacherId: 'prof-A', durationMinutes: 60,
      })),
    }));

    expect(resultat.statut).toBe('INFAISABLE');
    expect(resultat.raisonInfaisabilite).toBeDefined();
  });

  it('INFAISABLE explicite — grille horaire vide', async () => {
    const resultat = await adapter.proposer(input({ grille: [] }));

    expect(resultat.statut).toBe('INFAISABLE');
    expect(resultat.raisonInfaisabilite).toContain('grille horaire');
  });

  it('cas trivial — aucune exigence à placer', async () => {
    const resultat = await adapter.proposer(input({ exigences: [] }));

    expect(resultat.statut).toBe('OPTIMAL');
    expect(resultat.seances).toHaveLength(0);
  });
});
