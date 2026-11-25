/**
 * INFRASTRUCTURE — Adaptateur OR-Tools (CP-SAT via WebAssembly) du SchedulingSolverPort.
 *
 * Choix technique validé par un spike dédié (or-tools-wasm 0.9.1 sous Bun 1.3.14) : le package
 * expose une condition d'export "bun" maintenue et testée en CI par l'amont, l'API TypeScript
 * fonctionne telle que documentée, ~554ms à froid (chargement WASM) puis ~60ms à chaud.
 *
 * Modèle CP-SAT — une variable booléenne x[exigence][case][salle] = "cette séance a lieu à cette
 * case, dans cette salle". Les variables IMPOSSIBLES ne sont jamais créées (mauvais type de
 * salle, enseignant ou salle déjà pris par une autre classe) : c'est plus efficace et plus lisible
 * qu'ajouter des contraintes pour les interdire après coup.
 *
 * Contraintes DURES :
 *   1. Chaque séance est placée exactement une fois.
 *   2. La classe ne peut pas suivre deux séances à la même case (conflit classe).
 *   3. Un enseignant ne peut pas être sur deux séances à la même case (conflit enseignant) —
 *      même règle que CreneauHoraire.verifierConflitEnseignant(), portée dans le solveur.
 *   4. Une salle ne peut pas accueillir deux séances à la même case (conflit salle) —
 *      même règle que CreneauHoraire.verifierConflitSalle().
 *   5. Type de salle : une matière PRACTICAL exige une salle spécialisée (jamais NORMAL).
 *
 * Contrainte SOUPLE (objectif maximisé) : préférer la salle habituelle de la classe
 * (ClassRoomAssignment) — un cours dans sa salle habituelle vaut POIDS_SALLE_HABITUELLE points.
 */
import { CpSolver, setWorkerBridgeEnabled } from 'or-tools-wasm/cp-sat';
import type { BoolVar } from 'or-tools-wasm/cp-sat';
import type {
  SchedulingSolverPort,
  ProposerEmploiDuTempsInput,
  PropositionEmploiDuTemps,
  SeanceProposee,
  ExigenceSeance,
  CaseGrille,
  SalleDisponible,
} from '@domain/ports/services/SchedulingSolverPort';
import type { Placement } from '@infrastructure/scheduling/contraintesDouces';
import { NOMS_JOURS } from '@domain/types/joursSemaine';
import {
  construireModeleCpSat,
  construireSolutionSecours,
  construireSuggestions,
  diagnostiquerInfaisabilite,
} from './orToolsModelBuilder';

/** Nombre de workers CP-SAT — 1 suffit très largement à cette taille de problème (cf. spike). */
const NB_WORKERS = 1;

export class ORToolsWasmAdapter implements SchedulingSolverPort {
  constructor() {
    setWorkerBridgeEnabled(true);
  }

