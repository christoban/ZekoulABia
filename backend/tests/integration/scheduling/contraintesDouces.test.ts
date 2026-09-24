/**
 * Tests des contraintes douces V2.5 — contre le VRAI solveur CP-SAT.
 *
 * Principe (PLAN_V2.5 §3) : chaque contrainte a UN test qui prouve un changement sur `seances`
 * (pas sur le score seul). La preuve est DIFFÉRENTIELLE : on résout le même problème avec et sans
 * le drapeau, et on affirme que la métrique ciblée (trous / triplets / écart / dépassement)
 * s'améliore strictement — et atteint son optimum — uniquement quand le drapeau est actif.
 *
 * Les fixtures ont été calibrées empiriquement (CP-SAT déterministe, 1 worker) pour que la
 * solution « sans pénalité » viole la contrainte : c'est ce qui rend le différentiel non vide.
 * Si une future version d'or-tools change l'ordre de recherche, les contre-épreuves OFF peuvent
 * bouger — l'assertion ON (l'invariant) reste, elle, toujours vraie.
 *
 * Isolation : une seule salle NORMAL, pas de salle habituelle → l'objectif ne contient QUE la
 * pénalité testée, aucune interaction avec le poids salle habituelle.
 */
import { describe, it, expect } from 'bun:test';
import { ORToolsWasmAdapter } from '../../../src/infrastructure/scheduling/ORToolsWasmAdapter.ts';
import type { ProposerEmploiDuTempsInput, SeanceProposee } from '@domain/ports/services/SchedulingSolverPort';

const adapter = new ORToolsWasmAdapter();

function heure(h: number): string {
  return `${String(8 + h).padStart(2, '0')}:00`;
}

/** Grille nbJours × nbCases, cases d'1 h (08:00 → 08:00+nbCases). */
function grille(nbJours: number, nbCases: number): ProposerEmploiDuTempsInput['grille'] {
  const cases: ProposerEmploiDuTempsInput['grille'] = [];
  for (let j = 0; j < nbJours; j++) {
    for (let h = 0; h < nbCases; h++) {
      cases.push({ dayOfWeek: j, startTime: heure(h), endTime: heure(h + 1) });
    }
  }
  return cases;
}

const SALLE = { roomId: 'salle-1', type: 'NORMAL' as const, capacity: 40 };

function exigences(nb: number, teacherId = 'prof-T'): ProposerEmploiDuTempsInput['exigences'] {
  return Array.from({ length: nb }, (_, i) => ({
    subjectId: `matiere-${i}`,
    subjectType: 'THEORETICAL' as const,
    teacherId,
    durationMinutes: 60,
  }));
}

function input(surcharge: Partial<ProposerEmploiDuTempsInput> = {}): ProposerEmploiDuTempsInput {
  return { classId: 'classe-1', exigences: exigences(4), grille: grille(5, 4), sallesDisponibles: [SALLE], occupationExistante: [], ...surcharge };
}

/** indices horaires occupés par un enseignant, par jour (triés). */
function occupationParJour(seances: SeanceProposee[], teacherId: string): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const s of seances) {
    if (s.teacherId !== teacherId) continue;
    const arr = map.get(s.dayOfWeek) ?? [];
    arr.push(parseInt(s.startTime.slice(0, 2), 10) - 8);
    map.set(s.dayOfWeek, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a - b);
  return map;
}

/** Somme des interstices vides (trous) dans la journée d'un enseignant. */
function trous(seances: SeanceProposee[], teacherId: string): number {
  let total = 0;
  for (const indices of occupationParJour(seances, teacherId).values()) {
    if (indices.length === 0) continue;
    total += indices[indices.length - 1]! - indices[0]! + 1 - indices.length;
  }
  return total;
}

/** Nombre de triplets de 3 cases consécutives occupées par un enseignant. */
function triplets(seances: SeanceProposee[], teacherId: string): number {
  let total = 0;
  for (const indices of occupationParJour(seances, teacherId).values()) {
    const set = new Set(indices);
    for (const h of set) {
      if (set.has(h + 1) && set.has(h + 2)) total++;
    }
  }
  return total;
}

