/**
 * INFRASTRUCTURE — Évaluateurs unitaires des contraintes douces V2.5 (CP-SAT).
 *
 * Chaque fonction est PURE : elle reçoit les structures agrégées (y, pres, occupation, parJour)
 * et retourne des termes d'objectif signés (TermeObjectif[]), sans jamais appeler solve().
 */
import { weightedSum } from 'or-tools-wasm/cp-sat';
import type { CpModel, BoolVar, LinearExprLike } from 'or-tools-wasm/cp-sat';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type { CaseGrille } from '@domain/ports/services/SchedulingSolverPort';
import {
  POIDS_TEMPS_LIBRES_CONSECUTIFS,
  POIDS_TEMPS_LIBRES_INTERNE,
  POIDS_TEMPS_LIBRES_DEBUT_JOURNEE,
  POIDS_TEMPS_LIBRES_FIN_JOURNEE,
  POIDS_TEMPS_LIBRES_MAX_JOUR,
} from '@domain/ports/services/SchedulingSolverPort';

/** Un terme de l'objectif final : une expression et son coefficient signé. */
export type TermeObjectif = { terme: LinearExprLike; coeff: number };

export function construireCasesOccupees(model: CpModel, y: (BoolVar | null)[][], nbCases: number): BoolVar[] {
  return Array.from({ length: nbCases }, (_, c) => {
    const vars = y.map(row => row[c]).filter((variable): variable is BoolVar => variable !== null);
    const variable = model.newBoolVar(`case_occupee_${c}`);
    model.addEquality(variable, vars.length === 0 ? 0 : weightedSum(vars, vars.map(() => 1)));
    return variable;
  });
}

export function penaliteTempsLibresPosition(
  model: CpModel,
  occupation: BoolVar[],
  parJour: Map<number, number[]>,
): TermeObjectif[] {
  const termes: TermeObjectif[] = [];
  for (const cases of parJour.values()) {
    for (const [index, caseIdx] of cases.entries()) {
      const libre = model.newBoolVar(`temps_libre_position_${caseIdx}`);
      model.addEquality(libre, occupation[caseIdx]!.not());
      const poids = index === 0
        ? POIDS_TEMPS_LIBRES_DEBUT_JOURNEE
        : index === cases.length - 1
          ? POIDS_TEMPS_LIBRES_FIN_JOURNEE
          : POIDS_TEMPS_LIBRES_INTERNE;
      termes.push({ terme: libre, coeff: -poids });
    }
  }
  return termes;
}

export function penaliteTempsLibresMax(
  model: CpModel,
  occupation: BoolVar[],
  parJour: Map<number, number[]>,
  maximum: number,
): TermeObjectif[] {
  const termes: TermeObjectif[] = [];
  for (const cases of parJour.values()) {
    const variablesLibres = cases.map(caseIdx => {
      const variable = model.newBoolVar(`temps_libre_max_${caseIdx}`);
      model.addEquality(variable, occupation[caseIdx]!.not());
      return variable;
    });
    const count = model.newIntVar(0, cases.length, `temps_libre_count_${cases[0]}`);
    model.addEquality(count, weightedSum(variablesLibres, variablesLibres.map(() => 1)));
    const capacity = cases.length;
    for (let k = maximum + 1; k <= capacity; k++) {
      const over = model.newBoolVar(`temps_libre_over_${k}_${cases[0]}`);
      model.addLinearConstraint(weightedSum([count, over], [1, -capacity]), k - capacity, 1e9);
      model.addLinearConstraint(weightedSum([count, over], [1, -capacity]), -1e9, k - 1);
      termes.push({ terme: over, coeff: -POIDS_TEMPS_LIBRES_MAX_JOUR });
    }
  }
  return termes;
}

