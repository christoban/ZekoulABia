/**
 * Algorithme glouton pur d'affectation enseignant ↔ classe/matière.
 * Aucune dépendance Prisma/Express — testable sans base de données.
 */

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

export type MatiereNonResolue = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  raison: 'NO_QUALIFIED_TEACHER' | 'AP_WEEKLY_CAP_EXCEEDED';
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

const LIMITE_AP_HEURES = 14;

function trierCandidats(a: CandidatMatiereClasse, b: CandidatMatiereClasse): number {
  return a.classId.localeCompare(b.classId) || a.subjectId.localeCompare(b.subjectId);
}

function trierEnseignants(a: EnseignantEligible, b: EnseignantEligible): number {
  if (a.chargeActuelleHeures !== b.chargeActuelleHeures) {
    return a.chargeActuelleHeures - b.chargeActuelleHeures;
  }
  return a.teacherId.localeCompare(b.teacherId);
}

export function genererAffectations(
  candidats: CandidatMatiereClasse[],
  enseignantsEligibles: EnseignantEligible[],
): ResultatGenerationAffectations {
  const aCreer: AffectationACreer[] = [];
  const nonResolus: MatiereNonResolue[] = [];
  const horsPerimetre: MatiereHorsPerimetre[] = [];

  // Index des enseignants éligibles par matière (on travaille sur une copie mutable de la charge)
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
      });
      continue;
    }

    eligibles.sort(trierEnseignants);
    const choisi = eligibles.find((e) => {
      if (!e.estAP) return true;
      return e.chargeActuelleHeures + candidat.weeklyPeriods! <= LIMITE_AP_HEURES;
    });

    if (!choisi) {
      nonResolus.push({
        classId: candidat.classId,
        className: candidat.className,
        subjectId: candidat.subjectId,
        subjectName: candidat.subjectName,
        raison: 'AP_WEEKLY_CAP_EXCEEDED',
      });
      continue;
    }

    aCreer.push({
      classId: candidat.classId,
      subjectId: candidat.subjectId,
      teacherId: choisi.teacherId,
    });

    // Mise à jour en mémoire de la charge pour les couples suivants du même run
    choisi.chargeActuelleHeures += candidat.weeklyPeriods!;
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
      .filter(enseignant => !enseignant.estAP || (charge.get(enseignant.teacherId) ?? 0) + affectation.weeklyPeriods <= LIMITE_AP_HEURES)
      .sort((a, b) => (charge.get(a.teacherId) ?? 0) - (charge.get(b.teacherId) ?? 0) || a.teacherId.localeCompare(b.teacherId))[0];
    if (!choisi || choisi.teacherId === affectation.teacherId) continue;
    modifications.push({ id: affectation.id, ancienTeacherId: affectation.teacherId, nouveauTeacherId: choisi.teacherId });
    charge.set(affectation.teacherId, (charge.get(affectation.teacherId) ?? 0) - affectation.weeklyPeriods);
    charge.set(choisi.teacherId, (charge.get(choisi.teacherId) ?? 0) + affectation.weeklyPeriods);
  }
  return modifications;
}
