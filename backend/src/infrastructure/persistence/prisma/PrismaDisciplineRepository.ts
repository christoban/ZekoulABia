import type { PrismaClient, Prisma, DisciplineType, DisciplineStatus, DisciplineCouncilStatus } from '@prisma/client';
import type { DisciplineRepository, DisciplineSessionData, DisciplineRecordData } from '@domain/ports/repositories/DisciplineRepository';

export class PrismaDisciplineRepository implements DisciplineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async verifierEleve(studentId: string, schoolId: string): Promise<boolean> {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, schoolId, role: 'STUDENT' },
      select: { id: true },
    });
    return !!student;
  }

  async findRecordsBySchool(schoolId: string, filters: { studentId?: string; type?: string; status?: string; page: number; limit: number }): Promise<DisciplineRecordData[]> {
    return this.prisma.disciplineRecord.findMany({
      where: { schoolId, ...(filters.studentId ? { studentId: filters.studentId } : {}), ...(filters.type ? { type: filters.type as DisciplineType } : {}), ...(filters.status ? { status: filters.status as DisciplineStatus } : {}) },
      include: { student: { select: { id: true, firstName: true, lastName: true } }, decidedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });
  }

  async countRecordsBySchool(schoolId: string, filters: { studentId?: string; type?: string; status?: string }): Promise<number> {
    return this.prisma.disciplineRecord.count({
      where: { schoolId, ...(filters.studentId ? { studentId: filters.studentId } : {}), ...(filters.type ? { type: filters.type as DisciplineType } : {}), ...(filters.status ? { status: filters.status as DisciplineStatus } : {}) },
    });
  }

  async trouverRecord(id: string, schoolId: string): Promise<DisciplineRecordData | null> {
    return this.prisma.disciplineRecord.findFirst({ where: { id, schoolId } });
  }

  async leverRecord(id: string): Promise<DisciplineRecordData> {
    return this.prisma.disciplineRecord.update({
      where: { id },
      data: { status: 'LIFTED' },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async findParentEmails(studentId: string): Promise<string[]> {
    const parentLinks = await this.prisma.parentStudent.findMany({
      where: { studentProfile: { userId: studentId } },
      include: { parentProfile: { include: { user: { select: { email: true } } } } },
    });
    return parentLinks.map((l) => l.parentProfile?.user?.email).filter((e): e is string => Boolean(e));
  }

  async creerSession(data: {
    schoolId: string;
    studentId: string;
    presidedById: string;
    motif: string;
    composition: unknown;
    parentNotifiedAt: Date;
    scheduledAt: Date;
  }): Promise<DisciplineSessionData> {
    return this.prisma.disciplineCouncilSession.create({
      data: {
        schoolId: data.schoolId,
        studentId: data.studentId,
        presidedById: data.presidedById,
        motif: data.motif,
        composition: data.composition as Prisma.InputJsonValue,
        parentNotifiedAt: data.parentNotifiedAt,
        scheduledAt: data.scheduledAt,
      },
    });
  }

  async trouverSession(id: string, schoolId: string): Promise<DisciplineSessionData | null> {
    return this.prisma.disciplineCouncilSession.findFirst({
      where: { id, schoolId },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async listerSessions(schoolId: string, status?: string): Promise<DisciplineSessionData[]> {
    return this.prisma.disciplineCouncilSession.findMany({
      where: { schoolId, ...(status ? { status: status as DisciplineCouncilStatus } : {}) },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        presidedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async creerRecord(data: {
    schoolId: string;
    studentId: string;
    type: string;
    reason: string;
    decidedById: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<DisciplineRecordData> {
    return this.prisma.disciplineRecord.create({
      data: {
        schoolId: data.schoolId,
        studentId: data.studentId,
        type: data.type as DisciplineType,
        reason: data.reason,
        decidedById: data.decidedById,
        ...(data.startDate ? { startDate: data.startDate } : {}),
        ...(data.endDate ? { endDate: data.endDate } : {}),
      },
    });
  }

  async mettreAJourSession(id: string, data: {
    heldAt: Date;
    decision: string;
    pv: string;
    status: string;
    disciplineRecordId: string;
  }): Promise<DisciplineSessionData & { disciplineRecord: DisciplineRecordData | null }> {
    return this.prisma.disciplineCouncilSession.update({
      where: { id },
      data: {
        heldAt: data.heldAt,
        decision: data.decision as DisciplineType,
        pv: data.pv,
        status: data.status as DisciplineCouncilStatus,
        disciplineRecordId: data.disciplineRecordId,
      },
      include: { disciplineRecord: true },
    });
  }
}
