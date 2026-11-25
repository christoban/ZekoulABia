import type { PrismaClient, SchoolTemplateVersion as PrismaSchoolTemplateVersion } from '@prisma/client';
import type { SchoolTemplateVersion, SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';

export class PrismaSchoolTemplateVersionRepository implements SchoolTemplateVersionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverVersionActive(templateCode: string): Promise<SchoolTemplateVersion | null> {
    const row = await this.prisma.schoolTemplateVersion.findFirst({
      where: { templateCode, active: true },
      orderBy: { version: 'desc' },
    });
    return row ? this.toDomain(row) : null;
  }

  async trouverParCodeEtVersion(templateCode: string, version: number): Promise<SchoolTemplateVersion | null> {
    const row = await this.prisma.schoolTemplateVersion.findUnique({
      where: { templateCode_version: { templateCode, version } },
    });
    return row ? this.toDomain(row) : null;
  }

  async publierNouvelleVersion(templateCode: string, config: Record<string, unknown>): Promise<SchoolTemplateVersion> {
    return this.prisma.$transaction(async (tx) => {
      const derniere = await tx.schoolTemplateVersion.aggregate({
        where: { templateCode },
        _max: { version: true },
      });
      const nouvelleVersion = (derniere._max.version ?? 0) + 1;
      await tx.schoolTemplateVersion.updateMany({
        where: { templateCode, active: true },
        data: { active: false },
      });
      const row = await tx.schoolTemplateVersion.create({
        data: {
          templateCode,
          version: nouvelleVersion,
          config: config as Record<string, string | number | boolean>,
          publishedAt: new Date(),
          active: true,
        },
      });
      return this.toDomain(row);
    });
  }

  async listerVersions(templateCode: string): Promise<SchoolTemplateVersion[]> {
    const rows = await this.prisma.schoolTemplateVersion.findMany({
      where: { templateCode },
      orderBy: { version: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: PrismaSchoolTemplateVersion): SchoolTemplateVersion {
    return {
      id: row.id,
      templateCode: row.templateCode,
      version: row.version,
      config: (row.config as Record<string, unknown>) ?? {},
      publishedAt: row.publishedAt,
      active: row.active,
      createdAt: row.createdAt,
    };
  }
}
