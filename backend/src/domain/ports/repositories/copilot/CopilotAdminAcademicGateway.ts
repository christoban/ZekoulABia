/**
 * DOMAIN LAYER — Port passerelle académique Admin pour le copilot.
 *
 * Couvre les lectures et écritures académiques propres au catalogue Admin :
 * bulletins, notes, conseils de classe, emplois du temps, affectations et périodes.
 */
import type { CouncilStatus, SchoolSubsystem, TimetableStatus } from '@domain/types/enums';
import type { CopilotNamedEntity } from './CopilotSharedGateway';

export interface CopilotSchoolInfo {
  name: string;
  subsystem: SchoolSubsystem;
}

export interface CopilotSubjectSequenceGradeRow {
  sequenceAverage: number | null;
  isAbsentGrade: boolean;
}

export interface CopilotLockedSequenceGradeRow {
  sequenceAverage: number | null;
  sequence: {
    id: string;
    name: string;
    orderIndex: number;
  };
}

export interface CopilotLockedClassGradeRow {
  classId: string;
  sequenceAverage: number | null;
}

export interface CopilotTimetableSummary {
  id: string;
  status: TimetableStatus;
  slotsCount: number;
}

export interface CopilotTeachingAssignmentSummary {
  id: string;
  teacher: {
    firstName: string;
    lastName: string;
  } | null;
}

export interface CopilotTeachingAssignmentIssueRow {
  classId: string;
  subjectId: string;
  reason: string;
  status: string;
  detectedAt: Date;
}

export interface CopilotTimetableGridConfig {
  heureDebut: string;
  dureePeriode: number;
  periodesAvantP1: number;
  dureePetitePause: number;
  periodesAvantP2: number;
  dureeGrandePause: number;
  periodesApresP2: number;
  joursActifs: string[];
  periodesCoursParJour: Record<string, number>;
}

export interface CopilotClassTeachingAssignmentRow {
  subject: {
    id: string;
    name: string;
    hoursPerWeek: number;
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    staffProfile: {
      permissions: { permission: string }[];
    } | null;
  };
}

export interface CopilotTeacherUnavailabilityRow {
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface CopilotOtherClassSlotRow {
  teacherId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timetable: {
    class: {
      name: string;
    };
  };
}

export interface CopilotYearTimetableSlotRow {
  teacherId: string | null;
  startTime: string;
  endTime: string;
}

export interface CopilotActiveTeacherWithSubjectsRow {
  id: string;
  firstName: string;
  lastName: string;
  staffProfile: {
    permissions: { permission: string }[];
  } | null;
  teacherProfile: {
    teacherSubjects: { subjectId: string }[];
  } | null;
}

export interface CopilotAdminAcademicGateway {
  findSchoolInfo(schoolId: string): Promise<CopilotSchoolInfo | null>;

  findSubjectSequenceGrades(
    schoolId: string,
    classId: string,
    subjectId: string,
    sequenceId: string,
  ): Promise<CopilotSubjectSequenceGradeRow[]>;

  findLockedYearGradesBySequence(
    schoolId: string,
    academicYearId: string,
    classId?: string,
  ): Promise<CopilotLockedSequenceGradeRow[]>;

  findClassesByLevel(schoolId: string, level?: string): Promise<CopilotNamedEntity[]>;

  findLockedClassGradesForYear(
    schoolId: string,
    academicYearId: string,
    classIds: string[],
  ): Promise<CopilotLockedClassGradeRow[]>;

  findClassCouncilSessionStatus(
    schoolId: string,
    classId: string,
    academicPeriodId: string,
  ): Promise<{ status: CouncilStatus } | null>;

  findLockedCouncilClassIds(schoolId: string, academicPeriodId: string): Promise<string[]>;

  findAcademicPeriodEndDate(
    schoolId: string,
    academicPeriodId: string,
  ): Promise<{ endDate: Date } | null>;

  findAcademicPeriodByName(
    schoolId: string,
    academicYearId: string,
    periodName: string,
  ): Promise<CopilotNamedEntity | null>;

  findClassTimetableSummary(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<CopilotTimetableSummary | null>;

  findClassTimetableStatus(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<{ id: string; status: TimetableStatus } | null>;

  findPublishedTimetableClassIds(schoolId: string, academicYearId: string): Promise<string[]>;

  findTeachingAssignmentForClassSubject(
    schoolId: string,
    classId: string,
    subjectId: string,
  ): Promise<CopilotTeachingAssignmentSummary | null>;

  isTeacherQualifiedForSubject(
    schoolId: string,
    teacherId: string,
    subjectId: string,
  ): Promise<boolean>;

  reassignTeachingAssignmentTeacher(
    schoolId: string,
    assignmentId: string,
    teacherId: string,
  ): Promise<void>;

  countTeachingAssignmentsByClass(schoolId: string, classId: string): Promise<number>;

  deleteTeachingAssignmentsByClass(schoolId: string, classId: string): Promise<number>;

  countTeachingAssignmentsByYear(schoolId: string, academicYearId: string): Promise<number>;

  deleteTeachingAssignmentsByYear(schoolId: string, academicYearId: string): Promise<number>;

  findTeachingAssignmentIssues(
    schoolId: string,
    academicYearId: string,
    filter?: { classId?: string; status?: 'OPEN' | 'RESOLVED' },
  ): Promise<CopilotTeachingAssignmentIssueRow[]>;

  findClassNamesByIds(schoolId: string, classIds: string[]): Promise<CopilotNamedEntity[]>;

  findSubjectNamesByIds(schoolId: string, subjectIds: string[]): Promise<CopilotNamedEntity[]>;

  findTimetableGridConfig(schoolId: string): Promise<CopilotTimetableGridConfig | null>;

  findClassTeachingAssignments(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<CopilotClassTeachingAssignmentRow[]>;

  findActiveTeacherUnavailabilities(schoolId: string): Promise<CopilotTeacherUnavailabilityRow[]>;

  findOtherClassTimetableSlots(
    schoolId: string,
    academicYearId: string,
    excludedClassId: string,
  ): Promise<CopilotOtherClassSlotRow[]>;

  findYearClassTimetableSlots(
    schoolId: string,
    academicYearId: string,
  ): Promise<CopilotYearTimetableSlotRow[]>;

  findActiveTeachersWithSubjects(schoolId: string): Promise<CopilotActiveTeacherWithSubjectsRow[]>;
}
