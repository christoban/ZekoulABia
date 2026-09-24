/**
 * INFRASTRUCTURE — Modélisation des contraintes douces V2.5 (CP-SAT).
 *
 * Extrait du ORToolsWasmAdapter pour garder l'adaptateur sous 500 lignes (AGENTS §4.1) et isoler
 * la logique de pénalité du collage solveur. Chaque fonction est PURE : elle prend le modèle, les
 * variables et les options, et retourne des termes d'objectif signés — jamais d'appel à solve().
 *
 * Conventions :
 *   - TermeObjectif.coeff SIGNÉ : positif = bonus (salle habituelle), négatif = pénalité.
 *   - Unités en « cases » (pas minutes) : une case = dureeCase minutes (grille homogène). C'est ce
 *     qui garde les poids comparables à POIDS_SALLE_HABITUELLE = 10 (voir PLAN_V2.5).
 *   - Astuce « borne inférieure » : trous et surplus sont des minima que la maximisation pousse
 *     vers le bas ; addMaxEquality(x, [0, expr]) force x = max(0, expr) exactement.
 *
 * Variables agrégées :
 *   y[e][c]     = « l'exigence e occupe la case c » (salle quelconque)
 *   pres[T][c]  = « l'enseignant T enseigne à la case c »
 * Les deux se construisent par ALIAS quand une seule variable sous-jacente existe (pas de
 * nouvelle variable), sinon newBoolVar + addEquality — légal car les contraintes dures homologues
 * (conflit classe / conflit enseignant) garantissent que la somme vaut 0 ou 1.
 */
import { CpModel, weightedSum } from 'or-tools-wasm/cp-sat';
import type { BoolVar, LinearExprLike } from 'or-tools-wasm/cp-sat';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type {
  CaseGrille,
  ContraintesDoucesOptions,
  ExigenceSeance,
} from '@domain/ports/services/SchedulingSolverPort';
import {
  POIDS_TROU_CASE,
  POIDS_TROIS_CONSECUTIFS,
  POIDS_DESEQUILIBRE,
  POIDS_VOLUME_JOUR,
  POIDS_TEMPS_LIBRES_CONSECUTIFS,
} from '@domain/ports/services/SchedulingSolverPort';
import { exigeDeuxJours } from '@domain/rules/ReglesPedagogiquesEmploiDuTemps';
import { modeliserReglesPedagogiques } from '@infrastructure/scheduling/reglesPedagogiques';

/** Un placement candidat (variable booléenne x[e][c][s]). */
export type Placement = { exigenceIdx: number; caseIdx: number; salleIdx: number };

/** Un terme de l'objectif final : une expression et son coefficient signé. */
export type TermeObjectif = { terme: LinearExprLike; coeff: number };

/**
 * Point d'entrée : modélise toutes les contraintes douces actives et retourne leurs termes
 * d'objectif. L'adaptateur les assemble avec la préférence « salle habituelle » en UN SEUL
 * model.maximize. Les blocs de 2 h (contrainte DURE, §4 du plan) sont appliqués ici — actifs par
 * défaut, désactivables via options.blocsDeuxHeures = false.
 */
export function modeliserContraintesDouces(args: {
  model: CpModel;
  placements: Placement[];
  variables: BoolVar[];
  exigences: ExigenceSeance[];
  grille: CaseGrille[];
  options?: ContraintesDoucesOptions;
}): TermeObjectif[] {
  const { model, placements, variables, exigences, grille, options } = args;

  const parJour = casesParJour(grille);
  const y = construireY(model, placements, variables, exigences.length, grille.length);
  const pres = construirePres(model, y, exigences, grille.length);

  if (options?.reglesPedagogiques !== false) {
    modeliserReglesPedagogiques({
       model, y, exigences, grille,
       options: {
         occurrencesParJour: options?.reglesOccurrencesParJour,
         contiguite: options?.reglesContiguite,
         joursDistinctsEPS: options?.reglesJoursDistinctsEPS,
       },

    });
  }

  // Blocs de 2 h (DUR) — indépendants des pénalités douces.
  if (options?.blocsDeuxHeures !== false) {
    modeliserBlocsDeuxHeures(model, y, exigences, grille, parJour);
  }

  const occupation = options?.interdireTempsLibresConsecutifs
    ? construireCasesOccupees(model, y, grille.length)
    : null;
  const termes: TermeObjectif[] = options?.interdireTempsLibresConsecutifs
    ? penaliteTempsLibresConsecutifs(model, occupation!, parJour, grille)
    : [];

  if (!options) return termes;

  const poids = options.poids ?? {};

  if (options.trouEnseignant) {
    termes.push(...penaliteTrou(model, pres, parJour, poids.trou ?? POIDS_TROU_CASE));
  }
  if (options.troisCoursConsecutifs) {
    termes.push(...penaliteTroisConsecutifs(model, pres, parJour, poids.troisConsecutifs ?? POIDS_TROIS_CONSECUTIFS));
  }
  if (options.equilibrageSemaine) {
    termes.push(...penaliteEquilibrage(model, y, parJour, exigences.length, poids.desequilibre ?? POIDS_DESEQUILIBRE));
  }
  if (options.volumeMaxEnseignantParJour != null) {
    const dureeCase = dureeCaseMinutes(grille);
    const capCases = Math.max(1, Math.floor(options.volumeMaxEnseignantParJour / dureeCase));
    termes.push(...penaliteVolumeJour(model, pres, parJour, capCases, poids.volumeJour ?? POIDS_VOLUME_JOUR));
  }

  return termes;
}

