import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  OfficialProgressionRecord,
  PaginatedOfficialProgressionsResult,
} from '@domain/ports/repositories/MasterReferentielsRepository';

/**
 * Helper Prisma dédié aux progressions officielles (extrait de PrismaMasterReferentielsRepository
 * pour maintenir chaque fichier sous le plafond de 500 lignes).
 */
export class PrismaMasterProgressionsStore {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: {
    templateCode?: string;
    level?: string;
    filiere?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedOfficialProgressionsResult> {
    const where: Prisma.OfficialProgrammeProgressionWhereInput = {};
    if (filter.templateCode) where.templateCode = filter.templateCode;
    if (filter.level) where.level = filter.level;
    if (filter.filiere) where.filiere = filter.filiere;
    if (filter.search) {
      where.OR = [
        { subjectName: { contains: filter.search, mode: 'insensitive' } },
        { titre: { contains: filter.search, mode: 'insensitive' } },
        { level: { contains: filter.search, mode: 'insensitive' } },
        { filiere: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const limit = Math.min(100, Math.max(1, Math.trunc(filter.limit ?? 50)));
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const facetWhere: Prisma.OfficialProgrammeProgressionWhereInput = filter.templateCode
      ? { templateCode: filter.templateCode }
      : {};

    const [items, total, levelRows, filiereRows] = await Promise.all([
      this.prisma.officialProgrammeProgression.findMany({
        where,
        orderBy: [{ templateCode: 'asc' }, { level: 'asc' }, { filiere: 'asc' }, { subjectName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.officialProgrammeProgression.count({ where }),
      this.prisma.officialProgrammeProgression.findMany({
        where: facetWhere,
        select: { level: true },
        distinct: ['level'],
        orderBy: { level: 'asc' },
      }),
      this.prisma.officialProgrammeProgression.findMany({
        where: facetWhere,
        select: { filiere: true },
        distinct: ['filiere'],
        orderBy: { filiere: 'asc' },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      facets: {
        levels: levelRows.map((r) => r.level).filter((v) => v.length > 0),
        filieres: filiereRows.map((r) => r.filiere).filter((v) => v.length > 0),
      },
    };
  }

  async findById(id: string): Promise<OfficialProgressionRecord | null> {
    return this.prisma.officialProgrammeProgression.findUnique({ where: { id } });
  }

  async save(input: {
    id?: string;
    templateCode: string;
    level: string;
    filiere: string;
    subjectName: string;
    titre: string;
    chapitres: unknown;
    active: boolean;
    manuallyEdited?: boolean;
    source?: string | null;
  }): Promise<OfficialProgressionRecord> {
    const chapitresJson = input.chapitres as Prisma.InputJsonValue;
    const manuallyEdited = input.manuallyEdited ?? true;
    const sourcePatch = input.source !== undefined ? { source: input.source } : {};
    const checksumPatch = manuallyEdited ? { importChecksum: null } : {};
    if (input.id) {
      return this.prisma.officialProgrammeProgression.update({
        where: { id: input.id },
        data: {
          templateCode: input.templateCode, level: input.level, filiere: input.filiere,
          subjectName: input.subjectName, titre: input.titre, chapitres: chapitresJson,
          active: input.active, manuallyEdited, ...sourcePatch, ...checksumPatch,
        },
      });
    }
    return this.prisma.officialProgrammeProgression.upsert({
      where: {
        templateCode_level_filiere_subjectName: {
          templateCode: input.templateCode, level: input.level,
          filiere: input.filiere, subjectName: input.subjectName,
        },
      },
      update: { titre: input.titre, chapitres: chapitresJson, active: input.active, manuallyEdited, ...sourcePatch, ...checksumPatch },
      create: {
        templateCode: input.templateCode, level: input.level, filiere: input.filiere,
        subjectName: input.subjectName, titre: input.titre, chapitres: chapitresJson,
        active: input.active, manuallyEdited, source: input.source ?? 'manuel', ...checksumPatch,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.officialProgrammeProgression.delete({ where: { id } });
  }
}
