export interface StudentProfileRef {
  id: string;
  userId: string;
}

import type { PebsFiliere } from '@domain/types/enums';

export interface SubjectRef {
  id: string;
  name: string;
}

export interface EleveALevelRef {
  id: string;
  firstName: string;
  lastName: string;
  className: string | null;
}

export interface StudentAffectationRepository {
  // Profil élève
  trouverProfilParUserId(userId: string, schoolId: string): Promise<StudentProfileRef | null>;
  trouverProfilParId(profileId: string, schoolId: string): Promise<StudentProfileRef | null>;
  trouverProfilParUserIdAvecClasse(userId: string, schoolId: string): Promise<{ id: string; classId: string | null } | null>;
  listerProfilsParUserIds(userIds: string[], schoolId: string): Promise<StudentProfileRef[]>;

  // Matières
  trouverMatiere(matiereId: string, schoolId: string): Promise<SubjectRef | null>;
  listerMatieresParIds(ids: string[], schoolId: string): Promise<SubjectRef[]>;
  listerMatieresParNoms(noms: string[], schoolId: string): Promise<SubjectRef[]>;
  listerNomsMatieresALevelOfficielles(): Promise<string[]>;
  trouverCombinaisonAnglophone(code: string): Promise<{ coreSubjects: string[] } | null>;

  // Écriture LV2 / PEBS
  mettreAJourLV2(profileId: string, lv2SubjectId: string | null): Promise<void>;
  mettreAJourLV2EnMasse(profileIds: string[], lv2SubjectId: string | null): Promise<number>;
  mettreAJourPEBS(profileId: string, pebsFiliere: PebsFiliere | null): Promise<void>;
  mettreAJourPEBSEnMasse(profileIds: string[], pebsFiliere: PebsFiliere | null): Promise<number>;

  // Écriture A-Level (transaction atomique de remplacement)
  remplacerMatieresALevel(profileId: string, subjectIds: string[]): Promise<void>;

  // Lecture A-Level
  listerElevesParMatiereALevel(subjectId: string, schoolId: string, classId?: string): Promise<EleveALevelRef[]>;
  listerMatieresDuProfile(profileId: string): Promise<string[]>;

  // Classe
  trouverClasseNiveau(classId: string): Promise<string | null>;
}