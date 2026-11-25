/**
 * DOMAIN LAYER — Port Repository ElectifsQuery
 * Encapsule les requêtes de lecture transverses du module Électifs (LV2, PEBS, A-Level, roster).
 */
import type { PebsFiliere } from '@domain/types/enums';

export interface ElectifClassRef {
  id: string;
  name: string;
}

export interface ElectifSubjectRef {
  id: string;
  name: string;
}

export interface ClassStudentLV2Record {
  id: string;
  firstName: string;
  lastName: string;
  lv2SubjectId: string | null;
  lv2SubjectName: string | null;
}

export interface ClassStudentPEBSRecord {
  id: string;
  firstName: string;
  lastName: string;
  pebsFiliere: PebsFiliere | null;
}

export interface ClassStudentALevelRecord {
  id: string;
  firstName: string;
  lastName: string;
  subjects: ElectifSubjectRef[];
}

export interface ClassStudentRosterRecord {
  id: string;
  firstName: string;
  lastName: string;
  lv2SubjectId: string | null;
  alevelSubjectIds: string[];
}

export interface RosterSubjectRef {
  id: string;
  name: string;
  isLV2: boolean;
}

export interface ElectifsQueryRepository {
  findClassById(classId: string, schoolId: string): Promise<ElectifClassRef | null>;
  listClassStudentsLV2(classId: string, schoolId: string): Promise<ClassStudentLV2Record[]>;
  listClassStudentsPEBS(classId: string, schoolId: string): Promise<ClassStudentPEBSRecord[]>;
  findStudentProfileIdByUserId(studentUserId: string, schoolId: string): Promise<string | null>;
  listStudentALevelSubjects(studentProfileId: string): Promise<ElectifSubjectRef[]>;
  listAvailableALevelSubjects(schoolId: string): Promise<ElectifSubjectRef[]>;
  listClassStudentsALevel(classId: string, schoolId: string): Promise<ClassStudentALevelRecord[]>;
  listActiveClassStudentIds(classId: string, schoolId: string): Promise<string[]>;
  listClassStudentsRoster(classId: string, schoolId: string): Promise<ClassStudentRosterRecord[]>;
  findSubjectForRoster(subjectId: string, schoolId: string): Promise<RosterSubjectRef | null>;
  isOfficialALevelSubject(subjectName: string): Promise<boolean>;
}
