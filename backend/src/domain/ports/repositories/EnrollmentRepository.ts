import type { PebsFiliere } from '@domain/types/enums';

export interface ClasseActuelleInfo {
  classId: string;
  className: string;
  level: string | null;
  serie: string | null;
  filiere: string | null;
  sectionId: string | null;
  sectionCode: string | null;
  professorPrincipalId: string | null;
}

export interface InscrireEleveParams {
  studentId: string;        // StudentProfile.id
  classId: string;
  academicYearId: string;
  schoolId: string;
  enrolledById: string;    // User.id
  status?: 'ACTIVE' | 'REPEATING';
}

export interface ChangerClasseParams {
  studentId: string;        // StudentProfile.id
  newClassId: string;
  academicYearId: string;
  schoolId: string;
  enrolledById: string;    // User.id
  exitReason?: string;     // 'PROMOTION' | 'TRANSFERT' | 'PEBS' | ...
}

export interface CreerEleveAvecClasseParams {
  userId: string;
  classId: string;
  enrolledById: string;
  extraProfileData?: { matricule?: string; matriculeVerifieAt?: Date; gender?: string; dateOfBirth?: Date; pebsFiliere?: PebsFiliere };
}

export interface EnrollmentRepository {
  // Pattern A : élèves d'une classe
  getStudentProfileIdsParClasse(classId: string): Promise<string[]>;
  getEleveUserIdsParClasse(classId: string): Promise<string[]>;
  /** userIds des élèves actifs d'une classe, triés par nom de famille (SMS de présence). */
  getEleveUserIdsParClasseOrdonnes(classId: string): Promise<string[]>;
  countElevesParClasse(classId: string): Promise<number>;

  // Pattern B : classe actuelle d'un élève
  getClasseActuelleEleve(userId: string): Promise<ClasseActuelleInfo | null>;
  getClasseActuelleParStudentId(studentId: string): Promise<ClasseActuelleInfo | null>;
  getClassIdActuelEleve(userId: string): Promise<string | null>;
  getClassIdsActuelsParUserIds(userIds: string[]): Promise<Map<string, string>>;

  // Pattern C : changer la classe (transactions atomiques)
  changerClasseEleve(params: ChangerClasseParams): Promise<void>;
  changerClasseElevesEnMasse(params: {
    studentIds: string[];
    newClassId: string;
    academicYearId: string;
    schoolId: string;
    enrolledById: string;
    exitReason?: string;
  }): Promise<void>;

  // Pattern D : inscription (création initiale)
  inscrireEleve(params: InscrireEleveParams): Promise<void>;
  inscrireElevesEnMasse(inscriptions: InscrireEleveParams[]): Promise<void>;
  creerEleveAvecClasse(params: CreerEleveAvecClasseParams): Promise<{ id: string; userId: string }>;
}