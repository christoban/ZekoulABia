import type { CaseGrille, CreneauOccupe, IndisponibiliteEnseignant } from '@domain/ports/services/SchedulingSolverPort';

export const LIMITE_AP_HEURES = 14;

export type AffectationCharge = {
  teacherId: string;
  weeklyPeriods: number | null | undefined;
};

export function calculerChargeParEnseignant(affectations: ReadonlyArray<AffectationCharge>): Map<string, number> {
  const charge = new Map<string, number>();
  for (const affectation of affectations) {
    if (affectation.weeklyPeriods === null || affectation.weeklyPeriods === undefined) continue;
    charge.set(affectation.teacherId, (charge.get(affectation.teacherId) ?? 0) + affectation.weeklyPeriods);
  }
  return charge;
}

export function chevaucheEDT(a: { dayOfWeek: number; startTime: string; endTime: string }, b: { dayOfWeek: number; startTime: string; endTime: string }): boolean {
  return a.dayOfWeek === b.dayOfWeek && minutes(a.startTime) < minutes(b.endTime) && minutes(a.endTime) > minutes(b.startTime);
}

export function calculerCapaciteDisponible(
  grille: CaseGrille[],
  indisponibilites: IndisponibiliteEnseignant[],
  occupationFixe: CreneauOccupe[],
  teacherId?: string,
): number {
  return grille.filter(grilleCase => !indisponibilites.some(indisponibilite =>
    (!teacherId || indisponibilite.teacherId === teacherId) && chevaucheEDT(indisponibilite, grilleCase),
  ) && !occupationFixe.some(occupation =>
    (!teacherId || occupation.teacherId === teacherId) && chevaucheEDT(occupation, grilleCase),
  )).length;
}

function minutes(time: string): number {
  const [hours, minutesValue] = time.split(':').map(Number);
  return hours! * 60 + minutesValue!;
}
