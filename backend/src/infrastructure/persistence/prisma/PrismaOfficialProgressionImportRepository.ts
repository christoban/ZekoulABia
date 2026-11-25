import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  OfficialProgressionImportRepository,
  OfficialProgressionNaturalKey,
  OfficialProgressionSnapshot,
  OfficialProgressionUpsertMutation,
} from '@domain/ports/repositories/OfficialProgressionImportRepository';

const LEVEL_TO_BAC_NIVEAU: Record<string, 'SECONDE' | 'PREMIERE' | 'TERMINALE'> = {
  '2nde': 'SECONDE',
  seconde: 'SECONDE',
  '1ere': 'PREMIERE',
  '1ère': 'PREMIERE',
  premiere: 'PREMIERE',
  première: 'PREMIERE',
  tle: 'TERMINALE',
  terminale: 'TERMINALE',
};

function resoudreBacNiveau(level: string): 'SECONDE' | 'PREMIERE' | 'TERMINALE' | null {
  return LEVEL_TO_BAC_NIVEAU[level.trim().toLowerCase()] ?? null;
}

export class PrismaOfficialProgressionImportRepository
  implements OfficialProgressionImportRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async listExistingTemplateCodes(): Promise<string[]> {
    const rows = await this.prisma.schoolTemplate.findMany({
      select: { code: true },
    });
    return rows.map((r) => r.code);
  }

  async listKnownSubjectsForScope(params: {
    templateCode: string;
    level: string;
    filiere: string;
  }): Promise<string[]> {
    const { templateCode, level, filiere } = params;
    const isSharedTarget = templateCode === '__ALL__';
    const hasFiliere = filiere.length > 0;
    const bacNiveau = resoudreBacNiveau(level);

    const [cycleRows, aslRows, bacRows] = await Promise.all([
      this.prisma.cycleCoefficient.findMany({
        where: {
          classLevel: level,
          ...(isSharedTarget ? {} : { templateCode }),
          ...(hasFiliere ? { filiere } : {}),
        },
        select: { subjectName: true },
        distinct: ['subjectName'],
      }),
      this.prisma.anglophoneSubjectLoad.findMany({
        where: {
          classLevel: level,
          ...(isSharedTarget ? {} : { templateCode }),
          ...(hasFiliere ? { filiere } : {}),
        },
        select: { subjectName: true },
        distinct: ['subjectName'],
      }),
      bacNiveau
        ? this.prisma.bacCoefficient.findMany({
            where: {
              niveau: bacNiveau,
              ...(isSharedTarget ? {} : { templateCode: { in: [templateCode, '__ALL__'] } }),
              ...(hasFiliere ? { serie: filiere } : {}),
            },
            select: { subjectName: true },
            distinct: ['subjectName'],
          })
        : Promise.resolve([]),
    ]);

    const unique = new Set<string>();
    for (const row of cycleRows) unique.add(row.subjectName);
    for (const row of aslRows) unique.add(row.subjectName);
    for (const row of bacRows) unique.add(row.subjectName);
    return Array.from(unique);
  }

  async findProgressionsByKeys(
    keys: OfficialProgressionNaturalKey[],
  ): Promise<OfficialProgressionSnapshot[]> {
    if (keys.length === 0) return [];
    return this.prisma.officialProgrammeProgression.findMany({
      where: {
        OR: keys.map((k) => ({
          templateCode: k.templateCode,
          level: k.level,
          filiere: k.filiere,
          subjectName: k.subjectName,
        })),
      },
    });
  }

  async applyImportTransaction(
    mutations: OfficialProgressionUpsertMutation[],
  ): Promise<OfficialProgressionSnapshot[]> {
    return this.prisma.$transaction(async (tx) => {
      const results: OfficialProgressionSnapshot[] = [];

      for (const m of mutations) {
        const chapitresJson = m.chapitres as unknown as Prisma.InputJsonValue;

        if (m.mode === 'CREATE') {
          const created = await tx.officialProgrammeProgression.create({
            data: {
              templateCode: m.templateCode,
              level: m.level,
              filiere: m.filiere,
              subjectName: m.subjectName,
              titre: m.titre,
              chapitres: chapitresJson,
              source: m.source,
              manuallyEdited: false,
              importChecksum: m.importChecksum,
              active: m.active,
            },
          });
          results.push(created);
          continue;
        }

        const updated = m.existingId
          ? await tx.officialProgrammeProgression.update({
              where: { id: m.existingId },
              data: {
                titre: m.titre,
                chapitres: chapitresJson,
                source: m.source,
                manuallyEdited: false,
                importChecksum: m.importChecksum,
                active: m.active,
              },
            })
          : await tx.officialProgrammeProgression.upsert({
              where: {
                templateCode_level_filiere_subjectName: {
                  templateCode: m.templateCode,
                  level: m.level,
                  filiere: m.filiere,
                  subjectName: m.subjectName,
                },
              },
              update: {
                titre: m.titre,
                chapitres: chapitresJson,
                source: m.source,
                manuallyEdited: false,
                importChecksum: m.importChecksum,
                active: m.active,
              },
              create: {
                templateCode: m.templateCode,
                level: m.level,
                filiere: m.filiere,
                subjectName: m.subjectName,
                titre: m.titre,
                chapitres: chapitresJson,
                source: m.source,
                manuallyEdited: false,
                importChecksum: m.importChecksum,
                active: m.active,
              },
            });

        results.push(updated);
      }

      return results;
    });
  }
}

