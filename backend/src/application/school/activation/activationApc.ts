import type { SchoolActivationTx } from '@domain/ports/repositories/SchoolActivationRepository';
import { APC_COMPETENCES } from '../curriculum/primaire-apc';

export interface ApcCreationResult {
  apcSubjectIds: string[];
  subjectCount: number;
}

export async function creerMatieresApc(
  tx: SchoolActivationTx,
  isPrimaire: boolean,
  isComplexe: boolean,
  hasPrimaireContent: boolean,
): Promise<ApcCreationResult> {
  const apcSubjectIds: string[] = [];
  let subjectCount = 0;

  if (isPrimaire || (isComplexe && hasPrimaireContent)) {
    for (const comp of APC_COMPETENCES) {
      for (const sc of comp.sousCompetences) {
        const created = await tx.creerMatiere({
          name: sc.label,
          code: sc.code,
          coefficient: sc.totalPoints,
          hoursPerWeek: 0,
        });
        apcSubjectIds.push(created.id);
        subjectCount++;
      }
    }
  }

  return { apcSubjectIds, subjectCount };
}

export async function creerDepartementsApc(
  tx: SchoolActivationTx,
  isPrimaire: boolean,
  isComplexe: boolean,
  hasPrimaireContent: boolean,
): Promise<void> {
  if (isPrimaire || (isComplexe && hasPrimaireContent)) {
    const APC_DEPT_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#f97316'];
    const apcSubjects = await tx.findMatieres();
    const subjectByCode = new Map(apcSubjects.map((s) => [s.code, s.id]));

    for (let ci = 0; ci < APC_COMPETENCES.length; ci++) {
      const comp = APC_COMPETENCES[ci];
      const dept = await tx.creerDepartement({
        name: `Compétence ${comp.numero}`,
        color: APC_DEPT_COLORS[ci] ?? '#9ca3af',
      });
      for (const sc of comp.sousCompetences) {
        const subjectId = subjectByCode.get(sc.code);
        if (subjectId) {
          await tx.mettreAJourMatiere(subjectId, { departmentId: dept.id });
        }
      }
    }
  }
}
