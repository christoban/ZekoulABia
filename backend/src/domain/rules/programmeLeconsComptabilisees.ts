/**
 * DOMAIN LAYER — Règle unique (DRY) : quelles leçons d'un programme entrent dans le
 * dénominateur du taux de progression.
 *
 * Une leçon est exclue si :
 * - son module est désactivé (ProgrammeModuleEtat.actif = false) ;
 * - elle a été retirée du référentiel national (Chapitre.retireDuReferentielLe renseigné).
 * Dans les deux cas elle n'est jamais supprimée et reste visible.
 */
export interface LeconPourComptage {
  moduleOrdre?: number | null;
  retireDuReferentielLe?: Date | null;
}

export function estLeconRetireeDuReferentiel(lecon: LeconPourComptage): boolean {
  return lecon.retireDuReferentielLe !== null && lecon.retireDuReferentielLe !== undefined;
}

export function estModuleDeLeconActif(
  lecon: LeconPourComptage,
  modulesDesactives: ReadonlySet<number>,
): boolean {
  return (
    lecon.moduleOrdre === null ||
    lecon.moduleOrdre === undefined ||
    !modulesDesactives.has(lecon.moduleOrdre)
  );
}

export function estLeconComptabilisee(
  lecon: LeconPourComptage,
  modulesDesactives: ReadonlySet<number>,
): boolean {
  return estModuleDeLeconActif(lecon, modulesDesactives) && !estLeconRetireeDuReferentiel(lecon);
}

