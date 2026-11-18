/**
 * INFRASTRUCTURE — Construction du modèle CP-SAT, solution de secours et diagnostic
 * d'infaisabilité pour l'adaptateur OR-Tools (extrait de ORToolsWasmAdapter.ts).
 */
import { CpModel, weightedSum } from 'or-tools-wasm/cp-sat';
import type { BoolVar, LinearExprLike } from 'or-tools-wasm/cp-sat';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type {
  CaseGrille,
  ContraintesDoucesOptions,
  CreneauOccupe,
  ExigenceSeance,
  IndisponibiliteEnseignant,
  ProposerEmploiDuTempsInput,
  PropositionEmploiDuTemps,
  SalleDisponible,
  SeanceProposee,
} from '@domain/ports/services/SchedulingSolverPort';
import { POIDS_NON_PLACEMENT } from '@domain/ports/services/SchedulingSolverPort';
import { modeliserContraintesDouces } from '@infrastructure/scheduling/contraintesDouces';
import type { Placement } from '@infrastructure/scheduling/contraintesDouces';

/** Poids de la seule contrainte souple de cette tranche (préférence salle habituelle). */
export const POIDS_SALLE_HABITUELLE = 10;

export type ModeleCpSatConstruit =
  | { ok: false; proposition: PropositionEmploiDuTemps }
  | {
      ok: true;
      model: CpModel;
      placements: Placement[];
      variables: BoolVar[];
      objectifExpr: LinearExprLike | null;
      aObjectif: boolean;
    };

export function construireModeleCpSat(input: ProposerEmploiDuTempsInput): ModeleCpSatConstruit {
  const {
    exigences,
    grille,
    sallesDisponibles,
    occupationExistante,
    salleHabituelleId,
    indisponibilitesEnseignants = [],
    contraintes,
  } = input;

  const model = new CpModel();
  const placements: Placement[] = [];
  const variables: BoolVar[] = [];

  for (let e = 0; e < exigences.length; e++) {
    const exigence = exigences[e]!;
    const sallesCompatibles = sallesDisponibles
      .map((salle, idx) => ({ salle, idx }))
      .filter(({ salle }) => salleAccepteMatiere(salle, exigence));

    if (sallesCompatibles.length === 0) {
      return {
        ok: false,
        proposition: {
          statut: 'INFAISABLE',
          seances: [],
          scoreObjectif: 0,
          dureeResolutionMs: 0,
          raisonInfaisabilite: `Aucune salle compatible pour une matière ${exigence.subjectType} (matière ${exigence.subjectName ?? exigence.subjectId}) — une matière pratique exige une salle spécialisée (laboratoire, atelier, salle informatique ou terrain).`,
          problemes: [`Aucune salle compatible pour ${exigence.subjectName ?? exigence.subjectId} (${exigence.subjectType}).`],
          suggestions: [`Créez ou libérez une salle spécialisée pour ${exigence.subjectName ?? exigence.subjectId}.`],
        },
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
        ok: false,
        proposition: {
          statut: 'INFAISABLE',
          seances: [],
          scoreObjectif: 0,
          dureeResolutionMs: 0,
          raisonInfaisabilite: `Aucun créneau libre pour ${exigence.subjectName ?? exigence.subjectId} : l'enseignant ou toutes les salles compatibles sont bloqués sur l'ensemble de la grille horaire.`,
          problemes: diagnostiquerInfaisabilite(exigences, grille, sallesDisponibles, occupationExistante, indisponibilitesEnseignants, contraintes),
          suggestions: [
            `Vérifiez les indisponibilités de ${exigence.teacherName ?? exigence.teacherId} et l'occupation des salles compatibles pour ${exigence.subjectName ?? exigence.subjectId}.`,
            ...construireSuggestions(contraintes),
          ],
        },
      };
    }
  }

  poserContraintesDures(model, placements, variables, input);

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

  return { ok: true, model, placements, variables, objectifExpr, aObjectif: termes.length > 0 };
}

function poserContraintesDures(
  model: CpModel,
  placements: Placement[],
  variables: BoolVar[],
  input: ProposerEmploiDuTempsInput,
): void {
  const { exigences, grille, sallesDisponibles, contraintes } = input;

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
}

export function construireSolutionSecours(
  exigences: ExigenceSeance[],
  grille: CaseGrille[],
  sallesDisponibles: SalleDisponible[],
  placements: Placement[],
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
    seances.push({
      subjectId: exigence.subjectId,
      teacherId: exigence.teacherId,
      roomId: salle.roomId,
      dayOfWeek: caseGrille.dayOfWeek,
      startTime: caseGrille.startTime,
      endTime: caseGrille.endTime,
    });
    if (salle.roomId === salleHabituelleId) score += POIDS_SALLE_HABITUELLE;
  }
  return { statut: 'FEASIBLE', seances, scoreObjectif: score };
}

export function diagnostiquerInfaisabilite(
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

export function construireSuggestions(options?: ContraintesDoucesOptions): string[] {
  const suggestions = [
    'Libérez un créneau occupé ou ajustez les indisponibilités des enseignants.',
    'Ajoutez une salle compatible si une matière pratique manque de place.',
    'Si le diagnostic indique les règles pédagogiques, vérifiez EPS/TM sur deux jours, les occurrences contiguës et les autres horaires déjà publiés.',
  ];
  if (options?.interdireTempsLibresConsecutifs) {
    suggestions.push('Réduisez le volume d\'une journée ou augmentez sa capacité pour séparer les Temps libre.');
  }
  if (options?.maxTempsLibresParJour != null) {
    suggestions.push(`Réduisez le volume pédagogique ou augmentez les créneaux disponibles pour respecter au maximum ${options.maxTempsLibresParJour} Temps libre par jour.`);
  }
  return suggestions;
}

/**
 * Contrainte dure n°5 — une matière PRACTICAL exige une salle spécialisée. THEORETICAL et MIXED
 * s'accommodent de toutes les salles (une salle normale convient pour un cours magistral,
 * et un labo peut accueillir un cours théorique sans que ce soit une erreur).
 */
function salleAccepteMatiere(salle: SalleDisponible, exigence: ExigenceSeance): boolean {
  if (exigence.subjectType !== 'PRACTICAL') return true;
  return salle.type !== 'NORMAL';
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

function variablesOu(
  placements: Placement[],
  variables: BoolVar[],
  predicat: (p: Placement) => boolean,
): BoolVar[] {
  const resultat: BoolVar[] = [];
  for (let i = 0; i < placements.length; i++) {
    if (predicat(placements[i]!)) resultat.push(variables[i]!);
  }
  return resultat;
}
