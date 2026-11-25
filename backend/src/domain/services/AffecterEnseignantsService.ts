/**
 * Algorithme glouton pur d'affectation enseignant ↔ classe/matière.
 * Aucune dépendance Prisma/Express — testable sans base de données.
 */

import { LIMITE_AP_HEURES } from '@domain/rules/CapaciteEmploiDuTemps';

export type CandidatMatiereClasse = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  weeklyPeriods: number | null;
  dejaAffecte: boolean;
};

export type EnseignantEligible = {
  teacherId: string;
  subjectId: string;
  estAP: boolean;
  chargeActuelleHeures: number;
  capaciteHeures?: number;
};

export type AffectationAReequilibrer = {
  id: string;
  ancienTeacherId: string;
  nouveauTeacherId: string;
};

export type AffectationACreer = {
  classId: string;
  subjectId: string;
  teacherId: string;
};

export type CandidatNonResolu = {
  teacherId: string;
  chargeActuelleHeures: number;
  capaciteHeures: number | null;
  estAP: boolean;
};

export type MatiereNonResolue = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  raison: 'NO_QUALIFIED_TEACHER' | 'AP_WEEKLY_CAP_EXCEEDED' | 'TEACHER_WEEKLY_CAP_EXCEEDED';
  details: {
    weeklyPeriods: number | null;
    candidats: CandidatNonResolu[];
  };
};

export type MatiereHorsPerimetre = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
};

export type ResultatGenerationAffectations = {
  aCreer: AffectationACreer[];
  nonResolus: MatiereNonResolue[];
  horsPerimetre: MatiereHorsPerimetre[];
};

function respectePlafond(enseignant: EnseignantEligible, heures: number): boolean {
  if (enseignant.capaciteHeures !== undefined && enseignant.chargeActuelleHeures + heures > enseignant.capaciteHeures) {
    return false;
  }
  return !enseignant.estAP || enseignant.chargeActuelleHeures + heures <= LIMITE_AP_HEURES;
}

function trierCandidats(a: CandidatMatiereClasse, b: CandidatMatiereClasse): number {
  return a.classId.localeCompare(b.classId) || a.subjectId.localeCompare(b.subjectId);
}

