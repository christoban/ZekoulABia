import type { PrismaClient } from '@prisma/client';
import type { AcademicEventRepository, AcademicEventData, AcademicEventListData } from '@domain/ports/repositories/AcademicEventRepository';

export class PrismaAcademicEventRepository implements AcademicEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async creer(data: {
    schoolId: string;
    createdById: string;
    type: string;
    category: string;
    title: string;
    description?: string;
    targetRoles: string[];
    level?: string;
    openDate?: Date;
    closeDate?: Date;
    status: string;
    linkedResourceId?: string | null;
    entranceExamSessionId?: string | null;
  }): Promise<{ id: string }> {
    const event = await this.prisma.academicEvent.create({
      data: {
        schoolId: data.schoolId,
        createdById: data.createdById,
        type: data.type,
        category: data.category as any,
        title: data.title,
        description: data.description ?? null,
        targetRoles: data.targetRoles,
        level: data.level ?? null,
        openDate: data.openDate ?? null,
        closeDate: data.closeDate ?? null,
        status: data.status as any,
        linkedResourceId: data.linkedResourceId ?? null,
        entranceExamSessionId: data.entranceExamSessionId ?? null,
      },
      select: { id: true },
    });
    return event;
  }

  async trouverParId(id: string, schoolId: string): Promise<AcademicEventData | null> {
    return this.prisma.academicEvent.findFirst({
      where: { id, schoolId },
    });
  }

  async mettreAJour(id: string, data: {
    status?: string;
    openDate?: Date;
    closeDate?: Date;
    triggeredById?: string;
    triggeredAt?: Date;
    linkedResourceId?: string | null;
    reminderSentAt?: null;
  }): Promise<void> {
    await this.prisma.academicEvent.update({
      where: { id },
      data: data as any,
    });
  }

  async listerTous(schoolId: string): Promise<AcademicEventListData[]> {
    return this.prisma.academicEvent.findMany({
      where: { schoolId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        triggeredBy: { select: { firstName: true, lastName: true } },
      },
    }) as unknown as AcademicEventListData[];
  }

  async listerActifs(schoolId: string, role: string, dansQuatorzeJours: Date): Promise<{
    id: string;
    type: string;
    category: string;
    title: string;
    description: string | null;
    openDate: Date | null;
    closeDate: Date | null;
    status: string;
  }[]> {
    return this.prisma.academicEvent.findMany({
      where: {
        schoolId,
        targetRoles: { has: role },
        OR: [
          { status: 'ACTIVE' },
          { status: 'UPCOMING', category: { in: ['FIXED_DATE', 'SLIDING_WINDOW'] }, openDate: { lte: dansQuatorzeJours } },
        ],
      },
      orderBy: { openDate: 'asc' },
      select: {
        id: true, type: true, category: true, title: true, description: true,
        openDate: true, closeDate: true, status: true,
      },
    });
  }

  async trouverAOuvrir(schoolId: string, maintenant: Date): Promise<AcademicEventData[]> {
    return this.prisma.academicEvent.findMany({
      where: { schoolId, status: 'UPCOMING', category: 'FIXED_DATE', openDate: { lte: maintenant } },
    }) as Promise<AcademicEventData[]>;
  }

  async trouverActifsAvecClotureSansRappel(schoolId: string): Promise<AcademicEventData[]> {
    return this.prisma.academicEvent.findMany({
      where: { schoolId, status: 'ACTIVE', closeDate: { not: null }, reminderSentAt: null },
    }) as Promise<AcademicEventData[]>;
  }

  async trouverFenetresGlissantes(schoolId: string, maintenant: Date): Promise<AcademicEventData[]> {
    return this.prisma.academicEvent.findMany({
      where: { schoolId, status: 'ACTIVE', category: 'SLIDING_WINDOW', closeDate: { not: null, gt: maintenant } },
    }) as Promise<AcademicEventData[]>;
  }

  async trouverACloturer(schoolId: string, maintenant: Date): Promise<Pick<AcademicEventData, 'id' | 'type' | 'linkedResourceId'>[]> {
    return this.prisma.academicEvent.findMany({
      where: { schoolId, status: 'ACTIVE', closeDate: { lte: maintenant } },
      select: { id: true, type: true, linkedResourceId: true },
    }) as Promise<Pick<AcademicEventData, 'id' | 'type' | 'linkedResourceId'>[]>;
  }

  async mettreAJourRappel(id: string, date: Date): Promise<void> {
    await this.prisma.academicEvent.update({ where: { id }, data: { reminderSentAt: date } as any });
  }

  async mettreAJourCloture(id: string, closeDate: Date): Promise<void> {
    await this.prisma.academicEvent.update({ where: { id }, data: { closeDate } as any });
  }

  async mettreAJourStatutEtRessource(id: string, data: { status: string; linkedResourceId: string | null }): Promise<void> {
    await this.prisma.academicEvent.update({ where: { id }, data: { status: data.status as any, linkedResourceId: data.linkedResourceId } as any });
  }

  async cloturerParIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.academicEvent.updateMany({ where: { id: { in: ids } }, data: { status: 'CLOSED' as any } });
  }
}
