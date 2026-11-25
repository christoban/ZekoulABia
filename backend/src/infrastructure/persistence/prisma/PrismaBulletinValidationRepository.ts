import type { PrismaClient } from '@prisma/client';
import type { BulletinValidationRepository, BulletinValidationSessionData } from '@domain/ports/repositories/BulletinValidationRepository';
import type { BulletinValidationStatus } from '@domain/types/enums';

export class PrismaBulletinValidationRepository implements BulletinValidationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerSessions(schoolId: string, filters?: { classId?: string; academicPeriodId?: string; status?: BulletinValidationStatus }): Promise<BulletinValidationSessionData[]> {
    return this.prisma.bulletinValidationSession.findMany({
      where: {
        schoolId,
        ...(filters?.classId ? { classId: filters.classId } : {}),
        ...(filters?.academicPeriodId ? { academicPeriodId: filters.academicPeriodId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        academicPeriod: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    }) as Promise<BulletinValidationSessionData[]>;
  }

  async sessionExistante(classId: string, academicPeriodId: string): Promise<BulletinValidationSessionData | null> {
    return this.prisma.bulletinValidationSession.findFirst({
      where: { classId, academicPeriodId },
    }) as Promise<BulletinValidationSessionData | null>;
  }

  async creerSession(data: { schoolId: string; classId: string; academicPeriodId: string; submittedById: string }): Promise<BulletinValidationSessionData> {
    return this.prisma.bulletinValidationSession.create({
      data: { ...data, status: 'SUBMITTED' },
      include: {
        class: { select: { id: true, name: true, level: true } },
        academicPeriod: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
        school: { select: { name: true, city: true, phone: true } },
      },
    }) as Promise<BulletinValidationSessionData>;
  }

  async obtenirSession(sessionId: string, schoolId: string): Promise<BulletinValidationSessionData | null> {
    return this.prisma.bulletinValidationSession.findFirst({
      where: { id: sessionId, schoolId },
      include: {
        class: { select: { id: true, name: true, level: true } },
        academicPeriod: { select: { id: true, name: true, orderIndex: true, academicYear: { select: { name: true } } } },
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true } },
        school: { select: { name: true, city: true, phone: true } },
      },
    }) as Promise<BulletinValidationSessionData | null>;
  }

  async validerSession(sessionId: string, validatedById: string): Promise<BulletinValidationSessionData> {
    return this.prisma.bulletinValidationSession.update({
      where: { id: sessionId },
      data: { status: 'VALIDATED', validatedById, validatedAt: new Date() },
      include: {
        class: { select: { id: true, name: true, level: true } },
        academicPeriod: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true } },
        school: { select: { name: true, city: true, phone: true } },
      },
    }) as Promise<BulletinValidationSessionData>;
  }

  async publierSession(sessionId: string): Promise<BulletinValidationSessionData> {
    return this.prisma.bulletinValidationSession.update({
      where: { id: sessionId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: {
        class: { select: { id: true, name: true, level: true } },
        academicPeriod: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true } },
        school: { select: { name: true, city: true, phone: true } },
      },
    }) as Promise<BulletinValidationSessionData>;
  }
}