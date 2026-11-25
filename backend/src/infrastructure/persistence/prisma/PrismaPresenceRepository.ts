import type { PrismaClient, Attendance } from '@prisma/client';
import { Presence } from '@domain/entities/Presence';
import type {
  PresenceRepository,
  StatistiquesPresence,
  PresenceSmsRecord,
  FiltrePresences,
  PresenceLue,
  PresenceJustifiee,
  DailyClassAttendanceStatus,
  RepeatedAbsenceStudent,
} from '@domain/ports/repositories/PresenceRepository';
import type { AttendanceStatus, AttendancePeriod, JustificationStatus } from '@domain/types/enums';
import {
  correctAttendanceStatus,
  endOfDayUtcFromDate,
  justifyAttendanceAbsence,
  queryDailyClassStatus,
  queryRepeatedAbsences,
  startOfDayUtcFromDate,
  submitAttendanceParentJustification,
  toPresenceLue,
} from './helpers/presenceSupervisionOps';

function whereFromFiltre(schoolId: string, filtre: FiltrePresences): Record<string, unknown> {
  const where: Record<string, unknown> = { schoolId };
  if (filtre.classId) where.classId = filtre.classId;
  if (filtre.studentId) {
    where.studentId = Array.isArray(filtre.studentId) ? { in: filtre.studentId } : filtre.studentId;
  }
  if (filtre.dateDebut || filtre.dateFin) {
    where.date = {
      ...(filtre.dateDebut ? { gte: filtre.dateDebut } : {}),
      ...(filtre.dateFin ? { lte: filtre.dateFin } : {}),
    };
  }
  if (filtre.status) where.status = filtre.status;
  if (filtre.period) where.period = filtre.period;
  if (filtre.subjectId) where.subjectId = filtre.subjectId;
  if (filtre.since) where.createdAt = { gt: filtre.since };
  return where;
}

