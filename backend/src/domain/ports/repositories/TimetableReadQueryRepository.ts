/**
 * DOMAIN LAYER — Port Repository TimetableReadQuery
 * Encapsule les requêtes de lecture des référentiels d'emploi du temps et structure
 * pédagogique (classes, matières, salles, groupes d'élèves, années scolaires, emplois du temps).
 */
import type {
  AcademicYearStatus,
  ClassStatus,
  PeriodType,
  RoomStatus,
  RoomType,
  SlotKind,
  SubjectType,
  TimetableStatus,
} from '@domain/types/enums';

export interface TimetableReadClassRecord {
  id: string;
  schoolId: string;
  academicYearId: string;
  status: ClassStatus;
  name: string;
  level: string | null;
  sectionId: string | null;
  capacity: number;
  createdAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
  filiere: string | null;
  pebsMixte: boolean;
  serie: string | null;
  professorPrincipalId: string | null;
  professorPrincipal: { id: string; firstName: string; lastName: string } | null;
  _count: { enrollments: number };
}

export interface ClassPebsCount {
  classId: string;
  count: number;
}

export interface ClassSubjectContext {
  name: string;
  level: string | null;
  serie: string | null;
  filiere: string | null;
}

export interface SubjectCoefficientRecord {
  id: string;
  schoolId: string;
  subjectId: string;
  classLevel: string;
  serieCode: string | null;
  coefficient: number;
  weeklyPeriods: number | null;
  subject: { id: string; name: string; code: string | null };
}

export interface ClassSubjectOverrideRecord {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  coefficient: number;
  subject: { id: string; name: string; code: string | null };
}

export interface CatalogSubjectRecord {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
  coefficient: number;
  hoursPerWeek: number;
  blocDureeCases: number | null;
  createdAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
  subjectType: SubjectType;
  departmentId: string | null;
  isLV2: boolean;
  restrictedToGroupId: string | null;
  teacherSubjects: Array<{
    teacherProfileId: string;
    subjectId: string;
    teacherProfile: {
      id: string;
      userId: string;
      specialization: string[];
      supervisedSubjectIds: string[];
      maxWeeklyHours: number | null;
      user: { id: string; firstName: string; lastName: string };
    };
  }>;
}

export interface RoomCatalogRecord {
  id: string;
  schoolId: string;
  name: string;
  type: RoomType;
  status: RoomStatus;
  capacity: number;
  equipment: string[];
  qrEnabled: boolean;
  createdAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
}

export interface StudentGroupSetCatalogRecord {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  createdAt: Date;
  groups: Array<{
    id: string;
    groupSetId: string;
    name: string;
    subjectId: string | null;
    createdAt: Date;
  }>;
}

export interface ClassRoomAssignmentListRecord {
  id: string;
  schoolId: string;
  classId: string;
  roomId: string;
  academicYearId: string;
  createdAt: Date;
  class: { id: string; name: string };
  room: { id: string; name: string; capacity: number };
}

export interface AcademicYearReadRecord {
  id: string;
  schoolId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  status: AcademicYearStatus;
  createdAt: Date;
  periods: Array<{
    id: string;
    academicYearId: string;
    name: string;
    type: PeriodType;
    orderIndex: number;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
    sequences: Array<{
      id: string;
      academicPeriodId: string;
      schoolId: string;
      name: string;
      type: string;
      orderIndex: number;
      startDate: Date | null;
      endDate: Date | null;
      isCurrent: boolean;
    }>;
  }>;
}

export interface TimetableReadRecord {
  id: string;
  schoolId: string;
  classId: string;
  academicYearId: string;
  status: TimetableStatus;
  generatedByAI: boolean;
  createdAt: Date;
  class: { id: string; name: string };
  slots: Array<{
    id: string;
    timetableId: string;
    subjectId: string | null;
    teacherId: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomId: string | null;
    kind: SlotKind;
    subGroupId: string | null;
    isLV2Slot: boolean;
    isElectiveSlot: boolean;
    managedBySolver: boolean;
    groupId: string | null;
    subject: { id: string; name: string } | null;
    teacher: { id: string; firstName: string; lastName: string } | null;
    room: { id: string; name: string } | null;
  }>;
}

export interface TimetableReadQueryRepository {
  findTeacherAssignedClassIds(teacherId: string, schoolId: string): Promise<string[]>;
  listClasses(params: {
    schoolId: string;
    teacherUserId?: string;
    assignedClassIds?: string[];
  }): Promise<TimetableReadClassRecord[]>;
  findSchoolTemplateCode(schoolId: string): Promise<string | null>;
  countPebsStudentsByClass(classIds: string[]): Promise<ClassPebsCount[]>;
  findClassForSubjects(classId: string, schoolId: string): Promise<ClassSubjectContext | null>;
  listClassSubjectCoefficients(params: {
    schoolId: string;
    classId: string;
    classLevel: string | null;
    isCycle1: boolean;
    cycle1Filiere: string;
    resolvedSerie: string | null;
  }): Promise<{
    coefficients: SubjectCoefficientRecord[];
    overrides: ClassSubjectOverrideRecord[];
  }>;
  listCatalogSubjects(schoolId: string, teacherUserId?: string): Promise<CatalogSubjectRecord[]>;
  listRooms(schoolId: string): Promise<RoomCatalogRecord[]>;
  listStudentGroupSets(schoolId: string): Promise<StudentGroupSetCatalogRecord[]>;
  listClassRoomAssignments(schoolId: string, academicYearId: string): Promise<ClassRoomAssignmentListRecord[]>;
  listAcademicYears(schoolId: string): Promise<AcademicYearReadRecord[]>;
  listTimetables(schoolId: string, classId?: string): Promise<TimetableReadRecord[]>;
}
