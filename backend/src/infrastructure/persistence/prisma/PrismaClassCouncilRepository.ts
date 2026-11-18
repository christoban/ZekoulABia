import type { PrismaClient, CouncilDecision } from '@prisma/client';
import type { ClassCouncilRepository, ClassCouncilSessionData, ClassCouncilDecisionData } from '@domain/ports/repositories/ClassCouncilRepository';

export class PrismaClassCouncilRepository implements ClassCouncilRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async sessionVerrouilleeExiste(classId: string, academicPeriodId: string): Promise<boolean> {
    const count = await this.prisma.classCouncilSession.count({
      where: { classId, academicPeriodId, status: 'LOCKED' },
    });
    return count > 0;
  }

  async listerSessions(schoolId: string, filters?: { classId?: string; academicPeriodId?: string }): Promise<ClassCouncilSessionData[]> {
    return this.prisma.classCouncilSession.findMany({
      where: {
        schoolId,
        ...(filters?.classId ? { classId: filters.classId } : {}),
        ...(filters?.academicPeriodId ? { academicPeriodId: filters.academicPeriodId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        academicPeriod: { select: { id: true, name: true } },
        _count: { select: { decisions: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ClassCouncilSessionData[]>;
  }

  async obtenirSession(sessionId: string, schoolId: string): Promise<ClassCouncilSessionData | null> {
    return this.prisma.classCouncilSession.findFirst({
      where: { id: sessionId, schoolId },
      include: {
        class: { select: { id: true, name: true, level: true } },
        academicPeriod: { select: { id: true, name: true, orderIndex: true, academicYear: { select: { name: true } } } },
        presidedBy: { select: { id: true, firstName: true, lastName: true } },
        decisions: {
          include: { student: { select: { id: true, firstName: true, lastName: true, studentProfile: { select: { healthScore: true } } } } },
          orderBy: { student: { lastName: 'asc' } },
        },
        school: { select: { name: true, city: true, phone: true } },
      },
    }) as Promise<ClassCouncilSessionData | null>;
  }

  async obtenirConfigAlertes(schoolId: string): Promise<{ aiRiskThreshold: number; aiRiskThresholdCritical: number } | null> {
    return this.prisma.schoolConfig
      .findUnique({ where: { schoolId }, select: { aiRiskThreshold: true, aiRiskThresholdCritical: true } })
      .catch(() => null);
  }

  async obtenirEnfantsParent(userId: string): Promise<string[]> {
    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId },
      include: { children: { include: { studentProfile: true } } },
    });
    return (parentProfile?.children ?? [])
      .map(c => c.studentProfile?.userId)
      .filter((id): id is string => Boolean(id));
  }

  async creerSession(data: { schoolId: string; classId: string; academicPeriodId: string; presidedById: string }): Promise<ClassCouncilSessionData> {
    return this.prisma.classCouncilSession.create({
      data: { ...data, status: 'OPEN' },
      include: {
        class: { select: { id: true, name: true } },
        academicPeriod: { select: { id: true, name: true } },
        presidedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }) as Promise<ClassCouncilSessionData>;
  }

  async preRemplirDecisions(sessionId: string, studentIds: string[]): Promise<void> {
    if (studentIds.length === 0) return;
    await this.prisma.classCouncilDecision.createMany({
      data: studentIds.map(studentId => ({
        sessionId,
        studentId,
        decision: 'DELIBERATION' as CouncilDecision,
        observations: null,
      })),
      skipDuplicates: true,
    });
  }

  async upsertDecision(sessionId: string, studentId: string, decision: CouncilDecision, observations?: string | null): Promise<ClassCouncilDecisionData> {
    return this.prisma.classCouncilDecision.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      create: { sessionId, studentId, decision, observations: observations ?? null },
      update: { decision, observations: observations ?? null },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    }) as Promise<ClassCouncilDecisionData>;
  }

  async upsertDecisionsEnBloc(sessionId: string, decisions: { studentId: string; decision: CouncilDecision; observations?: string | null }[]): Promise<number> {
    const results = await Promise.all(
      decisions.map(d =>
        this.prisma.classCouncilDecision.upsert({
          where: { sessionId_studentId: { sessionId, studentId: d.studentId } },
          create: { sessionId, studentId: d.studentId, decision: d.decision, observations: d.observations ?? null },
          update: { decision: d.decision, observations: d.observations ?? null },
        })
      )
    );
    return results.length;
  }

  async verrouillerSession(sessionId: string): Promise<ClassCouncilSessionData> {
    return this.prisma.classCouncilSession.update({
      where: { id: sessionId },
      data: { status: 'LOCKED', validatedAt: new Date() },
    }) as Promise<ClassCouncilSessionData>;
  }

  async compterNotesNonValidees(schoolId: string, classId: string, academicPeriodId: string): Promise<number> {
    return this.prisma.grade.count({
      where: {
        schoolId,
        classId,
        sequence: { academicPeriodId },
        validationStatus: { notIn: ['LOCKED'] },
      },
    });
  }

  async classeExiste(classId: string, schoolId: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true },
    });
  }

  async sessionExistente(classId: string, academicPeriodId: string): Promise<ClassCouncilSessionData | null> {
    return this.prisma.classCouncilSession.findFirst({
      where: { classId, academicPeriodId },
      include: { decisions: true },
    }) as Promise<ClassCouncilSessionData | null>;
  }

  async compterDecisions(sessionId: string): Promise<number> {
    return this.prisma.classCouncilDecision.count({ where: { sessionId } });
  }

  async eleveDansClasse(studentId: string, classId: string): Promise<boolean> {
    const count = await this.prisma.studentProfile.count({
      where: {
        userId: studentId,
        enrollmentsYearScoped: {
          some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
        },
      },
    });
    return count > 0;
  }

  async obtenirMoyennesElevesParClasse(classId: string, academicPeriodId: string): Promise<Map<string, number>> {
    const notes = await this.prisma.grade.findMany({
      where: {
        classId,
        sequence: { academicPeriodId },
        validationStatus: { in: ['LOCKED'] },
        sequenceAverage: { not: null },
      },
      select: { studentId: true, sequenceAverage: true, coefficient: true },
    });

    const accum = new Map<string, { somme: number; poids: number }>();
    for (const n of notes) {
      const cur = accum.get(n.studentId) ?? { somme: 0, poids: 0 };
      cur.somme += (n.sequenceAverage ?? 0) * n.coefficient;
      cur.poids += n.coefficient;
      accum.set(n.studentId, cur);
    }

    const result = new Map<string, number>();
    for (const [studentId, { somme, poids }] of accum) {
      result.set(studentId, poids > 0 ? Math.round((somme / poids) * 100) / 100 : 0);
    }
    return result;
  }

  async elevesDansClasse(classId: string): Promise<string[]> {
    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        enrollmentsYearScoped: {
          some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
        },
      },
      select: { userId: true },
    });
    return profiles.map(p => p.userId);
  }

  async findClassIdsAvecConseilVerrouille(schoolId: string, academicPeriodId: string): Promise<string[]> {
    const sessions = await this.prisma.classCouncilSession.findMany({
      where: { schoolId, academicPeriodId, status: 'LOCKED' },
      select: { classId: true },
    });
    return sessions.map((s) => s.classId);
  }

  async listLockedPeriodIdsForClasse(classId: string, schoolId: string): Promise<string[]> {
    const sessions = await this.prisma.classCouncilSession.findMany({
      where: { classId, schoolId, status: 'LOCKED' },
      select: { academicPeriodId: true },
    });
    return sessions.map((s) => s.academicPeriodId);
  }
}
