import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  StatisticalCampaignRepository,
  StatisticalSubmission,
  SupplementData,
  TemplateData,
  EcoleStatistiqueMeta,
} from '@domain/ports/repositories/StatisticalCampaignRepository';

export class PrismaStatisticalCampaignRepository implements StatisticalCampaignRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverSupplement(schoolId: string): Promise<SupplementData | null> {
    return this.prisma.schoolStatisticalSupplement.findUnique({
      where: { schoolId },
    }) as unknown as SupplementData | null;
  }

  async trouverTemplateActif(ministry: string): Promise<TemplateData | null> {
    const template = await this.prisma.statisticalCampaignTemplate.findFirst({
      where: { ministry, isActive: true },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, filePath: true },
    });
    return template;
  }

  async creerSubmission(data: {
    schoolId: string;
    templateId: string;
    generatedBy: string;
    status: 'PENDING_MANUAL_DATA' | 'DRAFT';
    filePath?: string | null;
    unresolvedFieldsReport?: unknown;
  }): Promise<{ id: string }> {
    return this.prisma.statisticalSubmission.create({
      data: {
        schoolId: data.schoolId,
        templateId: data.templateId,
        generatedBy: data.generatedBy,
        status: data.status,
        filePath: data.filePath ?? null,
        unresolvedFieldsReport: data.unresolvedFieldsReport as Prisma.InputJsonValue | undefined,
      },
      select: { id: true },
    });
  }

  async sauvegarderSupplement(schoolId: string, data: Record<string, unknown>, lastUpdatedBy: string): Promise<SupplementData> {
    return this.prisma.schoolStatisticalSupplement.upsert({
      where: { schoolId },
      create: { schoolId, ...data, lastUpdatedBy },
      update: { ...data, lastUpdatedBy },
    }) as unknown as SupplementData;
  }

  async trouverEcoleMeta(schoolId: string): Promise<EcoleStatistiqueMeta | null> {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { subsystem: true, educationType: true },
    }) as unknown as EcoleStatistiqueMeta | null;
  }

  async trouverSubmissionParId(id: string): Promise<StatisticalSubmission | null> {
    return this.prisma.statisticalSubmission.findUnique({ where: { id } }) as unknown as StatisticalSubmission | null;
  }

  async listerDernieresSubmissions(schoolId: string): Promise<StatisticalSubmission[]> {
    return this.prisma.statisticalSubmission.findMany({
      where: { schoolId },
      orderBy: { generatedAt: 'desc' },
      take: 20,
    }) as unknown as StatisticalSubmission[];
  }
}
