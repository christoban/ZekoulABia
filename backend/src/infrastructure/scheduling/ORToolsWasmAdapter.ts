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
import { CpModel, CpSolver, weightedSum, setWorkerBridgeEnabled } from 'or-tools-wasm/cp-sat';
import type { LinearExprLike } from 'or-tools-wasm/cp-sat';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type {
  SchedulingSolverPort,
  ProposerEmploiDuTempsInput,
  PropositionEmploiDuTemps,
  SeanceProposee,
  ExigenceSeance,
  CaseGrille,
  SalleDisponible,
  CreneauOccupe,
  IndisponibiliteEnseignant,
  ContraintesDoucesOptions,
} from '@domain/ports/services/SchedulingSolverPort';
import { modeliserContraintesDouces } from '@infrastructure/scheduling/contraintesDouces';
import type { Placement } from '@infrastructure/scheduling/contraintesDouces';
import { NOMS_JOURS } from '@domain/types/joursSemaine';
import { POIDS_NON_PLACEMENT } from '@domain/ports/services/SchedulingSolverPort';

/** Poids de la seule contrainte souple de cette tranche (préférence salle habituelle). */
const POIDS_SALLE_HABITUELLE = 10;

/** Nombre de workers CP-SAT — 1 suffit très largement à cette taille de problème (cf. spike). */
const NB_WORKERS = 1;

export class ORToolsWasmAdapter implements SchedulingSolverPort {
  constructor() {
    setWorkerBridgeEnabled(true);
  }

