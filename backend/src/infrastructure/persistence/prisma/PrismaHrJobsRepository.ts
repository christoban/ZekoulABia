import type { NotificationChannel, NotificationType, Prisma, PrismaClient, UserRole } from '@prisma/client';
import type { HrJobsRepository, HrEmployeForRelance } from '@domain/ports/repositories/HrJobsRepository';

export class PrismaHrJobsRepository implements HrJobsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerEmployesActifs(): Promise<HrEmployeForRelance[]> {
    return this.prisma.user.findMany({
      where: { isActive: true, role: { in: ['TEACHER', 'STAFF', 'ADMIN'] as UserRole[] } },
      select: {
        id: true, schoolId: true, firstName: true, lastName: true, email: true, createdAt: true, role: true,
        school: { select: { name: true } },
        employeeFile: { select: { selfServiceCompletedAt: true, remindersSentCount: true, lastReminderAt: true, escalatedAt: true } },
      },
    }) as unknown as Promise<HrEmployeForRelance[]>;
  }

  async creerNotification(data: {
    schoolId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    channel: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.notification.create({
      data: {
        schoolId: data.schoolId,
        userId: data.userId,
        type: data.type as NotificationType,
        title: data.title,
        body: data.body,
        channel: data.channel as NotificationChannel,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async upsertRelance(userId: string, schoolId: string): Promise<void> {
    await this.prisma.employeeFile.upsert({
      where: { userId },
      create: { userId, schoolId, remindersSentCount: 1, lastReminderAt: new Date() },
      update: { remindersSentCount: { increment: 1 }, lastReminderAt: new Date() },
    });
  }

  async upsertEscalade(userId: string, schoolId: string): Promise<void> {
    await this.prisma.employeeFile.upsert({
      where: { userId },
      create: { userId, schoolId, escalatedAt: new Date() },
      update: { escalatedAt: new Date() },
    });
  }

  async listerAdminsActifs(schoolId: string): Promise<{ id: string; email: string | null }[]> {
    return this.prisma.user.findMany({
      where: { schoolId, role: 'ADMIN', isActive: true },
      select: { id: true, email: true },
    }) as Promise<{ id: string; email: string | null }[]>;
  }
}
