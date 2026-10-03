import type { PrismaClient } from '@prisma/client';
import { Presence } from '@domain/entities/Presence';
import type { PresenceRepository, StatistiquesPresence, PresenceSmsRecord, FiltrePresences, PresenceLue, PresenceJustifiee } from '@domain/ports/repositories/PresenceRepository';
import type { AttendanceStatus, AttendancePeriod } from '@domain/types/enums';

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
  if (filtre.since) where.createdAt = { gt: filtre.since };
  return where;
}

function toPresenceLue(data: any): PresenceLue {
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
    status: data.status,
    period: data.period,
    isOfflineSync: data.isOfflineSync,
    createdAt: data.createdAt,
    class: data.class ? { id: data.class.id, name: data.class.name } : null,
  };
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
      where: { schoolId, studentId, academicPeriodId, status: { in: ['ABSENT', 'ABSENT_JUSTIFIED'] as any } },
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
    const presents = toutes.filter(p => p.status === 'PRESENT').length;
    const absents = toutes.filter(p => p.status === 'ABSENT' || p.status === 'ABSENT_JUSTIFIED').length;
    const retards = toutes.filter(p => p.status === 'LATE').length;

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
    const debut = new Date(date);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(date);
    fin.setHours(23, 59, 59, 999);

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
        isOfflineSync: data.isOfflineSync,
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
        isOfflineSync: obj.isOfflineSync,
        createdAt: obj.createdAt,
      };
    });
    await this.prisma.attendance.createMany({ data });
  }

  async update(presence: Presence): Promise<void> {
    const data = presence.toObject();
    await this.prisma.attendance.update({
      where: { id: data.id },
      data: {
        status: data.status,
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

  async justifierAbsence(
    schoolId: string,
    id: string,
    data: { justification?: string; justifiedById: string; justifiedAt: Date },
  ): Promise<PresenceJustifiee | null> {
    const existant = await this.prisma.attendance.findFirst({ where: { schoolId, id } });
    if (!existant) return null;
    const updated = await this.prisma.attendance.update({
      where: { id },
      data: {
        status: 'ABSENT_JUSTIFIED',
        justification: data.justification,
        justifiedById: data.justifiedById,
        justifiedAt: data.justifiedAt,
        // Le filtre `schoolId` n'est pas replable sur update() (pas unique) —
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

  private toDomain(data: any): Presence {
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
      isOfflineSync: data.isOfflineSync,
      syncedAt: data.syncedAt ?? undefined,
      createdAt: data.createdAt,
    });
  }
}