  async proposer(input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> {
    const { exigences, grille, sallesDisponibles, occupationExistante, salleHabituelleId, indisponibilitesEnseignants = [], contraintes, reglesPedagogiquesDures } = input;

    if (exigences.length === 0) {
      return { statut: 'OPTIMAL', seances: [], scoreObjectif: 0, dureeResolutionMs: 0 };
    }
    if (grille.length === 0) {
      return {
        statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs: 0,
        raisonInfaisabilite: "La grille horaire de l'établissement ne contient aucun créneau — configurez-la avant de proposer un emploi du temps.",
      };
    }

    const model = new CpModel();

    // --- Variables : uniquement les placements RÉELLEMENT possibles ---
    const placements: Placement[] = [];
    const variables: ReturnType<CpModel['newBoolVar']>[] = [];

    for (let e = 0; e < exigences.length; e++) {
      const exigence = exigences[e]!;
      const sallesCompatibles = sallesDisponibles
        .map((salle, idx) => ({ salle, idx }))
        .filter(({ salle }) => salleAccepteMatiere(salle, exigence));

      if (sallesCompatibles.length === 0) {
        return {
          statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs: 0,
           raisonInfaisabilite: `Aucune salle compatible pour une matière ${exigence.subjectType} (matière ${exigence.subjectName ?? exigence.subjectId}) — une matière pratique exige une salle spécialisée (laboratoire, atelier, salle informatique ou terrain).`,
           problemes: [`Aucune salle compatible pour ${exigence.subjectName ?? exigence.subjectId} (${exigence.subjectType}).`],
           suggestions: [`Créez ou libérez une salle spécialisée pour ${exigence.subjectName ?? exigence.subjectId}.`],

        };
      }

      let placementsPourCetteExigence = 0;
      for (let c = 0; c < grille.length; c++) {
        const caseGrille = grille[c]!;
        if (estOccupe(occupationExistante, caseGrille, { teacherId: exigence.teacherId })) continue;
        if (estIndisponible(indisponibilitesEnseignants, caseGrille, exigence.teacherId)) continue;

        for (const { salle, idx: s } of sallesCompatibles) {
          if (estOccupe(occupationExistante, caseGrille, { roomId: salle.roomId })) continue;

          placements.push({ exigenceIdx: e, caseIdx: c, salleIdx: s });
          variables.push(model.newBoolVar(`x_${e}_${c}_${s}`));
          placementsPourCetteExigence++;
        }
      }

      if (placementsPourCetteExigence === 0 && !input.placementPartiel) {
        return {
          statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs: 0,
           raisonInfaisabilite: `Aucun créneau libre pour ${exigence.subjectName ?? exigence.subjectId} : l'enseignant ou toutes les salles compatibles sont bloqués sur l'ensemble de la grille horaire.`,
           problemes: diagnostiquerInfaisabilite(exigences, grille, sallesDisponibles, occupationExistante, indisponibilitesEnseignants, contraintes),
           suggestions: [
             `Vérifiez les indisponibilités de ${exigence.teacherName ?? exigence.teacherId} et l'occupation des salles compatibles pour ${exigence.subjectName ?? exigence.subjectId}.`,
             ...construireSuggestions(contraintes),
           ],

        };
      }
    }

    if (!input.placementPartiel) {
      for (let e = 0; e < exigences.length; e++) {
        model.addExactlyOne(variablesOu(placements, variables, p => p.exigenceIdx === e));
      }
    } else {
      for (let e = 0; e < exigences.length; e++) {
        const candidates = variablesOu(placements, variables, p => p.exigenceIdx === e);
        if (candidates.length > 0) model.addAtMostOne(candidates);
      }
    }

    // --- Contrainte 2 (DURE) : la classe ne suit qu'une séance à la fois ---
    if (contraintes?.conflitClasse !== false) {
      for (let c = 0; c < grille.length; c++) {
        const vars = variablesOu(placements, variables, p => p.caseIdx === c);
        if (vars.length > 1) model.addAtMostOne(vars);
      }
    }

    // --- Contrainte 3 (DURE) : conflit enseignant ---
    if (contraintes?.conflitEnseignant !== false) {
      const enseignants = [...new Set(exigences.map(e => e.teacherId))];
      for (const teacherId of enseignants) {
        for (let c = 0; c < grille.length; c++) {
          const vars = variablesOu(
            placements, variables,
            p => p.caseIdx === c && exigences[p.exigenceIdx]!.teacherId === teacherId,
          );
          if (vars.length > 1) model.addAtMostOne(vars);
        }
      }
    }

    // --- Contrainte 4 (DURE) : conflit salle ---
    if (contraintes?.conflitSalle !== false) {
      for (let s = 0; s < sallesDisponibles.length; s++) {
        for (let c = 0; c < grille.length; c++) {
          const vars = variablesOu(placements, variables, p => p.caseIdx === c && p.salleIdx === s);
          if (vars.length > 1) model.addAtMostOne(vars);
        }
      }
    }

    // --- Objectif (SOUPLE) : salle habituelle + contraintes douces V2.5, en UN SEUL maximize ---
    const termes: { terme: LinearExprLike; coeff: number }[] = [];
    if (salleHabituelleId) {
      for (let i = 0; i < placements.length; i++) {
        if (sallesDisponibles[placements[i]!.salleIdx]!.roomId === salleHabituelleId) {
          termes.push({ terme: variables[i]!, coeff: POIDS_SALLE_HABITUELLE });
        }
      }
    }
    // Contraintes douces V2.5 (pénalités) + blocs de 2 h (DUR, §4) — un seul appel, qui gère
    // aussi le cas options = undefined (blocs actifs par défaut, aucune pénalité).
    if (input.placementPartiel) {
      for (const variable of variables) termes.push({ terme: variable, coeff: POIDS_NON_PLACEMENT });
    }
    termes.push(...modeliserContraintesDouces({ model, placements, variables, exigences, grille, options: contraintes }));
    let objectifExpr: LinearExprLike | null = null;
    if (termes.length > 0) {
      objectifExpr = weightedSum(termes.map(t => t.terme), termes.map(t => t.coeff));
      model.maximize(objectifExpr);
    }

    // --- Résolution ---
    const solver = new CpSolver();
    const debut = performance.now();
     // maxDeterministicTime est utilisé à la place d'une limite murale : la recherche reste reproductible,
    // mais la durée réelle peut varier selon la machine et la complexité restante.
    const status = await solver.solve(model, { numSearchWorkers: NB_WORKERS, maxDeterministicTime: input.maxDeterministicTime ?? 60 });
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
        statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs,
        raisonInfaisabilite: `Aucune combinaison ne satisfait toutes les contraintes (statut solveur : ${statusName}).`,
         problemes: [
           ...(await this.diagnostiquerContraintesPedagogiques(input)),
           ...diagnostiquerInfaisabilite(exigences, grille, sallesDisponibles, occupationExistante, indisponibilitesEnseignants, contraintes),
         ],
         suggestions: construireSuggestions(contraintes),

      };
    }