export function genererAffectations(
  candidats: CandidatMatiereClasse[],
  enseignantsEligibles: EnseignantEligible[],
): ResultatGenerationAffectations {
  const aCreer: AffectationACreer[] = [];
  const nonResolus: MatiereNonResolue[] = [];
  const horsPerimetre: MatiereHorsPerimetre[] = [];

  const chargeParEnseignant = new Map<string, number>();
  for (const enseignant of enseignantsEligibles) {
    if (!chargeParEnseignant.has(enseignant.teacherId)) {
      chargeParEnseignant.set(enseignant.teacherId, enseignant.chargeActuelleHeures);
    }
  }

  const eligiblesParMatiere = new Map<string, EnseignantEligible[]>();
  for (const e of enseignantsEligibles) {
    const liste = eligiblesParMatiere.get(e.subjectId) ?? [];
    liste.push({ ...e });
    eligiblesParMatiere.set(e.subjectId, liste);
  }

  // Ordre déterministe : classe, puis matière
  const aTraiter = candidats.filter((c) => !c.dejaAffecte).sort(trierCandidats);

  for (const candidat of aTraiter) {
    if (candidat.weeklyPeriods === null) {
      horsPerimetre.push({
        classId: candidat.classId,
        className: candidat.className,
        subjectId: candidat.subjectId,
        subjectName: candidat.subjectName,
      });
      continue;
    }

    const eligibles = eligiblesParMatiere.get(candidat.subjectId) ?? [];
    if (eligibles.length === 0) {
      nonResolus.push({
        classId: candidat.classId,
        className: candidat.className,
        subjectId: candidat.subjectId,
        subjectName: candidat.subjectName,
        raison: 'NO_QUALIFIED_TEACHER',
        details: {
          weeklyPeriods: candidat.weeklyPeriods,
          candidats: [],
        },
      });
      continue;
    }

    eligibles.sort((a, b) => {
      const chargeA = chargeParEnseignant.get(a.teacherId) ?? a.chargeActuelleHeures;
      const chargeB = chargeParEnseignant.get(b.teacherId) ?? b.chargeActuelleHeures;
      return chargeA - chargeB || a.teacherId.localeCompare(b.teacherId);
    });
    const choisi = eligibles.find((e) => respectePlafond({
      ...e,
      chargeActuelleHeures: chargeParEnseignant.get(e.teacherId) ?? e.chargeActuelleHeures,
    }, candidat.weeklyPeriods!));

    if (!choisi) {
      const tousAPPlafonne = eligibles.every((e) => e.estAP && (chargeParEnseignant.get(e.teacherId) ?? e.chargeActuelleHeures) + candidat.weeklyPeriods! > LIMITE_AP_HEURES);
      nonResolus.push({
        classId: candidat.classId,
        className: candidat.className,
        subjectId: candidat.subjectId,
        subjectName: candidat.subjectName,
        raison: tousAPPlafonne ? 'AP_WEEKLY_CAP_EXCEEDED' : 'TEACHER_WEEKLY_CAP_EXCEEDED',
        details: {
          weeklyPeriods: candidat.weeklyPeriods,
          candidats: eligibles.map((e) => ({
            teacherId: e.teacherId,
            chargeActuelleHeures: chargeParEnseignant.get(e.teacherId) ?? e.chargeActuelleHeures,
            capaciteHeures: e.capaciteHeures ?? null,
            estAP: e.estAP,
          })),
        },
      });
      continue;
    }

    aCreer.push({
      classId: candidat.classId,
      subjectId: candidat.subjectId,
      teacherId: choisi.teacherId,
    });

    chargeParEnseignant.set(
      choisi.teacherId,
      (chargeParEnseignant.get(choisi.teacherId) ?? choisi.chargeActuelleHeures) + candidat.weeklyPeriods!,
    );
  }

  return { aCreer, nonResolus, horsPerimetre };
}

export function reequilibrerAffectations(
  affectations: { id: string; subjectId: string; teacherId: string; weeklyPeriods: number }[],
  enseignants: EnseignantEligible[],
): AffectationAReequilibrer[] {
  const charge = new Map<string, number>();
  for (const affectation of affectations) {
    charge.set(affectation.teacherId, (charge.get(affectation.teacherId) ?? 0) + affectation.weeklyPeriods);
  }
  const eligiblesParMatiere = new Map<string, EnseignantEligible[]>();
  for (const enseignant of enseignants) {
    const liste = eligiblesParMatiere.get(enseignant.subjectId) ?? [];
    liste.push({ ...enseignant });
    eligiblesParMatiere.set(enseignant.subjectId, liste);
  }
  const modifications: AffectationAReequilibrer[] = [];
  for (const affectation of [...affectations].sort((a, b) => b.weeklyPeriods - a.weeklyPeriods || a.id.localeCompare(b.id))) {
    const choisi = (eligiblesParMatiere.get(affectation.subjectId) ?? [])
      .filter(enseignant => {
        const currentCharge = charge.get(enseignant.teacherId) ?? 0;
        if (enseignant.capaciteHeures !== undefined && currentCharge + affectation.weeklyPeriods > enseignant.capaciteHeures) return false;
        return !enseignant.estAP || currentCharge + affectation.weeklyPeriods <= LIMITE_AP_HEURES;
      })
      .sort((a, b) => (charge.get(a.teacherId) ?? 0) - (charge.get(b.teacherId) ?? 0) || a.teacherId.localeCompare(b.teacherId))[0];
    if (!choisi || choisi.teacherId === affectation.teacherId) continue;
    modifications.push({ id: affectation.id, ancienTeacherId: affectation.teacherId, nouveauTeacherId: choisi.teacherId });
    charge.set(affectation.teacherId, (charge.get(affectation.teacherId) ?? 0) - affectation.weeklyPeriods);
    charge.set(choisi.teacherId, (charge.get(choisi.teacherId) ?? 0) + affectation.weeklyPeriods);
  }
  return modifications;
}