/** Écart de charge de la CLASSE (tous enseignants) entre le jour le plus et le moins chargé. */
function ecartCharge(seances: SeanceProposee[], nbJours: number): number {
  const parJour = new Map<number, number>();
  for (let j = 0; j < nbJours; j++) parJour.set(j, 0);
  for (const s of seances) parJour.set(s.dayOfWeek, (parJour.get(s.dayOfWeek) ?? 0) + 1);
  const charges = [...parJour.values()];
  return Math.max(...charges) - Math.min(...charges);
}

/** Nombre max de séances d'un enseignant sur un même jour. */
function maxJourEnseignant(seances: SeanceProposee[], teacherId: string): number {
  let max = 0;
  for (const indices of occupationParJour(seances, teacherId).values()) max = Math.max(max, indices.length);
  return max;
}

/** Vrai si les séances d'une matière se partitionnent en paires de cases adjacentes (blocs de 2 h). */
function estEnBlocsAdjacents(seances: SeanceProposee[], subjectId: string): boolean {
  const parJour = new Map<number, number[]>();
  for (const s of seances) {
    if (s.subjectId !== subjectId) continue;
    const arr = parJour.get(s.dayOfWeek) ?? [];
    arr.push(parseInt(s.startTime.slice(0, 2), 10) - 8);
    parJour.set(s.dayOfWeek, arr);
  }
  for (const arr of parJour.values()) {
    arr.sort((a, b) => a - b);
    for (let i = 0; i < arr.length; i += 2) {
      if (i + 1 >= arr.length) return false;
      if (arr[i + 1]! - arr[i]! !== 1) return false;
    }
  }
  return true;
}