    // --- Extraire les séances retenues + score (réutilisé pour les alternatives) ---
    const extraire = (): { seances: SeanceProposee[]; score: number; placedExigenceIndexes: number[] } => {
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
      return { seances, score: termes.length > 0 ? solver.objectiveValue() : 0, placedExigenceIndexes };
    };

    const solution = extraire();
    const { seances, score } = solution;
    const nonPlacees = input.placementPartiel ? calculerHeuresNonPlacees(exigences, solution.placedExigenceIndexes) : [];

    const tempsLibres = maxTempsLibresParJour(seances, grille);
    const avertissementsTempsLibres: string[] = [];
    if (contraintes?.interdireTempsLibresConsecutifs && aDesTempsLibresConsecutifs(seances, grille)) {
      if (reglesPedagogiquesDures) {
        return {
          statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs,
          raisonInfaisabilite: 'Impossible de séparer tous les temps libres sans modifier le volume pédagogique.',
          problemes: ['Deux Temps libre consécutifs seraient nécessaires avec les contraintes actuelles.'],
          suggestions: ['Réduisez ou ajustez le volume pédagogique, ou configurez une journée avec davantage de créneaux disponibles.'],
        };
      }
      avertissementsTempsLibres.push('Temps libres consécutifs : préférence non respectée.');
    }
    if (contraintes?.maxTempsLibresParJour != null && tempsLibres > contraintes.maxTempsLibresParJour) {
      if (reglesPedagogiquesDures) {
        return {
          statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs,
          raisonInfaisabilite: `La proposition dépasserait ${contraintes.maxTempsLibresParJour} Temps libre sur un même jour.`,
          problemes: [`Le placement obtenu contient plus de ${contraintes.maxTempsLibresParJour} Temps libre sur au moins un jour.`],
          suggestions: ['Réduisez le volume pédagogique ou augmentez les créneaux disponibles de la journée concernée.'],
        };
      }
      avertissementsTempsLibres.push(`Maximum de ${contraintes.maxTempsLibresParJour} temps libres/jour dépassé (maximum obtenu : ${tempsLibres}).`);
    }

