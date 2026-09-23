/**
 * DOMAIN LAYER — Port Repository Assignation Matières/Coefficients
 * Persistance des opérations d'assignation des matières et coefficients par classe
 * (activation d'établissement + rattrapage sync-subjects). Adapter unique acceptant
 * indifféremment `prisma` (hors tx) ou `tx` (dans une transaction).
 */

export interface MatiereReference {
  subjectName: string;
  coefficient: number;
  weeklyPeriods: number | null;
}

export interface BacMatiereReference {
  subjectName: string;
  coefficient: number;
}

export interface SubjectAssignmentRepository {
  createSubject(schoolId: string, data: {
    name: string; code: string; coefficient: number; hoursPerWeek: number;
  }): Promise<{ id: string }>;
  upsertSubjectCoefficient(
    schoolId: string,
    subjectId: string,
    classLevel: string,
    serieCode: string | null,
    coefficient: number,
    weeklyPeriods?: number | null,
  ): Promise<void>;
  findSubjectCoefficient(schoolId: string, subjectId: string, classLevel: string, serieCode: string | null): Promise<{ id: string } | null>;
  findSubjects(schoolId: string): Promise<{ id: string; name: string; coefficient: number }[]>;
  findAnySubjectCoefficient(schoolId: string, classLevel: string): Promise<{ id: string } | null>;
  findAnglophoneSubjectLoads(templateCode: string, classLevel: string, filiere: string): Promise<MatiereReference[]>;
  findAnglophoneSubjectLoadExists(templateCode: string, classLevel: string): Promise<boolean>;
  findCycleCoefficients(templateCode: string, classLevel: string, filiere: string): Promise<MatiereReference[]>;
  findBacCoefficients(serie: string, niveau: string, templateCode: string): Promise<BacMatiereReference[]>;
}