describe('Contraintes douces V2.5 — effet réel sur les séances', () => {
  it('T1 — trouEnseignant : compacte la journée (trous réduits à zéro)', async () => {
    const fixture = { exigences: exigences(5), grille: grille(1, 8) };
    const off = await adapter.proposer(input(fixture));
    const on = await adapter.proposer(input({ ...fixture, contraintes: { trouEnseignant: true } }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(on.statut);
    expect(on.seances).toHaveLength(5);
    expect(trous(on.seances, 'prof-T')).toBe(0);
    // Contre-épreuve : sans le drapeau, la solution laisse des trous.
    expect(trous(off.seances, 'prof-T')).toBeGreaterThan(0);
  });

  it('T2 — troisCoursConsecutifs : jamais 3 cases d\'affilée', async () => {
    const fixture = { exigences: exigences(5), grille: grille(1, 8) };
    const off = await adapter.proposer(input(fixture));
    const on = await adapter.proposer(input({ ...fixture, contraintes: { troisCoursConsecutifs: true } }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(on.statut);
    expect(on.seances).toHaveLength(5);
    expect(triplets(on.seances, 'prof-T')).toBe(0);
    expect(triplets(off.seances, 'prof-T')).toBeGreaterThan(0);
  });

  it('T3 — equilibrageSemaine : écart jour/jour réduit à zéro', async () => {
    const fixture = { exigences: exigences(6), grille: grille(3, 4) };
    const off = await adapter.proposer(input(fixture));
    const on = await adapter.proposer(input({ ...fixture, contraintes: { equilibrageSemaine: true } }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(on.statut);
    expect(on.seances).toHaveLength(6);
    expect(ecartCharge(on.seances, 3)).toBe(0);
    expect(ecartCharge(off.seances, 3)).toBeGreaterThan(0);
  });

  it('T4 — volumeMaxEnseignantParJour : plafond journalier respecté', async () => {
    const fixture = { exigences: exigences(4), grille: grille(2, 3) };
    const off = await adapter.proposer(input(fixture));
    const on = await adapter.proposer(input({ ...fixture, contraintes: { volumeMaxEnseignantParJour: 120 } }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(on.statut);
    expect(on.seances).toHaveLength(4);
    expect(maxJourEnseignant(on.seances, 'prof-T')).toBeLessThanOrEqual(2);
    expect(maxJourEnseignant(off.seances, 'prof-T')).toBeGreaterThan(2);
  });

  it('T5 — objectif combiné : les 4 invariants tiennent simultanément', async () => {
    const fixture = {
      exigences: [...exigences(4, 'prof-A'), ...exigences(4, 'prof-B')],
      grille: grille(5, 4),
    };
    const resultat = await adapter.proposer(input({
      ...fixture,
      contraintes: {
        trouEnseignant: true,
        troisCoursConsecutifs: true,
        equilibrageSemaine: true,
        volumeMaxEnseignantParJour: 240,
      },
    }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(resultat.seances).toHaveLength(8);
    for (const tid of ['prof-A', 'prof-B']) {
      expect(trous(resultat.seances, tid)).toBe(0);
      expect(triplets(resultat.seances, tid)).toBe(0);
      expect(maxJourEnseignant(resultat.seances, tid)).toBeLessThanOrEqual(4);
    }
    expect(ecartCharge(resultat.seances, 5)).toBeLessThanOrEqual(2);
  });

  it('T6 — limite de deux temps libres par jour', async () => {
    const fixture = { exigences: exigences(5), grille: grille(1, 8) };
    const resultat = await adapter.proposer(input({ ...fixture, contraintes: { maxTempsLibresParJour: 2 } }));

    expect(resultat.statut).toBe('INFAISABLE');
  });

  it('T7 — blocs de 2h : les deux occurrences forment une paire adjacente', async () => {
    const exigencesBloc = Array.from({ length: 2 }, () => ({
      subjectId: 'maths', subjectType: 'THEORETICAL' as const, teacherId: 'prof-T',
      durationMinutes: 60, blocDureeCases: 2,
    }));
    const resultat = await adapter.proposer(input({ exigences: exigencesBloc, grille: grille(1, 4) }));

    expect(['OPTIMAL', 'FEASIBLE']).toContain(resultat.statut);
    expect(resultat.seances).toHaveLength(2);
    expect(estEnBlocsAdjacents(resultat.seances, 'maths')).toBe(true);
  });
});

describe('Solutions multiples V2.5 — no-good re-solve', () => {
  function signature(seances: SeanceProposee[]): string {
    return seances.map(s => `${s.subjectId}@${s.dayOfWeek}:${s.startTime}`).sort().join('|');
  }

  it('retourne plusieurs solutions distinctes, désactivé par défaut', async () => {
    const base = { exigences: exigences(4), grille: grille(2, 4) };

    const sansOption = await adapter.proposer(input(base));
    expect(sansOption.solutionsAlternatives).toBeUndefined();

    const avecOption = await adapter.proposer(input({ ...base, solutionsMultiples: { nombre: 3 } }));
    const alternatives = avecOption.solutionsAlternatives ?? [];
    expect(alternatives.length).toBeGreaterThanOrEqual(1);

    const signatures = new Set<string>([signature(avecOption.seances), ...alternatives.map(a => signature(a.seances))]);
    // Au moins 2 signatures distinctes au total : la principale diffère des alternatives.
    expect(signatures.size).toBeGreaterThanOrEqual(2);
  });
});

describe('Explain My Timetable V2.5 — explicatifs', () => {
  it('génère une ligne par séance retenue, avec matière/salle/raison', async () => {
    const exigencesFixt = [
      { subjectId: 'maths', subjectType: 'THEORETICAL' as const, teacherId: 'prof-A', durationMinutes: 60, subjectName: 'Mathématiques', teacherName: 'M. Kamga' },
      { subjectId: 'svt', subjectType: 'PRACTICAL' as const, teacherId: 'prof-B', durationMinutes: 60, subjectName: 'SVT', teacherName: 'Mme Ngo' },
    ];
    const salles = [
      { roomId: 'salle-A', type: 'NORMAL' as const, capacity: 40, roomName: 'Salle A' },
      { roomId: 'labo', type: 'LABORATORY' as const, capacity: 24, roomName: 'Labo SVT' },
    ];
    const resultat = await adapter.proposer(input({
      exigences: exigencesFixt,
      sallesDisponibles: salles,
      salleHabituelleId: 'salle-A',
      contraintes: { explicatifs: true },
    }));

    expect(resultat.explicatifs).toHaveLength(2);
    const maths = resultat.explicatifs!.find(e => e.includes('Mathématiques'))!;
    const svt = resultat.explicatifs!.find(e => e.includes('SVT'))!;
    expect(maths).toContain('Salle A');
    expect(maths).toContain('salle habituelle de la classe');
    expect(svt).toContain('Labo SVT');
    expect(svt).toContain('salle spécialisée exigée');
  });

  it('absent quand l\'option est absente', async () => {
    const resultat = await adapter.proposer(input());
    expect(resultat.explicatifs).toBeUndefined();
  });
});