export function penaliteTempsLibresConsecutifs(
  model: CpModel,
  occupation: BoolVar[],
  parJour: Map<number, number[]>,
  grille: CaseGrille[],
): TermeObjectif[] {
  const termes: TermeObjectif[] = [];
  for (const cases of parJour.values()) {
    for (let i = 0; i + 1 < cases.length; i++) {
      const current = cases[i]!;
      const suivant = cases[i + 1]!;
      if (grille[suivant]!.startTime !== grille[current]!.endTime) continue;
      const currentOccupee = occupation[current]!;
      const suivantOccupee = occupation[suivant]!;
      const consecutifs = model.newBoolVar(`temps_libres_consecutifs_${current}`);
      model.addImplication(consecutifs, currentOccupee.not());
      model.addImplication(consecutifs, suivantOccupee.not());
      model.addBoolOr([consecutifs, currentOccupee, suivantOccupee]);
      termes.push({ terme: consecutifs, coeff: -POIDS_TEMPS_LIBRES_CONSECUTIFS });
    }
  }
  return termes;
}

/** Pénalité « trou enseignant » : interstices vides dans la journée d'un enseignant. */
export function penaliteTrou(
  model: CpModel,
  pres: Map<string, (BoolVar | null)[]>,
  parJour: Map<number, number[]>,
  poids: number,
): TermeObjectif[] {
  const termes: TermeObjectif[] = [];
  for (const [teacherId, presTeacher] of pres) {
    for (const [jour, indices] of parJour) {
      const k = indices.length;
      if (k === 0) continue;

      const exprsFirst: LinearExprLike[] = [];
      const exprsLast: LinearExprLike[] = [];
      let aDesCasesPossibles = false;
      for (let local = 0; local < k; local++) {
        const p = presTeacher[indices[local]!];
        if (p === null) continue;
        aDesCasesPossibles = true;
        // pres_i = 1 → i ; pres_i = 0 → k  (min = première case occupée, ou k si aucune)
        exprsFirst.push(lineaire(model, [{ coeff: -(k - local), valeur: p }], k));
        // pres_i = 1 → i ; pres_i = 0 → -1 (max = dernière case occupée, ou -1 si aucune)
        exprsLast.push(lineaire(model, [{ coeff: local + 1, valeur: p }], -1));
      }
      if (!aDesCasesPossibles) continue;

      const first = model.newIntVar(0, k, `first_${teacherId}_${jour}`);
      const last = model.newIntVar(-1, k - 1, `last_${teacherId}_${jour}`);
      model.addMinEquality(first, exprsFirst);
      model.addMaxEquality(last, exprsLast);

      const presJour = indices.map(i => presTeacher[i]!).filter((v): v is BoolVar => v !== null);
      const nb = weightedSum(presJour, presJour.map(() => 1));

      const trous = model.newIntVar(0, k, `trous_${teacherId}_${jour}`);
      const ecart = lineaire(
        model,
        [{ coeff: 1, valeur: last }, { coeff: -1, valeur: first }, { coeff: -1, valeur: nb }],
        1,
      );
      model.addMaxEquality(trous, [model.newConstant(0), ecart]);

      termes.push({ terme: trous, coeff: -poids });
    }
  }
  return termes;
}

/** Pénalité « trois cours consécutifs » : triplet de cases consécutives toutes occupées. */
export function penaliteTroisConsecutifs(
  model: CpModel,
  pres: Map<string, (BoolVar | null)[]>,
  parJour: Map<number, number[]>,
  poids: number,
): TermeObjectif[] {
  const termes: TermeObjectif[] = [];
  for (const [teacherId, presTeacher] of pres) {
    for (const [jour, indices] of parJour) {
      const k = indices.length;
      for (let local = 0; local + 2 < k; local++) {
        const p0 = presTeacher[indices[local]!];
        const p1 = presTeacher[indices[local + 1]!];
        const p2 = presTeacher[indices[local + 2]!];
        if (p0 === null || p1 === null || p2 === null) continue;

        const tri = model.newBoolVar(`tri_${teacherId}_${jour}_${local}`);
        // tri ≥ p0 + p1 + p2 − 2  ⇔  p0+p1+p2−2−tri ≤ 0. À l'optimum tri = max(0, somme−2).
        const expr = lineaire(
          model,
          [
            { coeff: 1, valeur: p0 }, { coeff: 1, valeur: p1 }, { coeff: 1, valeur: p2 },
            { coeff: -1, valeur: tri },
          ],
          -2,
        );
        model.addLinearConstraint(expr, -k, 0);

        termes.push({ terme: tri, coeff: -poids });
      }
    }
  }
  return termes;
}