  async proposer(input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> {
    const {
      exigences,
      grille,
      sallesDisponibles,
      occupationExistante,
      salleHabituelleId,
      indisponibilitesEnseignants = [],
      contraintes,
      reglesPedagogiquesDures,
    } = input;

    if (exigences.length === 0) {
      return { statut: 'OPTIMAL', seances: [], scoreObjectif: 0, dureeResolutionMs: 0 };
    }
    if (grille.length === 0) {
      return {
        statut: 'INFAISABLE',
        seances: [],
        scoreObjectif: 0,
        dureeResolutionMs: 0,
        raisonInfaisabilite: "La grille horaire de l'établissement ne contient aucun créneau — configurez-la avant de proposer un emploi du temps.",
      };
    }

    const modeleConstruit = construireModeleCpSat(input);
    if ('proposition' in modeleConstruit) {
      return modeleConstruit.proposition;
    }

    const { model, placements, variables, objectifExpr, aObjectif } = modeleConstruit;

    // --- Résolution ---
    const solver = new CpSolver();
    const debut = performance.now();
    // maxDeterministicTime est utilisé à la place d'une limite murale : la recherche reste reproductible,
    // mais la durée réelle peut varier selon la machine et la complexité restante.
    const status = await solver.solve(model, {
      numSearchWorkers: NB_WORKERS,
      maxDeterministicTime: input.maxDeterministicTime ?? 60,
    });
    const dureeResolutionMs = performance.now() - debut;

    const statusName = solver.statusName(status);
    if (statusName !== 'OPTIMAL' && statusName !== 'FEASIBLE') {
      const solutionSecours = construireSolutionSecours(exigences, grille, sallesDisponibles, placements, salleHabituelleId);
      if (solutionSecours) {
        return {
          ...solutionSecours,
          dureeResolutionMs,
          avertissements: ['Solution de secours : les règles pédagogiques souples ou de placement n’ont pas pu toutes être respectées.'],
        };
      }
      return {
        statut: 'INFAISABLE',
        seances: [],
        scoreObjectif: 0,
        dureeResolutionMs,
        raisonInfaisabilite: `Aucune combinaison ne satisfait toutes les contraintes (statut solveur : ${statusName}).`,
        problemes: [
          ...(await this.diagnostiquerContraintesPedagogiques(input)),
          ...diagnostiquerInfaisabilite(exigences, grille, sallesDisponibles, occupationExistante, indisponibilitesEnseignants, contraintes),
        ],
        suggestions: construireSuggestions(contraintes),
      };
    }

    const solution = extraireSeancesSolution(solver, placements, variables, exigences, grille, sallesDisponibles, aObjectif);
    const { seances, score } = solution;
    const nonPlacees = input.placementPartiel ? calculerHeuresNonPlacees(exigences, solution.placedExigenceIndexes) : [];

    const verificationTempsLibres = verifierContraintesTempsLibres(seances, grille, dureeResolutionMs, contraintes, reglesPedagogiquesDures);
    if ('proposition' in verificationTempsLibres) {
      return verificationTempsLibres.proposition;
    }

    const explicatifs = contraintes?.explicatifs
      ? construireExplicatifs(seances, exigences, sallesDisponibles, salleHabituelleId)
      : undefined;

    // --- Solutions multiples scorées (no-good re-solve, V2.5 §6) ---
    const solutionsAlternatives: { score: number; seances: SeanceProposee[] }[] = [];
    const sm = input.solutionsMultiples;
    if (sm) {
      const nombre = Math.max(1, Math.min(sm.nombre ?? 3, 5));
      const marge = sm.margeScore ?? 0;
      const gardeFou = debut + 5000;
      for (let k = 1; k < nombre; k++) {
        if (performance.now() > gardeFou) break;
        // no-good : au moins une variable retenue de la solution courante doit basculer.
        const retenues = placements
          .map((_, i) => (solver.value(variables[i]!) === 1 ? variables[i]! : null))
          .filter((v): v is NonNullable<typeof v> => v !== null);
        if (retenues.length === 0) break;
        model.addBoolOr(retenues.map(v => v.not()));
        // Borne d'objectif : ne garder que les alternatives à ≤ marge du score optimal.
        if (marge > 0 && objectifExpr) {
          model.addLinearConstraint(objectifExpr, score - marge, 1e9);
        }
        const statusK = await solver.solve(model, {
          numSearchWorkers: NB_WORKERS,
          maxDeterministicTime: input.maxDeterministicTime ?? 60,
        });
        const nomK = solver.statusName(statusK);
        if (nomK !== 'OPTIMAL' && nomK !== 'FEASIBLE') break;
        const alternative = extraireSeancesSolution(solver, placements, variables, exigences, grille, sallesDisponibles, aObjectif);
        solutionsAlternatives.push({ score: alternative.score, seances: alternative.seances });
      }
    }

    return {
      statut: nonPlacees.length > 0 ? 'PARTIEL' : statusName,
      seances,
      scoreObjectif: score,
      dureeResolutionMs,
      ...(nonPlacees.length > 0 ? { heuresNonPlacees: nonPlacees } : {}),
      ...(solutionsAlternatives.length > 0 ? { solutionsAlternatives } : {}),
      ...(explicatifs ? { explicatifs } : {}),
      ...(verificationTempsLibres.avertissements.length > 0 ? { avertissements: verificationTempsLibres.avertissements } : {}),
    };
  }

  private async diagnostiquerContraintesPedagogiques(input: ProposerEmploiDuTempsInput): Promise<string[]> {
    if (input.diagnosticInterne) return [];
    const relaxation = await this.proposer({
      ...input,
      contraintes: { ...(input.contraintes ?? {}), reglesPedagogiques: false },
      diagnosticInterne: true,
    });
    if (relaxation.statut === 'OPTIMAL' || relaxation.statut === 'FEASIBLE') {
      return ['Les règles pédagogiques de placement (occurrences par jour, contiguïté et répartition EPS/TM) rendent cette proposition impossible.'];
    }
    return [];
  }
}

function extraireSeancesSolution(
  solver: CpSolver,
  placements: Placement[],
  variables: BoolVar[],
  exigences: ExigenceSeance[],
  grille: CaseGrille[],
  sallesDisponibles: SalleDisponible[],
  aObjectif: boolean,
): { seances: SeanceProposee[]; score: number; placedExigenceIndexes: number[] } {
  const seances: SeanceProposee[] = [];
  const placedExigenceIndexes: number[] = [];
  for (let i = 0; i < placements.length; i++) {
    if (solver.value(variables[i]!) !== 1) continue;
    const { exigenceIdx, caseIdx, salleIdx } = placements[i]!;
    placedExigenceIndexes.push(exigenceIdx);
    const exigence = exigences[exigenceIdx]!;
    const caseGrille = grille[caseIdx]!;
    seances.push({
      subjectId: exigence.subjectId,
      teacherId: exigence.teacherId,
      roomId: sallesDisponibles[salleIdx]!.roomId,
      dayOfWeek: caseGrille.dayOfWeek,
      startTime: caseGrille.startTime,
      endTime: caseGrille.endTime,
    });
  }
  return { seances, score: aObjectif ? solver.objectiveValue() : 0, placedExigenceIndexes };
}

function verifierContraintesTempsLibres(
  seances: SeanceProposee[],
  grille: CaseGrille[],
  dureeResolutionMs: number,
  contraintes?: ProposerEmploiDuTempsInput['contraintes'],
  reglesPedagogiquesDures?: boolean,
): { ok: true; avertissements: string[] } | { ok: false; proposition: PropositionEmploiDuTemps } {
  const tempsLibres = maxTempsLibresParJour(seances, grille);
  const avertissements: string[] = [];

  if (contraintes?.interdireTempsLibresConsecutifs && aDesTempsLibresConsecutifs(seances, grille)) {
    if (reglesPedagogiquesDures) {
      return {
        ok: false,
        proposition: {
          statut: 'INFAISABLE',
          seances: [],
          scoreObjectif: 0,
          dureeResolutionMs,
          raisonInfaisabilite: 'Impossible de séparer tous les temps libres sans modifier le volume pédagogique.',
          problemes: ['Deux Temps libre consécutifs seraient nécessaires avec les contraintes actuelles.'],
          suggestions: ['Réduisez ou ajustez le volume pédagogique, ou configurez une journée avec davantage de créneaux disponibles.'],
        },
      };
    }
    avertissements.push('Temps libres consécutifs : préférence non respectée.');
  }

  if (contraintes?.maxTempsLibresParJour != null && tempsLibres > contraintes.maxTempsLibresParJour) {
    if (reglesPedagogiquesDures) {
      return {
        ok: false,
        proposition: {
          statut: 'INFAISABLE',
          seances: [],
          scoreObjectif: 0,
          dureeResolutionMs,
          raisonInfaisabilite: `La proposition dépasserait ${contraintes.maxTempsLibresParJour} Temps libre sur un même jour.`,
          problemes: [`Le placement obtenu contient plus de ${contraintes.maxTempsLibresParJour} Temps libre sur au moins un jour.`],
          suggestions: ['Réduisez le volume pédagogique ou augmentez les créneaux disponibles de la journée concernée.'],
        },
      };
    }
    avertissements.push(`Maximum de ${contraintes.maxTempsLibresParJour} temps libres/jour dépassé (maximum obtenu : ${tempsLibres}).`);
  }

  return { ok: true, avertissements };
}

/** Explain My Timetable (V2.5 §7) : une ligne par séance retenue. */
function construireExplicatifs(
  seances: SeanceProposee[],
  exigences: ExigenceSeance[],
  sallesDisponibles: SalleDisponible[],
  salleHabituelleId?: string,
): string[] {
  return seances.map(s => {
    const exigence = exigences.find(e => e.subjectId === s.subjectId);
    const salle = sallesDisponibles.find(r => r.roomId === s.roomId);
    const jour = NOMS_JOURS[s.dayOfWeek] ?? String(s.dayOfWeek);
    const raison = s.roomId === salleHabituelleId
      ? 'salle habituelle de la classe'
      : exigence?.subjectType === 'PRACTICAL'
        ? 'salle spécialisée exigée'
        : 'première salle compatible libre';
    return `${jour} ${s.startTime}-${s.endTime} · ${exigence?.subjectName ?? s.subjectId} (${exigence?.teacherName ?? s.teacherId}) · ${salle?.roomName ?? s.roomId} — ${raison}`;
  });
}

function maxTempsLibresParJour(seances: SeanceProposee[], grille: CaseGrille[]): number {
  const occupees = new Set(seances.map(seance => `${seance.dayOfWeek}|${seance.startTime}`));
  const parJour = new Map<number, CaseGrille[]>();
  for (const caseGrille of grille) {
    const cases = parJour.get(caseGrille.dayOfWeek) ?? [];
    cases.push(caseGrille);
    parJour.set(caseGrille.dayOfWeek, cases);
  }
  let maximum = 0;
  for (const cases of parJour.values()) {
    const libres = cases.filter(caseGrille => !occupees.has(`${caseGrille.dayOfWeek}|${caseGrille.startTime}`)).length;
    maximum = Math.max(maximum, libres);
  }
  return maximum;
}

function aDesTempsLibresConsecutifs(seances: SeanceProposee[], grille: CaseGrille[]): boolean {
  const occupees = new Set(seances.map(seance => `${seance.dayOfWeek}|${seance.startTime}`));
  const parJour = new Map<number, CaseGrille[]>();
  for (const caseGrille of grille) {
    const cases = parJour.get(caseGrille.dayOfWeek) ?? [];
    cases.push(caseGrille);
    parJour.set(caseGrille.dayOfWeek, cases);
  }
  for (const cases of parJour.values()) {
    cases.sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 0; i + 1 < cases.length; i++) {
      const current = cases[i]!;
      const suivant = cases[i + 1]!;
      if (current.endTime !== suivant.startTime) continue;
      if (!occupees.has(`${current.dayOfWeek}|${current.startTime}`) && !occupees.has(`${suivant.dayOfWeek}|${suivant.startTime}`)) return true;
    }
  }
  return false;
}

function calculerHeuresNonPlacees(
  exigences: ExigenceSeance[],
  indexesPlaces: number[],
): Array<{ subjectId: string; teacherId: string; teacherName?: string; nbHeures: number; cause: string }> {
  const places = new Set(indexesPlaces);
  const groupes = new Map<string, { subjectId: string; teacherId: string; teacherName?: string; minutes: number }>();
  exigences.forEach((exigence, index) => {
    if (places.has(index)) return;
    const key = `${exigence.subjectId}|${exigence.teacherId}`;
    const entry = groupes.get(key) ?? { subjectId: exigence.subjectId, teacherId: exigence.teacherId, teacherName: exigence.teacherName, minutes: 0 };
    entry.minutes += exigence.durationMinutes;
    groupes.set(key, entry);
  });
  return [...groupes.values()].map(entry => ({
    subjectId: entry.subjectId,
    teacherId: entry.teacherId,
    teacherName: entry.teacherName,
    nbHeures: entry.minutes / 60,
    cause: 'Aucune case libre compatible après maximisation des séances placées.',
  }));
}
