import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  AcademicYearReadRecord,
  CatalogSubjectRecord,
  ClassPebsCount,
  ClassRoomAssignmentListRecord,
  ClassSubjectContext,
  ClassSubjectOverrideRecord,
  RoomCatalogRecord,
  StudentGroupSetCatalogRecord,
  SubjectCoefficientRecord,
  TimetableReadClassRecord,
  TimetableReadQueryRepository,
  TimetableReadRecord,
} from '@domain/ports/repositories/TimetableReadQueryRepository';

export class PrismaTimetableReadQueryRepository implements TimetableReadQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findTeacherAssignedClassIds(teacherId: string, schoolId: string): Promise<string[]> {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId, schoolId },
      select: { classId: true },
      distinct: ['classId'],
    });
    return assignments.map((a) => a.classId);
  }

  async listClasses(params: {
    schoolId: string;
    teacherUserId?: string;
    assignedClassIds?: string[];
  }): Promise<TimetableReadClassRecord[]> {
    const whereClause: Prisma.ClassWhereInput = params.teacherUserId
      ? {
          schoolId: params.schoolId,
          OR: [
            { id: { in: params.assignedClassIds ?? [] } },
            { professorPrincipalId: params.teacherUserId },
          ],
        }
      : { schoolId: params.schoolId };

    const classes = await this.prisma.class.findMany({
      where: whereClause,
      include: {
        professorPrincipal: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: {
            enrollments: {
              where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return classes as unknown as TimetableReadClassRecord[];
  }

  async findSchoolTemplateCode(schoolId: string): Promise<string | null> {
    const ecole = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { templateCode: true },
    });
    return ecole?.templateCode ?? null;
  }

  async countPebsStudentsByClass(classIds: string[]): Promise<ClassPebsCount[]> {
    if (classIds.length === 0) return [];
    const pebsCounts = await this.prisma.enrollment.groupBy({
      by: ['classId'],
      where: {
        classId: { in: classIds },
        status: 'ACTIVE',
        academicYear: { isCurrent: true },
        student: { pebsFiliere: { not: null } },
      },
      _count: { _all: true },
    });
    return pebsCounts.map((row) => ({ classId: row.classId, count: row._count._all }));
  }

  async findClassForSubjects(classId: string, schoolId: string): Promise<ClassSubjectContext | null> {
    return this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { name: true, level: true, serie: true, filiere: true },
    });
  }

  async listClassSubjectCoefficients(params: {
    schoolId: string;
    classId: string;
    classLevel: string | null;
    isCycle1: boolean;
    cycle1Filiere: string;
    resolvedSerie: string | null;
  }): Promise<{
    coefficients: SubjectCoefficientRecord[];
    overrides: ClassSubjectOverrideRecord[];
  }> {
    const [coefficients, overrides] = await Promise.all([
      this.prisma.subjectCoefficient.findMany({
        where: {
          schoolId: params.schoolId,
          classLevel: params.classLevel ?? undefined,
          OR: params.isCycle1
            ? [{ serieCode: params.cycle1Filiere }, { serieCode: null }]
            : params.resolvedSerie
              ? [{ serieCode: params.resolvedSerie }, { serieCode: null }]
              : [{ serieCode: null }],
        },
        include: { subject: { select: { id: true, name: true, code: true } } },
        orderBy: { subject: { name: 'asc' } },
      }),
      this.prisma.classSubjectOverride.findMany({
        where: { classId: params.classId, schoolId: params.schoolId },
        include: { subject: { select: { id: true, name: true, code: true } } },
        orderBy: { subject: { name: 'asc' } },
      }),
    ]);

    return {
      coefficients: coefficients as unknown as SubjectCoefficientRecord[],
      overrides: overrides as unknown as ClassSubjectOverrideRecord[],
    };
  }

  async listCatalogSubjects(schoolId: string, teacherUserId?: string): Promise<CatalogSubjectRecord[]> {
    const whereClause: Prisma.SubjectWhereInput = teacherUserId
      ? {
          schoolId,
          teacherSubjects: { some: { teacherProfile: { userId: teacherUserId } } },
        }
      : { schoolId };

    const subjects = await this.prisma.subject.findMany({
      where: whereClause,
      include: {
        teacherSubjects: {
          include: {
            teacherProfile: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return subjects as unknown as CatalogSubjectRecord[];
  }

  async listRooms(schoolId: string): Promise<RoomCatalogRecord[]> {
    const rooms = await this.prisma.room.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
    return rooms as unknown as RoomCatalogRecord[];
  }

  async listStudentGroupSets(schoolId: string): Promise<StudentGroupSetCatalogRecord[]> {
    return this.prisma.studentGroupSet.findMany({
      where: { schoolId },
      include: { groups: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async listClassRoomAssignments(
    schoolId: string,
    academicYearId: string,
  ): Promise<ClassRoomAssignmentListRecord[]> {
    return this.prisma.classRoomAssignment.findMany({
      where: { schoolId, academicYearId },
      include: {
        class: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, capacity: true } },
      },
    });
  }

  async listAcademicYears(schoolId: string): Promise<AcademicYearReadRecord[]> {
    const years = await this.prisma.academicYear.findMany({
      where: { schoolId },
      include: {
        periods: {
          include: { sequences: { orderBy: { orderIndex: 'asc' } } },
          orderBy: { startDate: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });
    return years as unknown as AcademicYearReadRecord[];
  }

  async listTimetables(schoolId: string, classId?: string): Promise<TimetableReadRecord[]> {
    const timetables = await this.prisma.timetable.findMany({
      where: { schoolId, ...(classId ? { classId } : {}) },
      include: {
        class: { select: { id: true, name: true } },
        slots: {
          include: {
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
            room: { select: { id: true, name: true } },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return timetables as unknown as TimetableReadRecord[];
  }
}