    // --- Explain My Timetable (V2.5 §7) : une ligne par séance retenue ---
    let explicatifs: string[] | undefined;
    if (contraintes?.explicatifs) {
      explicatifs = seances.map(s => {
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
         const statusK = await solver.solve(model, { numSearchWorkers: NB_WORKERS, maxDeterministicTime: input.maxDeterministicTime ?? 60 });
        const nomK = solver.statusName(statusK);
        if (nomK !== 'OPTIMAL' && nomK !== 'FEASIBLE') break;
         const alternative = extraire();
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
       ...(avertissementsTempsLibres.length > 0 ? { avertissements: avertissementsTempsLibres } : {}),
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

function construireSolutionSecours(
  exigences: ExigenceSeance[],
  grille: CaseGrille[],
  sallesDisponibles: SalleDisponible[],
  placements: { exigenceIdx: number; caseIdx: number; salleIdx: number }[],
  salleHabituelleId?: string,
): { statut: 'FEASIBLE'; seances: SeanceProposee[]; scoreObjectif: number } | null {
  const casesOccupees = new Set<string>();
  const enseignantsOccupes = new Set<string>();
  const sallesOccupees = new Set<string>();
  const seances: SeanceProposee[] = [];
  let score = 0;
  const ordre = exigences.map((_, index) => index).sort((a, b) => {
    const countA = placements.filter(placement => placement.exigenceIdx === a).length;
    const countB = placements.filter(placement => placement.exigenceIdx === b).length;
    return countA - countB;
  });

  for (const exigenceIdx of ordre) {
    const candidates = placements
      .filter(placement => placement.exigenceIdx === exigenceIdx)
      .sort((a, b) => {
        const salleA = sallesDisponibles[a.salleIdx]!.roomId === salleHabituelleId ? 1 : 0;
        const salleB = sallesDisponibles[b.salleIdx]!.roomId === salleHabituelleId ? 1 : 0;
        return salleB - salleA;
      });
    const place = candidates.find(candidate => {
      const caseGrille = grille[candidate.caseIdx]!;
      const salle = sallesDisponibles[candidate.salleIdx]!;
      const cleCase = `${caseGrille.dayOfWeek}|${caseGrille.startTime}|${caseGrille.endTime}`;
      const cleEnseignant = `${exigences[exigenceIdx]!.teacherId}|${cleCase}`;
      const cleSalle = `${salle.roomId}|${cleCase}`;
      return !casesOccupees.has(cleCase) && !enseignantsOccupes.has(cleEnseignant) && !sallesOccupees.has(cleSalle);
    });
    if (!place) return null;
    const exigence = exigences[exigenceIdx]!;
    const caseGrille = grille[place.caseIdx]!;
    const salle = sallesDisponibles[place.salleIdx]!;
    const cleCase = `${caseGrille.dayOfWeek}|${caseGrille.startTime}|${caseGrille.endTime}`;
    const cleEnseignant = `${exigence.teacherId}|${cleCase}`;
    const cleSalle = `${salle.roomId}|${cleCase}`;
    casesOccupees.add(cleCase);
    enseignantsOccupes.add(cleEnseignant);
    sallesOccupees.add(cleSalle);
    seances.push({ subjectId: exigence.subjectId, teacherId: exigence.teacherId, roomId: salle.roomId, dayOfWeek: caseGrille.dayOfWeek, startTime: caseGrille.startTime, endTime: caseGrille.endTime });
    if (salle.roomId === salleHabituelleId) score += POIDS_SALLE_HABITUELLE;
  }
  return { statut: 'FEASIBLE', seances, scoreObjectif: score };
}

function diagnostiquerInfaisabilite(
  exigences: ExigenceSeance[],
  grille: CaseGrille[],
  sallesDisponibles: SalleDisponible[],
  occupationExistante: CreneauOccupe[],
  indisponibilites: IndisponibiliteEnseignant[],
  options?: ContraintesDoucesOptions,
): string[] {
  const problemes: string[] = [];
  for (const exigence of exigences) {
    const sallesCompatibles = sallesDisponibles.filter(salle => salleAccepteMatiere(salle, exigence));
    if (sallesCompatibles.length === 0) {
      problemes.push(`Aucune salle compatible pour ${exigence.subjectName ?? exigence.subjectId}.`);
      continue;
    }
    const casesDisponibles = grille.filter(caseGrille =>
      !estOccupe(occupationExistante, caseGrille, { teacherId: exigence.teacherId }) &&
      !indisponibilites.some(indisponibilite =>
        indisponibilite.teacherId === exigence.teacherId && estOccupe([indisponibilite], caseGrille, { teacherId: exigence.teacherId }),
      ) &&
      sallesCompatibles.some(salle => !estOccupe(occupationExistante, caseGrille, { roomId: salle.roomId })),
    );
    if (casesDisponibles.length === 0) {
      const indisponible = indisponibilites.some(indisponibilite => indisponibilite.teacherId === exigence.teacherId);
      const casesEnseignantLibres = grille.filter(caseGrille =>
        !estOccupe(occupationExistante, caseGrille, { teacherId: exigence.teacherId }) &&
        !indisponibilites.some(indisponibilite => indisponibilite.teacherId === exigence.teacherId && estOccupe([indisponibilite], caseGrille, { teacherId: exigence.teacherId })),
      ).length;
      if (casesEnseignantLibres === 0) {
        problemes.push(`${exigence.subjectName ?? exigence.subjectId} / ${exigence.teacherName ?? exigence.teacherId} n'a aucune case disponible : l'enseignant est occupé ou déclaré indisponible sur toute la grille.`);
      } else {
        problemes.push(`${exigence.subjectName ?? exigence.subjectId} n'a aucune salle compatible libre${indisponible ? ' et l\'enseignant possède une indisponibilité' : ''}.`);
      }
    }
  }
  const parEnseignant = new Map<string, { nom: string; occurrences: number; matieres: string[] }>();
  for (const exigence of exigences) {
    const courant = parEnseignant.get(exigence.teacherId) ?? { nom: exigence.teacherName ?? exigence.teacherId, occurrences: 0, matieres: [] };
    courant.occurrences += 1;
    courant.matieres.push(exigence.subjectName ?? exigence.subjectId);
    parEnseignant.set(exigence.teacherId, courant);
  }
  for (const [teacherId, info] of parEnseignant) {
    const casesLibres = grille.filter(caseGrille =>
      !estOccupe(occupationExistante, caseGrille, { teacherId }) &&
      !indisponibilites.some(indisponibilite => indisponibilite.teacherId === teacherId && estOccupe([indisponibilite], caseGrille, { teacherId })),
    ).length;
    if (info.occurrences > casesLibres) {
      problemes.push(`${info.nom} porte ${info.occurrences} séances (${info.matieres.join(', ')}), mais seulement ${casesLibres} créneaux sont libres : libérez ${info.occurrences - casesLibres} créneaux ou réaffectez la matière.`);
    }
  }
  if (options?.interdireTempsLibresConsecutifs) {
    problemes.push('La séparation des Temps libre consécutifs ne peut pas être obtenue avec les contraintes actuelles.');
  }
  if (options?.maxTempsLibresParJour != null) {
    problemes.push(`La limite de ${options.maxTempsLibresParJour} Temps libre par jour entre en conflit avec les autres contraintes.`);
  }
  if (problemes.length === 0) {
    problemes.push('Chaque séance possède des cases candidates, mais aucune combinaison globale ne respecte simultanément toutes les contraintes.');
  }
  return [...new Set(problemes)].slice(0, 8);
}

function construireSuggestions(options?: ContraintesDoucesOptions): string[] {
  const suggestions = ['Libérez un créneau occupé ou ajustez les indisponibilités des enseignants.', 'Ajoutez une salle compatible si une matière pratique manque de place.'];
  suggestions.push('Si le diagnostic indique les règles pédagogiques, vérifiez EPS/TM sur deux jours, les occurrences contiguës et les autres horaires déjà publiés.');
  if (options?.interdireTempsLibresConsecutifs) suggestions.push('Réduisez le volume d\'une journée ou augmentez sa capacité pour séparer les Temps libre.');
  if (options?.maxTempsLibresParJour != null) suggestions.push(`Réduisez le volume pédagogique ou augmentez les créneaux disponibles pour respecter au maximum ${options.maxTempsLibresParJour} Temps libre par jour.`);
  return suggestions;
}

/**
 * Contrainte dure n°5 — une matière PRACTICAL exige une salle spécialisée. THEORETICAL et MIXED
 * s'accommodent de n'importe quelle salle (une salle normale convient pour un cours magistral,
 * et un labo peut accueillir un cours théorique sans que ce soit une erreur).
 */
function salleAccepteMatiere(salle: SalleDisponible, exigence: ExigenceSeance): boolean {
  if (exigence.subjectType !== 'PRACTICAL') return true;
  return salle.type !== 'NORMAL';
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

/**
 * Chevauchement horaire avec un créneau déjà occupé ailleurs dans l'école. Réutilise la même
 * arithmétique que CreneauHoraire (debut < finExistant && fin > debutExistant) — la règle de
 * chevauchement n'existe qu'à un seul endroit dans le code.
 */
function estOccupe(
  occupation: CreneauOccupe[],
  caseGrille: CaseGrille,
  cible: { teacherId?: string; roomId?: string },
): boolean {
  const debut = CreneauHoraire.heureEnMinutes(caseGrille.startTime);
  const fin = CreneauHoraire.heureEnMinutes(caseGrille.endTime);

  return occupation.some(occupe => {
    if (occupe.dayOfWeek !== caseGrille.dayOfWeek) return false;
    const memeCible =
      (cible.teacherId !== undefined && occupe.teacherId === cible.teacherId) ||
      (cible.roomId !== undefined && occupe.roomId === cible.roomId);
    if (!memeCible) return false;

    const occupeDebut = CreneauHoraire.heureEnMinutes(occupe.startTime);
    const occupeFin = CreneauHoraire.heureEnMinutes(occupe.endTime);
    return debut < occupeFin && fin > occupeDebut;
  });
}

/**
 * Contrainte DURE V2.4 — un enseignant indisponible sur une plage ne peut recevoir aucune séance
 * qui la chevauche. Même arithmétique de chevauchement que CreneauHoraire (une seule source).
 */
function estIndisponible(
  indisponibilites: IndisponibiliteEnseignant[],
  caseGrille: CaseGrille,
  teacherId: string,
): boolean {
  if (indisponibilites.length === 0) return false;
  const debut = CreneauHoraire.heureEnMinutes(caseGrille.startTime);
  const fin = CreneauHoraire.heureEnMinutes(caseGrille.endTime);

  return indisponibilites.some(indispo => {
    if (indispo.teacherId !== teacherId) return false;
    if (indispo.dayOfWeek !== caseGrille.dayOfWeek) return false;
    const indispoDebut = CreneauHoraire.heureEnMinutes(indispo.startTime);
    const indispoFin = CreneauHoraire.heureEnMinutes(indispo.endTime);
    return debut < indispoFin && fin > indispoDebut;
  });
}

function calculerHeuresNonPlacees(exigences: ExigenceSeance[], indexesPlaces: number[]): Array<{ subjectId: string; teacherId: string; teacherName?: string; nbHeures: number; cause: string }> {
  const places = new Set(indexesPlaces);
  const groupes = new Map<string, { subjectId: string; teacherId: string; teacherName?: string; minutes: number }>();
  exigences.forEach((exigence, index) => {
    if (places.has(index)) return;
    const key = `${exigence.subjectId}|${exigence.teacherId}`;
    const entry = groupes.get(key) ?? { subjectId: exigence.subjectId, teacherId: exigence.teacherId, teacherName: exigence.teacherName, minutes: 0 };
    entry.minutes += exigence.durationMinutes;
    groupes.set(key, entry);
  });
  return [...groupes.values()].map(entry => ({ ...entry, nbHeures: entry.minutes / 60, cause: 'Aucune case libre compatible après maximisation des séances placées.' })).map(({ subjectId, teacherId, teacherName, nbHeures, cause }) => ({ subjectId, teacherId, teacherName, nbHeures, cause }));
}

function variablesOu(
  placements: { exigenceIdx: number; caseIdx: number; salleIdx: number }[],
  variables: ReturnType<CpModel['newBoolVar']>[],
  predicat: (p: { exigenceIdx: number; caseIdx: number; salleIdx: number }) => boolean,
): ReturnType<CpModel['newBoolVar']>[] {
  const resultat: ReturnType<CpModel['newBoolVar']>[] = [];
  for (let i = 0; i < placements.length; i++) {
    if (predicat(placements[i]!)) resultat.push(variables[i]!);
  }
  return resultat;
}
