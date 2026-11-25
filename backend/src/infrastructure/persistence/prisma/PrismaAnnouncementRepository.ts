import type { PrismaClient } from '@prisma/client';
import type {
  AnnouncementRepository,
  AnnonceData,
  CreerAnnonceData,
  ModifierAnnonceData,
  AnnonceAuteurRef,
} from '@domain/ports/repositories/AnnouncementRepository';

export class PrismaAnnouncementRepository implements AnnouncementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async creer(data: CreerAnnonceData): Promise<AnnonceData> {
    return this.prisma.announcement.create({
      data: {
        schoolId: data.schoolId,
        authorId: data.authorId,
        title: data.title,
        content: data.content,
        targetRoles: data.targetRoles,
        isPinned: data.isPinned,
        expiresAt: data.expiresAt,
      },
    }) as Promise<AnnonceData>;
  }

  async lister(schoolId: string, role: string): Promise<AnnonceData[]> {
    const now = new Date();
    const conditionExpiration = {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    };

    const where: Record<string, unknown> = {
      schoolId,
      AND: role === 'ADMIN'
        ? [conditionExpiration]
        : [
            conditionExpiration,
            {
              OR: [
                { targetRoles: { has: role } },
                { targetRoles: { isEmpty: true } },
              ],
            },
          ],
    };

    return this.prisma.announcement.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    }) as Promise<AnnonceData[]>;
  }

  async trouverParId(announcementId: string, schoolId: string): Promise<AnnonceAuteurRef | null> {
    return this.prisma.announcement.findFirst({
      where: { id: announcementId, schoolId },
      select: { id: true, authorId: true },
    });
  }

  async modifier(announcementId: string, data: ModifierAnnonceData): Promise<AnnonceData> {
    return this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        title: data.title,
        content: data.content,
        targetRoles: data.targetRoles,
        isPinned: data.isPinned,
        expiresAt: data.expiresAt,
      },
    }) as Promise<AnnonceData>;
  }

  async supprimer(announcementId: string): Promise<AnnonceData | void> {
    return this.prisma.announcement.delete({
      where: { id: announcementId },
    }) as Promise<AnnonceData>;
  }

  async purgerExpirees(seuil: Date): Promise<{ count: number }> {
    return this.prisma.announcement.deleteMany({
      where: { expiresAt: { lt: seuil } },
    });
  }
}