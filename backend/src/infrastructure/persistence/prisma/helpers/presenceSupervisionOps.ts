import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  DailyClassAttendanceStatus,
  PresenceJustifiee,
  PresenceLue,
  RepeatedAbsenceStudent,
} from '@domain/ports/repositories/PresenceRepository';
import type { AttendancePeriod, AttendanceStatus, JustificationStatus } from '@domain/types/enums';

export function startOfDayUtcFromDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

export function endOfDayUtcFromDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export type AttendanceAvecClasse = Prisma.AttendanceGetPayload<{
  include: { class: { select: { id: true; name: true } } };
}>;

export function toPresenceLue(data: AttendanceAvecClasse): PresenceLue {
  return {
    id: data.id,
    schoolId: data.schoolId,
    studentId: data.studentId,
    classId: data.classId,
    academicPeriodId: data.academicPeriodId ?? null,
    subjectId: data.subjectId ?? null,
    teacherId: data.teacherId ?? null,
    recordedById: data.recordedById ?? null,
    date: data.date,
    status: data.status as AttendanceStatus,
    period: data.period as AttendancePeriod,
    arrivedAt: data.arrivedAt ?? null,
    lateNote: data.lateNote ?? null,
    justification: data.justification ?? null,
    justificationStatus: (data.justificationStatus ?? null) as JustificationStatus | null,
    justificationAttachmentUrl: data.justificationAttachmentUrl ?? null,
    submittedByParentId: data.submittedByParentId ?? null,
    previousStatus: (data.previousStatus ?? null) as AttendanceStatus | null,
    updatedById: data.updatedById ?? null,
    updatedAt: data.updatedAt ?? null,
    clientRecordedAt: data.clientRecordedAt ?? null,
    clockSkewSeconds: data.clockSkewSeconds ?? null,
    isOfflineSync: data.isOfflineSync,
    createdAt: data.createdAt,
    class: data.class ? { id: data.class.id, name: data.class.name } : null,
  };
}

export async function correctAttendanceStatus(
  prisma: PrismaClient,
  schoolId: string,
  id: string,
  data: { status: AttendanceStatus; arrivedAt?: Date | null; lateNote?: string | null; updatedById: string },
): Promise<PresenceLue | null> {
  const existant = await prisma.attendance.findFirst({ where: { schoolId, id } });
  if (!existant) return null;
  const updated = await prisma.attendance.update({
    where: { id },
    data: {
      status: data.status,
      arrivedAt: data.arrivedAt === undefined ? existant.arrivedAt : data.arrivedAt,
      lateNote: data.lateNote === undefined ? existant.lateNote : data.lateNote,
      previousStatus: existant.status,
      updatedById: data.updatedById,
    },
    include: { class: { select: { id: true, name: true } } },
  });
  return toPresenceLue(updated);
}