function construireCasesOccupees(model: CpModel, y: (BoolVar | null)[][], nbCases: number): BoolVar[] {
  return Array.from({ length: nbCases }, (_, c) => {
    const vars = y.map(row => row[c]).filter((variable): variable is BoolVar => variable !== null);
    const variable = model.newBoolVar(`case_occupee_${c}`);
    model.addEquality(variable, vars.length === 0 ? 0 : weightedSum(vars, vars.map(() => 1)));
    return variable;
  });
}

function penaliteTempsLibresConsecutifs(
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

/**
 * Blocs de 2 h (contrainte DURE, V2.5 §4) — pour chaque matière à `blocDureeCases = 2`, les
 * séances doivent former des paires de cases ADJACENTES (même jour, fin == début de la suivante).
 *
 * Modèle (par matière S, N séances, N pair) :
 *   yS[c]       = « S occupe la case c » (OR des y[e][c] des e de S — somme ≤ 1 via conflit classe)
 *   bloc[c]     = yS[c] AND yS[c⁺]   (reifié : 2 implications + 1 inégalité)
 *   chaque case occupée appartient à un bloc : yS[c] → bloc[c] OR bloc[c⁻]  (addBoolOr + not)
 *   Σ bloc = N/2   (force un appariement parfait en paires disjointes adjacentes)
 */
function modeliserBlocsDeuxHeures(
  model: CpModel,
  y: (BoolVar | null)[][],
  exigences: ExigenceSeance[],
  grille: CaseGrille[],
  parJour: Map<number, number[]>,
): void {
  // Regrouper les exigences par matière à blocs.
  const parMatiere = new Map<string, number[]>();
  for (let e = 0; e < exigences.length; e++) {
    const exigence = exigences[e]!;
    if (exigence.blocDureeCases !== 2 || exigeDeuxJours(exigence)) continue;
    const arr = parMatiere.get(exigence.subjectId) ?? [];
    arr.push(e);
    parMatiere.set(exigences[e]!.subjectId, arr);
  }

  for (const [subjectId, indicesE] of parMatiere) {
    const n = indicesE.length;
    if (n < 2) continue;

    // yS[c] = « la matière occupe la case c ».
    const yS: (BoolVar | null)[] = Array(grille.length).fill(null);
    for (let c = 0; c < grille.length; c++) {
      const vars: BoolVar[] = [];
      for (const e of indicesE) {
        const yv = y[e]![c];
        if (yv !== null) vars.push(yv);
      }
      if (vars.length === 0) continue;
      if (vars.length === 1) {
        yS[c] = vars[0]!;
      } else {
        const v = model.newBoolVar(`ys_${subjectId}_${c}`);
        model.addEquality(v, weightedSum(vars, vars.map(() => 1)));
        yS[c] = v;
      }
    }

    // Une variable de bloc par case ayant une case adjacente suivante.
    const blocs: { c: number; cPlus: number; var: BoolVar }[] = [];
    for (const indices of parJour.values()) {
      for (let i = 0; i + 1 < indices.length; i++) {
        const c = indices[i]!;
        const cPlus = indices[i + 1]!;
        if (grille[cPlus]!.startTime !== grille[c]!.endTime) continue;
        const yc = yS[c];
        const ycp = yS[cPlus];
        if (yc === null || ycp === null) continue;
        const b = model.newBoolVar(`bloc_${subjectId}_${c}`);
        // Implication UNIDIRECTIONNELLE (bloc → les 2 cases occupées), PAS un AND réifié : un AND
        // réifié forcerait bloc=1 pour tout couple adjacent occupé (3 blocs sur 4 cases consécutives),
        // contredisant Σ bloc = n/2. Le comptage Σ bloc = n/2 + « toute case occupée dans un bloc »
        // suffit à forcer l'appariement disjoint.
        model.addImplication(b, yc);
        model.addImplication(b, ycp);
        blocs.push({ c, cPlus, var: b });
      }
    }

    // Toute case occupée appartient à un bloc (commençant à c ou à c−1).
    for (let c = 0; c < grille.length; c++) {
      const yc = yS[c];
      if (yc === null) continue;
      const blocIci = blocs.find(b => b.c === c)?.var ?? null;
      const blocPrecedent = blocs.find(b => b.cPlus === c)?.var ?? null;
      const litteraux: (BoolVar | ReturnType<BoolVar['not']>)[] = [yc.not()];
      if (blocIci) litteraux.push(blocIci);
      if (blocPrecedent) litteraux.push(blocPrecedent);
      model.addBoolOr(litteraux);
    }

    // Σ bloc = n/2 (n pair garanti par le use case).
    if (blocs.length > 0 && n % 2 === 0) {
      model.addEquality(weightedSum(blocs.map(b => b.var), blocs.map(() => 1)), n / 2);
    }
  }
}

/** Regroupe les indices de cases par jour, triés par heure de début (défensif). */
function casesParJour(grille: CaseGrille[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  grille.forEach((g, idx) => {
    const arr = map.get(g.dayOfWeek) ?? [];
    arr.push(idx);
    map.set(g.dayOfWeek, arr);
  });
  for (const arr of map.values()) {
    arr.sort((a, b) => grille[a]!.startTime.localeCompare(grille[b]!.startTime));
  }
  return map;
}

/** y[e][c] = « l'exigence e occupe la case c ». Alias si une seule variable sous-jacente. */
function construireY(
  model: CpModel,
  placements: Placement[],
  variables: BoolVar[],
  nbExigences: number,
  nbCases: number,
): (BoolVar | null)[][] {
  const parCle = new Map<string, number[]>();
  placements.forEach((p, i) => {
    const cle = `${p.exigenceIdx}:${p.caseIdx}`;
    const arr = parCle.get(cle) ?? [];
    arr.push(i);
    parCle.set(cle, arr);
  });

  const y: (BoolVar | null)[][] = Array.from({ length: nbExigences }, () => Array(nbCases).fill(null));

  for (const [cle, indices] of parCle) {
    const [e, c] = cle.split(':').map(Number) as [number, number];
    if (indices.length === 1) {
      y[e]![c] = variables[indices[0]!]!;
    } else {
      const yVar = model.newBoolVar(`y_${e}_${c}`);
      model.addEquality(yVar, weightedSum(indices.map(i => variables[i]!), indices.map(() => 1)));
      y[e]![c] = yVar;
    }
  }
  return y;
}

/** pres[T][c] = « l'enseignant T enseigne à la case c ». Alias si une seule variable. */
function construirePres(
  model: CpModel,
  y: (BoolVar | null)[][],
  exigences: ExigenceSeance[],
  nbCases: number,
): Map<string, (BoolVar | null)[]> {
  const enseignants = [...new Set(exigences.map(e => e.teacherId))];
  const pres = new Map<string, (BoolVar | null)[]>();

  for (const teacherId of enseignants) {
    const arr: (BoolVar | null)[] = Array(nbCases).fill(null);
    for (let c = 0; c < nbCases; c++) {
      const vars: BoolVar[] = [];
      for (let e = 0; e < exigences.length; e++) {
        const yv = y[e]![c];
        if (exigences[e]!.teacherId === teacherId && yv !== null) vars.push(yv);
      }
      if (vars.length === 0) continue;
      if (vars.length === 1) {
        arr[c] = vars[0]!;
      } else {
        const pVar = model.newBoolVar(`pres_${teacherId}_${c}`);
        model.addEquality(pVar, weightedSum(vars, vars.map(() => 1)));
        arr[c] = pVar;
      }
    }
    pres.set(teacherId, arr);
  }
  return pres;
}

/** Pénalité « trou enseignant » : interstices vides dans la journée d'un enseignant. */
function penaliteTrou(
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
function penaliteTroisConsecutifs(
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
function penaliteEquilibrage(
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
function penaliteVolumeJour(
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
function lineaire(
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
function dureeCaseMinutes(grille: CaseGrille[]): number {
  if (grille.length === 0) return 60;
  const debut = CreneauHoraire.heureEnMinutes(grille[0]!.startTime);
  const fin = CreneauHoraire.heureEnMinutes(grille[0]!.endTime);
  const d = fin - debut;
  return d > 0 ? d : 60;
}
