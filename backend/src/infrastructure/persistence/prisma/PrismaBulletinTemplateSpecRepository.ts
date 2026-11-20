import type { Prisma, PrismaClient } from '@prisma/client';
import type { BulletinTemplateSpec } from '@domain/types/bulletinTemplateSpec';
import type { BulletinTemplateSpecRepository } from '@domain/ports/repositories/BulletinTemplateSpecRepository';
import { hydrateTemplateSpecsFromStore } from '@domain/templates/bulletinCatalog';

export class PrismaBulletinTemplateSpecRepository implements BulletinTemplateSpecRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<BulletinTemplateSpec[]> {
    const rows = await this.prisma.bulletinTemplateSpecRecord.findMany({
      orderBy: [{ specId: 'asc' }, { version: 'asc' }],
    });
    return rows.map((row) => structuredClone(row.specJson as unknown as BulletinTemplateSpec));
  }

  async findBySpecAndVersion(specId: string, version: number): Promise<BulletinTemplateSpec | null> {
    const row = await this.prisma.bulletinTemplateSpecRecord.findUnique({
      where: { specId_version: { specId, version } },
    });
    if (!row) return null;
    return structuredClone(row.specJson as unknown as BulletinTemplateSpec);
  }

  async saveVersion(spec: BulletinTemplateSpec, createdById?: string | null): Promise<BulletinTemplateSpec> {
    const existing = await this.prisma.bulletinTemplateSpecRecord.findUnique({
      where: { specId_version: { specId: spec.id, version: spec.version } },
    });
    if (existing) {
      throw new Error(`La spec "${spec.id}" v${spec.version} existe déjà en base et est immuable.`);
    }

    const record = await this.prisma.bulletinTemplateSpecRecord.create({
      data: {
        specId: spec.id,
        version: spec.version,
        status: spec.status ?? 'PUBLISHED',
        familyKey: spec.familyKey,
        name: spec.name,
        language: spec.language,
        specJson: structuredClone(spec) as unknown as Prisma.InputJsonValue,
        createdById: createdById ?? null,
      },
    });
    const hydrated = structuredClone(record.specJson as unknown as BulletinTemplateSpec);
    hydrateTemplateSpecsFromStore([hydrated]);
    return hydrated;
  }
}
