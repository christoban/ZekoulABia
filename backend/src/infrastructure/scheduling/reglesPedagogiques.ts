import type { CpModel } from 'or-tools-wasm/cp-sat';
import type { BoolVar, LinearExprLike } from 'or-tools-wasm/cp-sat';
import { weightedSum } from 'or-tools-wasm/cp-sat';
import type { CaseGrille, ExigenceSeance } from '@domain/ports/services/SchedulingSolverPort';
import { exigeDeuxJours } from '@domain/rules/ReglesPedagogiquesEmploiDuTemps';

export function modeliserReglesPedagogiques(args: {
  model: CpModel;
  y: (BoolVar | null)[][];
  exigences: ExigenceSeance[];
  grille: CaseGrille[];
  options?: {
    occurrencesParJour?: boolean;
    contiguite?: boolean;
    joursDistinctsEPS?: boolean;
  };
}): void {
  const { model, y, exigences, grille, options } = args;
  const indicesParMatiere = new Map<string, number[]>();
  exigences.forEach((exigence, index) => {
    const indices = indicesParMatiere.get(exigence.subjectId) ?? [];
    indices.push(index);
    indicesParMatiere.set(exigence.subjectId, indices);
  });

  const casesParJour = new Map<number, number[]>();
  grille.forEach((cas, index) => {
    const cases = casesParJour.get(cas.dayOfWeek) ?? [];
    cases.push(index);
    casesParJour.set(cas.dayOfWeek, cases);
  });

  for (const [subjectId, indicesExigences] of indicesParMatiere) {
    const variableParCase = new Map<number, BoolVar>();

    for (const c of grille.keys()) {
      const expressions: LinearExprLike[] = [];
      for (const e of indicesExigences) {
        const variable = y[e]![c];
        if (variable !== null) expressions.push(variable);
      }
      if (expressions.length === 0) continue;
      const variable = expressions.length === 1
        ? expressions[0] as BoolVar
        : ajouterVariableMatiere(model, subjectId, c, expressions);
      variableParCase.set(c, variable);
    }

    const doitEtreDeuxJours = indicesExigences.some(e => exigeDeuxJours(exigences[e]!));
    for (const casesJour of casesParJour.values()) {
      casesJour.sort((a, b) => grille[a]!.startTime.localeCompare(grille[b]!.startTime));
      const variablesJour = casesJour
        .map(c => variableParCase.get(c))
        .filter((variable): variable is BoolVar => variable !== undefined);
      if (variablesJour.length === 0) continue;

      if (options?.occurrencesParJour !== false) {
        model.addLinearConstraint(weightedSum(variablesJour, variablesJour.map(() => 1)), 0, 2);
      }

      if (doitEtreDeuxJours && options?.joursDistinctsEPS !== false) {
        model.addAtMostOne(variablesJour);
        continue;
      }

      if (options?.contiguite === false) continue;
      for (let i = 0; i < casesJour.length; i++) {
        for (let j = i + 2; j < casesJour.length; j++) {
          const premiere = variableParCase.get(casesJour[i]!);
          const seconde = variableParCase.get(casesJour[j]!);
          if (premiere && seconde) model.addAtMostOne([premiere, seconde]);
        }
      }
    }
  }
}

function ajouterVariableMatiere(model: CpModel, subjectId: string, caseIdx: number, expressions: LinearExprLike[]): BoolVar {
  const variable = model.newBoolVar(`matiere_${subjectId}_${caseIdx}`);
  model.addEquality(variable, weightedSum(expressions, expressions.map(() => 1)));
  return variable;
}
