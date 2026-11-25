/**
 * INFRASTRUCTURE LAYER — Implémentation Prisma de `CopilotAdminAcademicGateway`.
 */
import type { PrismaClient } from '@prisma/client';
import type {
  CopilotActiveTeacherWithSubjectsRow,
  CopilotAdminAcademicGateway,
  CopilotClassTeachingAssignmentRow,
  CopilotLockedClassGradeRow,
  CopilotLockedSequenceGradeRow,
  CopilotOtherClassSlotRow,
  CopilotSchoolInfo,
  CopilotSubjectSequenceGradeRow,
  CopilotTeacherUnavailabilityRow,
  CopilotTeachingAssignmentIssueRow,
  CopilotTeachingAssignmentSummary,
  CopilotTimetableGridConfig,
  CopilotTimetableSummary,
  CopilotYearTimetableSlotRow,
} from '@domain/ports/repositories/copilot/CopilotAdminAcademicGateway';
import type { CopilotNamedEntity } from '@domain/ports/repositories/copilot/CopilotSharedGateway';
import type { CouncilStatus, TimetableStatus } from '@domain/types/enums';

function parsePeriodesCoursParJour(raw: unknown): Record<string, number> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number') result[key] = value;
  }
  return result;
}

export class PrismaCopilotAdminAcademicGateway implements CopilotAdminAcademicGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async findSchoolInfo(schoolId: string): Promise<CopilotSchoolInfo | null> {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subsystem: true },
    });
  }

  async findSubjectSequenceGrades(
    schoolId: string,
    classId: string,
    subjectId: string,
    sequenceId: string,
  ): Promise<CopilotSubjectSequenceGradeRow[]> {
    return this.prisma.grade.findMany({
      where: { schoolId, classId, subjectId, sequenceId, sequenceAverage: { not: null } },
      select: { sequenceAverage: true, isAbsentGrade: true },
    });
  }

  async findLockedYearGradesBySequence(
    schoolId: string,
    academicYearId: string,
    classId?: string,
  ): Promise<CopilotLockedSequenceGradeRow[]> {
    return this.prisma.grade.findMany({
      where: {
        schoolId,
        academicYearId,
        validationStatus: { in: ['LOCKED'] },
        sequenceAverage: { not: null },
        ...(classId ? { classId } : {}),
      },
      select: {
        sequenceAverage: true,
        sequence: { select: { id: true, name: true, orderIndex: true } },
      },
    });
  }

  async findClassesByLevel(schoolId: string, level?: string): Promise<CopilotNamedEntity[]> {
    return this.prisma.class.findMany({
      where: { schoolId, ...(level ? { level } : {}) },
      select: { id: true, name: true },
    });
  }

  async findLockedClassGradesForYear(
    schoolId: string,
    academicYearId: string,
    classIds: string[],
  ): Promise<CopilotLockedClassGradeRow[]> {
    if (classIds.length === 0) return [];
    return this.prisma.grade.findMany({
      where: {
        schoolId,
        academicYearId,
        classId: { in: classIds },
        validationStatus: { in: ['LOCKED'] },
        sequenceAverage: { not: null },
      },
      select: { classId: true, sequenceAverage: true },
    });
  }

  async findClassCouncilSessionStatus(
    schoolId: string,
    classId: string,
    academicPeriodId: string,
  ): Promise<{ status: CouncilStatus } | null> {
    return this.prisma.classCouncilSession.findFirst({
      where: { schoolId, classId, academicPeriodId },
      select: { status: true },
    });
  }

  async findLockedCouncilClassIds(schoolId: string, academicPeriodId: string): Promise<string[]> {
    const sessions = await this.prisma.classCouncilSession.findMany({
      where: { schoolId, academicPeriodId, status: 'LOCKED' },
      select: { classId: true },
    });
    return sessions.map((s) => s.classId);
  }

  async findAcademicPeriodEndDate(
    schoolId: string,
    academicPeriodId: string,
  ): Promise<{ endDate: Date } | null> {
    return this.prisma.academicPeriod.findFirst({
      where: { id: academicPeriodId, academicYear: { schoolId } },
      select: { endDate: true },
    });
  }

  async findAcademicPeriodByName(
    schoolId: string,
    academicYearId: string,
    periodName: string,
  ): Promise<CopilotNamedEntity | null> {
    return this.prisma.academicPeriod.findFirst({
      where: {
        academicYearId,
        academicYear: { schoolId },
        name: { equals: periodName, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });
  }

  async findClassTimetableSummary(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<CopilotTimetableSummary | null> {
    const timetable = await this.prisma.timetable.findFirst({
      where: { classId, academicYearId, schoolId },
      select: { id: true, status: true, _count: { select: { slots: true } } },
    });
    if (!timetable) return null;
    return {
      id: timetable.id,
      status: timetable.status,
      slotsCount: timetable._count.slots,
    };
  }

  async findClassTimetableStatus(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<{ id: string; status: TimetableStatus } | null> {
    return this.prisma.timetable.findFirst({
      where: { classId, academicYearId, schoolId },
      select: { id: true, status: true },
    });
  }

  async findPublishedTimetableClassIds(schoolId: string, academicYearId: string): Promise<string[]> {
    const timetables = await this.prisma.timetable.findMany({
      where: { schoolId, academicYearId, status: 'PUBLISHED' },
      select: { classId: true },
    });
    return timetables.map((t) => t.classId);
  }

  async findTeachingAssignmentForClassSubject(
    schoolId: string,
    classId: string,
    subjectId: string,
  ): Promise<CopilotTeachingAssignmentSummary | null> {
    return this.prisma.teachingAssignment.findFirst({
      where: { classId, subjectId, schoolId },
      select: { id: true, teacher: { select: { firstName: true, lastName: true } } },
    });
  }

  async isTeacherQualifiedForSubject(
    schoolId: string,
    teacherId: string,
    subjectId: string,
  ): Promise<boolean> {
    const profile = await this.prisma.teacherProfile.findFirst({
      where: {
        userId: teacherId,
        user: { schoolId, role: 'TEACHER', isActive: true },
        teacherSubjects: { some: { subjectId } },
      },
      select: { id: true },
    });
    return profile !== null;
  }

  async reassignTeachingAssignmentTeacher(
    schoolId: string,
    assignmentId: string,
    teacherId: string,
  ): Promise<void> {
    await this.prisma.teachingAssignment.updateMany({
      where: { id: assignmentId, schoolId },
      data: { teacherId, source: 'MANUAL', createdAt: new Date() },
    });
  }

  async countTeachingAssignmentsByClass(schoolId: string, classId: string): Promise<number> {
    return this.prisma.teachingAssignment.count({
      where: { classId, schoolId },
    });
  }

  async deleteTeachingAssignmentsByClass(schoolId: string, classId: string): Promise<number> {
    const result = await this.prisma.teachingAssignment.deleteMany({
      where: { classId, schoolId },
    });
    return result.count;
  }

  async countTeachingAssignmentsByYear(schoolId: string, academicYearId: string): Promise<number> {
    return this.prisma.teachingAssignment.count({
      where: { schoolId, academicYearId },
    });
  }

  async deleteTeachingAssignmentsByYear(schoolId: string, academicYearId: string): Promise<number> {
    const result = await this.prisma.teachingAssignment.deleteMany({
      where: { schoolId, academicYearId },
    });
    return result.count;
  }

  async findTeachingAssignmentIssues(
    schoolId: string,
    academicYearId: string,
    filter?: { classId?: string; status?: 'OPEN' | 'RESOLVED' },
  ): Promise<CopilotTeachingAssignmentIssueRow[]> {
    return this.prisma.teachingAssignmentIssue.findMany({
      where: {
        schoolId,
        academicYearId,
        ...(filter?.classId && { classId: filter.classId }),
        ...(filter?.status && { status: filter.status }),
      },
      orderBy: { detectedAt: 'desc' },
      select: { classId: true, subjectId: true, reason: true, status: true, detectedAt: true },
    });
  }

  async findClassNamesByIds(schoolId: string, classIds: string[]): Promise<CopilotNamedEntity[]> {
    if (classIds.length === 0) return [];
    return this.prisma.class.findMany({
      where: { id: { in: classIds }, schoolId },
      select: { id: true, name: true },
    });
  }

  async findSubjectNamesByIds(schoolId: string, subjectIds: string[]): Promise<CopilotNamedEntity[]> {
    if (subjectIds.length === 0) return [];
    return this.prisma.subject.findMany({
      where: { id: { in: subjectIds }, schoolId },
      select: { id: true, name: true },
    });
  }

  async findTimetableGridConfig(schoolId: string): Promise<CopilotTimetableGridConfig | null> {
    const grid = await this.prisma.timetableGridConfig.findUnique({ where: { schoolId } });
    if (!grid) return null;
    return {
      heureDebut: grid.heureDebut,
      dureePeriode: grid.dureePeriode,
      periodesAvantP1: grid.periodesAvantP1,
      dureePetitePause: grid.dureePetitePause,
      periodesAvantP2: grid.periodesAvantP2,
      dureeGrandePause: grid.dureeGrandePause,
      periodesApresP2: grid.periodesApresP2,
      joursActifs: grid.joursActifs,
      periodesCoursParJour: parsePeriodesCoursParJour(grid.periodesCoursParJour),
    };
  }

  async findClassTeachingAssignments(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<CopilotClassTeachingAssignmentRow[]> {
    return this.prisma.teachingAssignment.findMany({
      where: { classId, schoolId, academicYearId },
      select: {
        subject: { select: { id: true, name: true, hoursPerWeek: true } },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffProfile: { select: { permissions: { select: { permission: true } } } },
          },
        },
      },
    });
  }

  async findActiveTeacherUnavailabilities(schoolId: string): Promise<CopilotTeacherUnavailabilityRow[]> {
    return this.prisma.teacherUnavailability.findMany({
      where: { schoolId, active: true },
      select: { teacherId: true, dayOfWeek: true, startTime: true, endTime: true },
    });
  }

  async findOtherClassTimetableSlots(
    schoolId: string,
    academicYearId: string,
    excludedClassId: string,
  ): Promise<CopilotOtherClassSlotRow[]> {
    return this.prisma.timetableSlot.findMany({
      where: { kind: 'CLASS', timetable: { schoolId, academicYearId, NOT: { classId: excludedClassId } } },
      select: {
        teacherId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        timetable: { select: { class: { select: { name: true } } } },
      },
    });
  }

  async findYearClassTimetableSlots(
    schoolId: string,
    academicYearId: string,
  ): Promise<CopilotYearTimetableSlotRow[]> {
    return this.prisma.timetableSlot.findMany({
      where: { kind: 'CLASS', timetable: { schoolId, academicYearId } },
      select: { teacherId: true, startTime: true, endTime: true },
    });
  }

  async findActiveTeachersWithSubjects(schoolId: string): Promise<CopilotActiveTeacherWithSubjectsRow[]> {
    return this.prisma.user.findMany({
      where: { schoolId, role: 'TEACHER', isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        staffProfile: { select: { permissions: { select: { permission: true } } } },
        teacherProfile: { select: { teacherSubjects: { select: { subjectId: true } } } },
      },
    });
  }
}