export class PrismaPresenceRepository implements PresenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Presence | null> {
    const data = await this.prisma.attendance.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByEleve(studentId: string, academicPeriodId: string): Promise<Presence[]> {
    const data = await this.prisma.attendance.findMany({
      where: { studentId, academicPeriodId },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByClasse(
    classId: string,
    date: Date,
    period: AttendancePeriod
  ): Promise<Presence[]> {
    const debut = new Date(date);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(date);
    fin.setHours(23, 59, 59, 999);

    const data = await this.prisma.attendance.findMany({
      where: {
        classId,
        period,
        date: { gte: debut, lte: fin },
      },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByClasseEtPeriode(
    classId: string,
    academicPeriodId: string
  ): Promise<Presence[]> {
    const data = await this.prisma.attendance.findMany({
      where: { classId, academicPeriodId },
    });
    return data.map(d => this.toDomain(d));
  }

  async countAbsencesNonJustifiees(
    studentId: string,
    academicPeriodId: string
  ): Promise<number> {
    return this.prisma.attendance.count({
      where: { studentId, academicPeriodId, status: 'ABSENT' },
    });
  }

  async countAbsencesEtRetards(schoolId: string, studentId: string, academicPeriodId: string): Promise<number> {
    return this.prisma.attendance.count({
      where: { schoolId, studentId, academicPeriodId, status: { in: ['ABSENT', 'ABSENT_JUSTIFIED'] } },
    });
  }

  async compterPresencesDepuis(filtre: {
    schoolId: string;
    classId?: string;
    teacherId?: string;
    studentId?: string;
    depuis: Date;
  }): Promise<{ present: number; total: number }> {
    const where: Record<string, unknown> = {
      schoolId: filtre.schoolId,
      date: { gte: filtre.depuis },
    };
    if (filtre.classId) where.classId = filtre.classId;
    if (filtre.teacherId) where.teacherId = filtre.teacherId;
    if (filtre.studentId) where.studentId = filtre.studentId;

    const rows = await this.prisma.attendance.findMany({
      where,
      select: { status: true },
    });
    const total = rows.length;
    const present = rows.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    return { present, total };
  }

  async countAbsencesConsecutives(studentId: string): Promise<number> {
    const dernieres = await this.prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 10,
    });

    let consecutives = 0;
    for (const p of dernieres) {
      if (p.status === 'ABSENT') {
        consecutives++;
      } else {
        break;
      }
    }
    return consecutives;
  }

  async getStatistiquesEleve(
    studentId: string,
    academicPeriodId: string
  ): Promise<StatistiquesPresence> {
    const toutes = await this.prisma.attendance.findMany({
      where: { studentId, academicPeriodId },
    });

    const total = toutes.length;
    const retards = toutes.filter(p => p.status === 'LATE' || Boolean(p.arrivedAt)).length;
    const presents = toutes.filter(p => p.status === 'PRESENT' && !p.arrivedAt).length;
    const absents = toutes.filter(p => p.status === 'ABSENT' || p.status === 'ABSENT_JUSTIFIED').length;

    return {
      totalJours: total,
      joursPresent: presents,
      joursAbsent: absents,
      joursRetard: retards,
      tauxPresence: total > 0 ? Math.round(((presents + retards) / total) * 100) : 100,
    };
  }

  async existeDeja(
    studentId: string,
    date: Date,
    period: AttendancePeriod
  ): Promise<boolean> {
    if (!studentId) return false;
    const debut = startOfDayUtcFromDate(date);
    const fin = endOfDayUtcFromDate(date);

    const count = await this.prisma.attendance.count({
      where: {
        studentId,
        period,
        date: { gte: debut, lte: fin },
      },
    });
    return count > 0;
  }

  async save(presence: Presence): Promise<void> {
    const data = presence.toObject();
    await this.prisma.attendance.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        studentId: data.studentId,
        classId: data.classId,
        academicPeriodId: data.academicPeriodId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        recordedById: data.recordedById,
        date: data.date,
        status: data.status,
        period: data.period,
        arrivedAt: data.arrivedAt ?? null,
        lateNote: data.lateNote ?? null,
        isOfflineSync: data.isOfflineSync,
        syncedAt: data.syncedAt ?? null,
        clientRecordedAt: data.clientRecordedAt ?? null,
        clockSkewSeconds: data.clockSkewSeconds ?? null,
        createdAt: data.createdAt,
      },
    });
  }

  async saveMany(presences: Presence[]): Promise<void> {
    const data = presences.map(p => {
      const obj = p.toObject();
      return {
        id: obj.id,
        schoolId: obj.schoolId,
        studentId: obj.studentId,
        classId: obj.classId,
        academicPeriodId: obj.academicPeriodId ?? null,
        subjectId: obj.subjectId ?? null,
        teacherId: obj.teacherId ?? null,
        recordedById: obj.recordedById ?? null,
        date: obj.date,
        status: obj.status,
        period: obj.period,
        arrivedAt: obj.arrivedAt ?? null,
        lateNote: obj.lateNote ?? null,
        isOfflineSync: obj.isOfflineSync,
        syncedAt: obj.syncedAt ?? null,
        clientRecordedAt: obj.clientRecordedAt ?? null,
        clockSkewSeconds: obj.clockSkewSeconds ?? null,
        createdAt: obj.createdAt,
      };
    });
    await this.prisma.attendance.createMany({ data });
  }

  async upsertMany(presences: Presence[], updatedById: string): Promise<Presence[]> {
    const saved: Presence[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const p of presences) {
        const obj = p.toObject();
        const debut = startOfDayUtcFromDate(obj.date);
        const fin = endOfDayUtcFromDate(obj.date);
        const existing = await tx.attendance.findFirst({
          where: {
            schoolId: obj.schoolId,
            studentId: obj.studentId,
            period: obj.period,
            date: { gte: debut, lte: fin },
            subjectId: obj.subjectId ?? null,
          },
        });

        if (existing) {
          const updated = await tx.attendance.update({
            where: { id: existing.id },
            data: {
              status: obj.status,
              arrivedAt: obj.arrivedAt ?? null,
              lateNote: obj.lateNote ?? null,
              previousStatus: existing.status !== obj.status ? existing.status : existing.previousStatus,
              updatedById,
              isOfflineSync: obj.isOfflineSync,
              syncedAt: obj.syncedAt ?? new Date(),
              clientRecordedAt: obj.clientRecordedAt ?? existing.clientRecordedAt,
              clockSkewSeconds: obj.clockSkewSeconds ?? existing.clockSkewSeconds,
            },
          });
          saved.push(this.toDomain(updated));
        } else {
          const created = await tx.attendance.create({
            data: {
              id: obj.id,
              schoolId: obj.schoolId,
              studentId: obj.studentId,
              classId: obj.classId,
              academicPeriodId: obj.academicPeriodId ?? null,
              subjectId: obj.subjectId ?? null,
              teacherId: obj.teacherId ?? null,
              recordedById: obj.recordedById ?? null,
              date: obj.date,
              status: obj.status,
              period: obj.period,
              arrivedAt: obj.arrivedAt ?? null,
              lateNote: obj.lateNote ?? null,
              isOfflineSync: obj.isOfflineSync,
              syncedAt: obj.syncedAt ?? null,
              clientRecordedAt: obj.clientRecordedAt ?? null,
              clockSkewSeconds: obj.clockSkewSeconds ?? null,
              createdAt: obj.createdAt,
            },
          });
          saved.push(this.toDomain(created));
        }
      }
    });
    return saved;
  }

  async update(presence: Presence): Promise<void> {
    const data = presence.toObject();
    await this.prisma.attendance.update({
      where: { id: data.id },
      data: {
        status: data.status,
        arrivedAt: data.arrivedAt ?? null,
        lateNote: data.lateNote ?? null,
        isOfflineSync: data.isOfflineSync,
        syncedAt: data.syncedAt ?? null,
      },
    });
  }

  async synchroniserPresencesSms(records: PresenceSmsRecord[]): Promise<void> {
    for (const record of records) {
      const existing = await this.prisma.attendance.findFirst({
        where: {
          schoolId: record.schoolId,
          studentId: record.studentId,
          classId: record.classId,
          date: record.date,
          period: record.period,
        },
      });

      if (existing) {
        await this.prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: record.status,
            recordedById: record.recordedById,
            teacherId: record.teacherId,
          },
        });
      } else {
        await this.prisma.attendance.create({
          data: {
            schoolId: record.schoolId,
            studentId: record.studentId,
            classId: record.classId,
            date: record.date,
            status: record.status,
            period: record.period,
            recordedById: record.recordedById,
            academicPeriodId: null,
            subjectId: null,
            teacherId: record.teacherId,
            isOfflineSync: false,
            syncedAt: new Date(),
          },
        });
      }
    }
  }

  async findByClasseEtEleves(classId: string, studentIds: string[]): Promise<Array<{ studentId: string; status: string }>> {
    if (studentIds.length === 0) return [];
    const data = await this.prisma.attendance.findMany({
      where: { classId, studentId: { in: studentIds } },
      select: { studentId: true, status: true },
    });
    return data.map(d => ({ studentId: d.studentId, status: d.status }));
  }

  async findPresencesHorsLigneEnAttente(userId: string): Promise<Presence[]> {
    const data = await this.prisma.attendance.findMany({
      where: { recordedById: userId, isOfflineSync: true },
    });
    return data.map(d => this.toDomain(d));
  }

  async findAvecClasse(
    params: { schoolId: string; filtre: FiltrePresences; skip: number; take: number },
  ): Promise<PresenceLue[]> {
    const data = await this.prisma.attendance.findMany({
      where: whereFromFiltre(params.schoolId, params.filtre),
      include: { class: { select: { id: true, name: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: params.skip,
      take: params.take,
    });
    return data.map(d => toPresenceLue(d));
  }

  async countByFiltre(schoolId: string, filtre: FiltrePresences): Promise<number> {
    return this.prisma.attendance.count({ where: whereFromFiltre(schoolId, filtre) });
  }

  async findByIdDansEcole(schoolId: string, id: string): Promise<Presence | null> {
    const data = await this.prisma.attendance.findFirst({ where: { schoolId, id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async correctStatus(
    schoolId: string,
    id: string,
    data: { status: AttendanceStatus; arrivedAt?: Date | null; lateNote?: string | null; updatedById: string },
  ): Promise<PresenceLue | null> {
    return correctAttendanceStatus(this.prisma, schoolId, id, data);
  }

  async submitParentJustification(
    schoolId: string,
    id: string,
    data: { parentUserId: string; justification: string; attachmentUrl?: string | null },
  ): Promise<PresenceJustifiee | null> {
    return submitAttendanceParentJustification(this.prisma, schoolId, id, data);
  }

  async justifierAbsence(
    schoolId: string,
    id: string,
    data: { justification?: string; justifiedById: string; justifiedAt: Date; approve?: boolean },
  ): Promise<PresenceJustifiee | null> {
    return justifyAttendanceAbsence(this.prisma, schoolId, id, data);
  }

  async getDailyClassStatus(
    schoolId: string,
    date: Date,
    period?: AttendancePeriod,
  ): Promise<DailyClassAttendanceStatus[]> {
    return queryDailyClassStatus(this.prisma, schoolId, date, period);
  }

  async getRepeatedAbsences(
    schoolId: string,
    minAbsences: number,
    sinceDate: Date,
  ): Promise<RepeatedAbsenceStudent[]> {
    return queryRepeatedAbsences(this.prisma, schoolId, minAbsences, sinceDate);
  }

  private toDomain(data: Attendance): Presence {
    return Presence.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      studentId: data.studentId,
      classId: data.classId,
      academicPeriodId: data.academicPeriodId ?? undefined,
      subjectId: data.subjectId ?? undefined,
      teacherId: data.teacherId ?? undefined,
      recordedById: data.recordedById ?? undefined,
      date: data.date,
      status: data.status as AttendanceStatus,
      period: data.period as AttendancePeriod,
      arrivedAt: data.arrivedAt ?? undefined,
      lateNote: data.lateNote ?? undefined,
      justification: data.justification ?? undefined,
      justificationStatus: (data.justificationStatus ?? undefined) as JustificationStatus | undefined,
      justificationAttachmentUrl: data.justificationAttachmentUrl ?? undefined,
      submittedByParentId: data.submittedByParentId ?? undefined,
      justifiedById: data.justifiedById ?? undefined,
      justifiedAt: data.justifiedAt ?? undefined,
      previousStatus: (data.previousStatus ?? undefined) as AttendanceStatus | undefined,
      updatedById: data.updatedById ?? undefined,
      updatedAt: data.updatedAt ?? undefined,
      isOfflineSync: data.isOfflineSync,
      syncedAt: data.syncedAt ?? undefined,
      clientRecordedAt: data.clientRecordedAt ?? undefined,
      clockSkewSeconds: data.clockSkewSeconds ?? undefined,
      createdAt: data.createdAt,
    });
  }
}