/** Pénalité « équilibrage semaine » : écart de charge (en cases) entre le jour le plus et le moins chargé. */
export function penaliteEquilibrage(
  model: CpModel,
  y: (BoolVar | null)[][],
  parJour: Map<number, number[]>,
  nbExigences: number,
  poids: number,
): TermeObjectif[] {
  const jours = [...parJour.keys()];
  if (jours.length < 2) return [];

  const volJour: LinearExprLike[] = [];
  for (const jour of jours) {
    const indices = parJour.get(jour)!;
    const vars: BoolVar[] = [];
    for (let e = 0; e < y.length; e++) {
      for (const c of indices) {
        const yv = y[e]![c];
        if (yv !== null) vars.push(yv);
      }
    }
    if (vars.length === 0) {
      volJour.push(model.newConstant(0));
      continue;
    }
    const v = model.newIntVar(0, nbExigences, `vol_${jour}`);
    model.addEquality(v, weightedSum(vars, vars.map(() => 1)));
    volJour.push(v);
  }

  const minV = model.newIntVar(0, nbExigences, 'minV');
  const maxV = model.newIntVar(0, nbExigences, 'maxV');
  model.addMinEquality(minV, volJour);
  model.addMaxEquality(maxV, volJour);

  const ecart = lineaire(model, [{ coeff: 1, valeur: maxV }, { coeff: -1, valeur: minV }]);
  return [{ terme: ecart, coeff: -poids }];
}

/** Pénalité « volume max par enseignant par jour » : surplus de cases au-delà du plafond. */
export function penaliteVolumeJour(
  model: CpModel,
  pres: Map<string, (BoolVar | null)[]>,
  parJour: Map<number, number[]>,
  capCases: number,
  poids: number,
): TermeObjectif[] {
  const termes: TermeObjectif[] = [];
  for (const [teacherId, presTeacher] of pres) {
    for (const [jour, indices] of parJour) {
      const presJour = indices.map(i => presTeacher[i]!).filter((v): v is BoolVar => v !== null);
      if (presJour.length === 0) continue;

      const volT = model.newIntVar(0, presJour.length, `volT_${teacherId}_${jour}`);
      model.addEquality(volT, weightedSum(presJour, presJour.map(() => 1)));

      const surplus = model.newIntVar(0, presJour.length, `surplus_${teacherId}_${jour}`);
      const depassement = lineaire(model, [{ coeff: 1, valeur: volT }], -capCases);
      model.addMaxEquality(surplus, [model.newConstant(0), depassement]);

      termes.push({ terme: surplus, coeff: -poids });
    }
  }
  return termes;
}

/** Expression linéaire avec constante : Σ coeffᵢ·valeurᵢ + constante. */
export function lineaire(
  model: CpModel,
  termes: { coeff: number; valeur: LinearExprLike }[],
  constante = 0,
): LinearExprLike {
  const valeurs: LinearExprLike[] = termes.map(t => t.valeur);
  const coeffs = termes.map(t => t.coeff);
  if (constante !== 0) {
    valeurs.push(model.newConstant(constante));
    coeffs.push(1);
  }
  return weightedSum(valeurs, coeffs);
}

/** Durée d'une case en minutes (grille homogène — la 1ʳᵉ case fait foi). */
export function dureeCaseMinutes(grille: CaseGrille[]): number {
  if (grille.length === 0) return 60;
  const debut = CreneauHoraire.heureEnMinutes(grille[0]!.startTime);
  const fin = CreneauHoraire.heureEnMinutes(grille[0]!.endTime);
  const d = fin - debut;
  return d > 0 ? d : 60;
}
