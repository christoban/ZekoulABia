import type { PrismaClient, PebsExamStatus as PebsExamStatusPrisma, SelectionResult } from '@prisma/client';
import type {
  PebsExamRepository,
  PebsSessionData,
  PebsCandidateData,
  PebsExamStatus,
  PebsSelectionResult,
} from '@domain/ports/repositories/PebsExamRepository';

export class PrismaPebsExamRepository implements PebsExamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerSessions(schoolId: string): Promise<PebsSessionData[]> {
    return this.prisma.pebsExamSession.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<PebsSessionData[]>;
  }

  async trouverSession(sessionId: string): Promise<PebsSessionData | null> {
    return this.prisma.pebsExamSession.findUnique({ where: { id: sessionId } }) as Promise<PebsSessionData | null>;
  }

  async creerSession(data: {
    schoolId: string;
    name: string;
    examDate: Date;
    level: string;
    academicYearId: string;
    selectionThreshold?: number | null;
    availableSeats?: number | null;
    targetClassId: string;
  }): Promise<PebsSessionData> {
    return this.prisma.pebsExamSession.create({
      data: {
        schoolId: data.schoolId,
        name: data.name,
        examDate: data.examDate,
        level: data.level,
        academicYearId: data.academicYearId,
        selectionThreshold: data.selectionThreshold ?? null,
        availableSeats: data.availableSeats ?? null,
        targetClassId: data.targetClassId,
        status: 'DRAFT',
      },
    }) as Promise<PebsSessionData>;
  }

  async mettreAJourStatutSession(sessionId: string, status: PebsExamStatus): Promise<void> {
    await this.prisma.pebsExamSession.update({
      where: { id: sessionId },
      data: { status: status as PebsExamStatusPrisma },
    });
  }

  async trouverCandidatParProfil(sessionId: string, studentProfileId: string): Promise<{ id: string } | null> {
    return this.prisma.pebsExamCandidate.findFirst({
      where: { sessionId, studentProfileId },
      select: { id: true },
    });
  }

  async trouverProfilAvecClasse(profileId: string, schoolId: string): Promise<{ id: string; classId: string | null } | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { id: profileId, user: { schoolId } },
      select: {
        id: true,
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { classId: true },
          take: 1,
        },
      },
    });
    if (!profile) return null;
    return { id: profile.id, classId: profile.enrollmentsYearScoped?.[0]?.classId ?? null };
  }

  async creerCandidat(data: { sessionId: string; studentProfileId: string; currentClassId: string | null }): Promise<{ id: string }> {
    return this.prisma.pebsExamCandidate.create({
      data: {
        sessionId: data.sessionId,
        studentProfileId: data.studentProfileId,
        currentClassId: data.currentClassId,
        selectionResult: 'PENDING',
      },
      select: { id: true },
    });
  }

  async listerCandidatsAvecProfil(sessionId: string, selectionResults?: PebsSelectionResult[]): Promise<PebsCandidateData[]> {
    return this.prisma.pebsExamCandidate.findMany({
      where: {
        sessionId,
        ...(selectionResults ? { selectionResult: { in: selectionResults as SelectionResult[] } } : {}),
      },
      include: {
        studentProfile: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              select: { class: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    }) as Promise<PebsCandidateData[]>;
  }

  async listerCandidatsAvecNote(sessionId: string): Promise<PebsCandidateData[]> {
    return this.prisma.pebsExamCandidate.findMany({
      where: { sessionId, examScore: { not: null } },
      orderBy: { examScore: 'desc' },
    }) as Promise<PebsCandidateData[]>;
  }

  async mettreAJourScoreCandidat(candidateId: string, examScore: number): Promise<void> {
    await this.prisma.pebsExamCandidate.update({
      where: { id: candidateId },
      data: { examScore },
    });
  }

  async mettreAJourResultatCandidat(candidateId: string, selectionResult: PebsSelectionResult): Promise<void> {
    await this.prisma.pebsExamCandidate.update({
      where: { id: candidateId },
      data: { selectionResult: selectionResult as SelectionResult },
    });
  }

  async trouverClasseCible(classId: string): Promise<{ schoolId: string; academicYearId: string } | null> {
    return this.prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true, academicYearId: true },
    });
  }

  async trouverAdminEcole(schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { schoolId, role: 'ADMIN' },
      select: { id: true },
    });
  }

  async trouverEcoleSubsystem(schoolId: string): Promise<{ subsystem: string } | null> {
    return this.prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } });
  }
}