import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  SchoolAdminQueriesRepository,
  SchoolMeInfo,
  SchoolLastBackupSettings,
  SchoolExportBundle,
  SchoolTemplateOnboarding,
  UpdateSchoolProfileInput,
  SchoolProfileSummary,
  SchoolNotificationSettingsFlags,
  SchoolNotificationSettingsRecord,
  SchoolSecuritySettingsData,
  FindSchoolAuditLogsInput,
  FindSchoolAuditLogsResult,
} from '@domain/ports/repositories/SchoolAdminQueriesRepository';
import { buildPayload } from '@infrastructure/backup/SchoolBackupService';

export class PrismaSchoolAdminQueriesRepository implements SchoolAdminQueriesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSchoolMe(schoolId: string): Promise<SchoolMeInfo | null> {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        logoUrl: true,
        plan: true,
        city: true,
        region: true,
        phone: true,
        email: true,
        subsystem: true,
        status: true,
        educationType: true,
        ownership: true,
        onboardingConfig: true,
        hasPEBSFrancophone: true,
        hasPEBSAnglophone: true,
        minesecSchoolCode: true,
        templateCode: true,
      },
    });
  }

  async findLastBackupSettings(schoolId: string): Promise<SchoolLastBackupSettings | null> {
    return this.prisma.schoolSettings.findUnique({
      where: { schoolId },
      select: { lastBackupAt: true, lastBackupFile: true },
    });
  }

  async findExportBundle(schoolId: string): Promise<SchoolExportBundle | null> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    if (!school) return null;

    const exportPayload = await buildPayload(this.prisma, schoolId);
    return {
      schoolName: school.name,
      exportPayload,
    };
  }

  async findTemplateAndOnboarding(schoolId: string): Promise<SchoolTemplateOnboarding | null> {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { templateCode: true, onboardingConfig: true },
    });
  }

  async findOnboardingConfig(schoolId: string): Promise<{ onboardingConfig: unknown } | null> {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { onboardingConfig: true },
    });
  }

  async updateLogo(schoolId: string, logoUrl: string | null): Promise<{ logoUrl: string | null }> {
    return this.prisma.school.update({
      where: { id: schoolId },
      data: { logoUrl },
      select: { logoUrl: true },
    });
  }

  async updateProfile(schoolId: string, data: UpdateSchoolProfileInput): Promise<SchoolProfileSummary> {
    const updateData: Prisma.SchoolUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.minesecSchoolCode !== undefined) updateData.minesecSchoolCode = data.minesecSchoolCode;

    return this.prisma.school.update({
      where: { id: schoolId },
      data: updateData,
      select: {
        id: true,
        name: true,
        city: true,
        phone: true,
        email: true,
        minesecSchoolCode: true,
      },
    });
  }

  async isSubdomainTakenByOther(subdomain: string, excludeSchoolId: string): Promise<boolean> {
    const existing = await this.prisma.school.findFirst({
      where: { subdomain, id: { not: excludeSchoolId } },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async updateSubdomain(schoolId: string, subdomain: string): Promise<void> {
    await this.prisma.school.update({
      where: { id: schoolId },
      data: { subdomain },
    });
  }

  async upsertNotificationSettings(
    schoolId: string,
    data: Partial<SchoolNotificationSettingsFlags> = {},
  ): Promise<SchoolNotificationSettingsRecord> {
    return this.prisma.schoolNotificationSettings.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
  }

  async findSecuritySettings(schoolId: string): Promise<SchoolSecuritySettingsData | null> {
    return this.prisma.schoolConfig.findUnique({
      where: { schoolId },
      select: {
        passwordMinLength: true,
        passwordRequireUpper: true,
        passwordRequireDigit: true,
        sessionTimeoutMin: true,
      },
    });
  }

  async upsertSecuritySettings(
    schoolId: string,
    data: Partial<SchoolSecuritySettingsData>,
  ): Promise<SchoolSecuritySettingsData> {
    return this.prisma.schoolConfig.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
      select: {
        passwordMinLength: true,
        passwordRequireUpper: true,
        passwordRequireDigit: true,
        sessionTimeoutMin: true,
      },
    });
  }

  async findAuditLogs(input: FindSchoolAuditLogsInput): Promise<FindSchoolAuditLogsResult> {
    const skip = (input.page - 1) * input.limit;
    const where: Prisma.ActivitiesLogWhereInput = { schoolId: input.schoolId };
    if (input.userId) where.userId = input.userId;
    if (input.action) where.action = { contains: input.action, mode: 'insensitive' };
    if (input.fromDate || input.toDate) {
      where.createdAt = {
        ...(input.fromDate ? { gte: new Date(input.fromDate) } : {}),
        ...(input.toDate ? { lte: new Date(input.toDate + 'T23:59:59') } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.activitiesLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: input.limit,
      }),
      this.prisma.activitiesLog.count({ where }),
    ]);

    const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => !!id))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return {
      logs: logs.map((l) => ({
        ...l,
        user: l.userId ? (userMap[l.userId] ?? null) : null,
      })),
      total,
    };
  }
}
