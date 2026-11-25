import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  MinedubReportRepository,
  MinedubSupplementComplet,
  MinedubSupplementData,
  MinedubRapport,
} from '@domain/ports/repositories/MinedubReportRepository';

export class PrismaMinedubReportRepository implements MinedubReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverSupplementPrimaire(schoolId: string): Promise<MinedubSupplementData | null> {
    const supplement = await this.prisma.minedubSchoolSupplement.findUnique({
      where: { schoolId },
      select: {
        zoneImplantation: true,
        ordreEnseignement: true,
        elevesVulnerablesDetail: true,
        infrastructuresDetail: true,
        commoditesDetail: true,
        manuelsDetail: true,
      },
    });
    return supplement;
  }

  async trouverSupplementComplet(schoolId: string): Promise<MinedubSupplementComplet | null> {
    const supplement = await this.prisma.minedubSchoolSupplement.findUnique({ where: { schoolId } });
    return supplement as unknown as MinedubSupplementComplet | null;
  }

  async sauvegarderSupplement(
    schoolId: string,
    data: Record<string, unknown>,
    lastUpdatedBy: string,
  ): Promise<MinedubSupplementComplet> {
    return this.prisma.minedubSchoolSupplement.upsert({
      where: { schoolId },
      create: { schoolId, ...data, lastUpdatedBy },
      update: { ...data, lastUpdatedBy },
    }) as unknown as MinedubSupplementComplet;
  }

  async listerRapports(schoolId: string): Promise<MinedubRapport[]> {
    return this.prisma.minedubStatisticalReport.findMany({
      where: { schoolId },
      orderBy: { generatedAt: 'desc' },
      take: 20,
    }) as unknown as MinedubRapport[];
  }

  async trouverRapportParId(id: string): Promise<MinedubRapport | null> {
    return this.prisma.minedubStatisticalReport.findUnique({ where: { id } }) as unknown as MinedubRapport | null;
  }

  async creerRapport(data: {
    schoolId: string;
    generatedBy: string;
    filePath: string;
    champsNonResolus: unknown;
  }): Promise<{ id: string }> {
    return this.prisma.minedubStatisticalReport.create({
      data: {
        schoolId: data.schoolId,
        generatedBy: data.generatedBy,
        filePath: data.filePath,
        champsNonResolus: data.champsNonResolus as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  }
}