export async function submitAttendanceParentJustification(
  prisma: PrismaClient,
  schoolId: string,
  id: string,
  data: { parentUserId: string; justification: string; attachmentUrl?: string | null },
): Promise<PresenceJustifiee | null> {
  const existant = await prisma.attendance.findFirst({ where: { schoolId, id } });
  if (!existant) return null;
  const updated = await prisma.attendance.update({
    where: { id },
    data: {
      justification: data.justification,
      justificationAttachmentUrl: data.attachmentUrl ?? existant.justificationAttachmentUrl,
      submittedByParentId: data.parentUserId,
      justificationStatus: 'PENDING',
    },
    include: {
      class: { select: { id: true, name: true } },
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return {
    ...toPresenceLue(updated),
    student: updated.student ? { id: updated.student.id, firstName: updated.student.firstName, lastName: updated.student.lastName } : null,
  };
}

export async function justifyAttendanceAbsence(
  prisma: PrismaClient,
  schoolId: string,
  id: string,
  data: { justification?: string; justifiedById: string; justifiedAt: Date; approve?: boolean },
): Promise<PresenceJustifiee | null> {
  const existant = await prisma.attendance.findFirst({ where: { schoolId, id } });
  if (!existant) return null;
  const approve = data.approve !== false;
  const updated = await prisma.attendance.update({
    where: { id },
    data: {
      status: approve ? 'ABSENT_JUSTIFIED' : 'ABSENT',
      justificationStatus: approve ? 'APPROVED' : 'REJECTED',
      justification: data.justification ?? existant.justification,
      justifiedById: data.justifiedById,
      justifiedAt: data.justifiedAt,
      previousStatus: existant.status,
      updatedById: data.justifiedById,
      // Le filtre `schoolId` n'est pas repassable sur update() (pas unique) —
      // l'existence a déjà été vérifiée scopée à l'école juste au-dessus.
    },
    include: {
      class: { select: { id: true, name: true } },
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return {
    ...toPresenceLue(updated),
    student: updated.student ? { id: updated.student.id, firstName: updated.student.firstName, lastName: updated.student.lastName } : null,
  };
}

export async function queryDailyClassStatus(
  prisma: PrismaClient,
  schoolId: string,
  date: Date,
  period?: AttendancePeriod,
): Promise<DailyClassAttendanceStatus[]> {
  const debut = startOfDayUtcFromDate(date);
  const fin = endOfDayUtcFromDate(date);

  const [classes, currentYear, attendances] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        name: true,
        level: true,
        academicYearId: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    }),
    prisma.attendance.findMany({
      where: {
        schoolId,
        date: { gte: debut, lte: fin },
        ...(period ? { period } : {}),
      },
      include: {
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const filteredClasses = currentYear
    ? classes.filter((c) => c.academicYearId === currentYear.id)
    : classes;

  const byClass = new Map<string, typeof attendances>();
  for (const a of attendances) {
    const list = byClass.get(a.classId) ?? [];
    list.push(a);
    byClass.set(a.classId, list);
  }

  return filteredClasses.map((cls) => {
    const rows = byClass.get(cls.id) ?? [];
    const uniqueStudents = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      if (!uniqueStudents.has(r.studentId)) {
        uniqueStudents.set(r.studentId, r);
      }
    }
    const deduped = [...uniqueStudents.values()];
    const lateCount = deduped.filter((r) => r.status === 'LATE' || Boolean(r.arrivedAt)).length;
    const absentCount = deduped.filter((r) => r.status === 'ABSENT' || r.status === 'ABSENT_JUSTIFIED').length;
    const presentCount = deduped.filter((r) => r.status === 'PRESENT' && !r.arrivedAt).length;
    const latest = rows[0] ?? null;

    return {
      classId: cls.id,
      className: cls.name,
      level: cls.level ?? null,
      studentCount: cls._count.enrollments,
      recordedCount: deduped.length,
      presentCount,
      absentCount,
      lateCount,
      isDone: deduped.length > 0,
      recordedAt: latest?.createdAt ?? null,
      recordedBy: latest?.recordedBy
        ? {
            id: latest.recordedBy.id,
            firstName: latest.recordedBy.firstName,
            lastName: latest.recordedBy.lastName,
          }
        : null,
    };
  });
}

export async function queryRepeatedAbsences(
  prisma: PrismaClient,
  schoolId: string,
  minAbsences: number,
  sinceDate: Date,
): Promise<RepeatedAbsenceStudent[]> {
  const rows = await prisma.attendance.findMany({
    where: {
      schoolId,
      date: { gte: sinceDate },
      status: { in: ['ABSENT', 'ABSENT_JUSTIFIED'] },
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      class: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });

  const grouped = new Map<string, RepeatedAbsenceStudent>();
  for (const r of rows) {
    const entry = grouped.get(r.studentId) ?? {
      studentId: r.studentId,
      firstName: r.student.firstName,
      lastName: r.student.lastName,
      classId: r.classId,
      className: r.class.name,
      unjustifiedCount: 0,
      justifiedCount: 0,
      totalAbsences: 0,
      lastAbsenceDate: null,
    };
    if (r.status === 'ABSENT') entry.unjustifiedCount += 1;
    else entry.justifiedCount += 1;
    entry.totalAbsences += 1;
    if (!entry.lastAbsenceDate || r.date > entry.lastAbsenceDate) {
      entry.lastAbsenceDate = r.date;
    }
    grouped.set(r.studentId, entry);
  }

  return [...grouped.values()]
    .filter((s) => s.unjustifiedCount >= minAbsences || s.totalAbsences >= minAbsences)
    .sort((a, b) => b.unjustifiedCount - a.unjustifiedCount || b.totalAbsences - a.totalAbsences);
}

