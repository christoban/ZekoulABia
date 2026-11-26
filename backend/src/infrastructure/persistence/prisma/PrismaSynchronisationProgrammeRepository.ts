/**
 * INFRASTRUCTURE LAYER — Adaptateur Prisma Lot 2 pour l'initialisation en lot
 * d'école, la détection de dérive (sourceChecksum) et la synchronisation différentielle
 * atomique et non destructive.
 */
import type { PrismaClient } from '@prisma/client';
import type {
  AppliquerSyncAtomiqueInput,
  AppliquerSyncAtomiqueResultat,
  ProgrammeNationalPourSync,
  SynchronisationProgrammeRepository,
} from '@domain/ports/repositories/SynchronisationProgrammeRepository';
import { extraireChapitresJson } from './PrismaMaterialisationProgrammeRepository';

const SYNC_PROGRAMME_INCLUDE = {
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  officialProgression: true,
  chapitres: {
    orderBy: { ordre: 'asc' as const },
    include: {
      _count: {
        select: {
          cahierDeTexteEntries: true,
          avancements: true,
        },
      },
    },
  },
};

export class PrismaSynchronisationProgrammeRepository
  implements SynchronisationProgrammeRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async listerClassesActivesEcole(
    schoolId: string,
    academicYearId?: string,
  ): Promise<Array<{ id: string; name: string; level: string | null; academicYearId: string }>> {
    let targetYearId = academicYearId;
    if (!targetYearId) {
      const courante = await this.prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
      });
      targetYearId = courante?.id;
    }

    return this.prisma.class.findMany({
      where: {
        schoolId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(targetYearId ? { academicYearId: targetYearId } : {}),
      },
      select: { id: true, name: true, level: true, academicYearId: true },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  async listerProgrammesNationauxAvecReference(
    schoolId: string,
    academicYearId?: string,
  ): Promise<ProgrammeNationalPourSync[]> {
    const rows = await this.prisma.programme.findMany({
      where: {
        schoolId,
        source: 'national',
        officialProgressionId: { not: null },
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: SYNC_PROGRAMME_INCLUDE,
      orderBy: [{ level: 'asc' }, { titre: 'asc' }],
    });

    const result: ProgrammeNationalPourSync[] = [];
    for (const row of rows) {
      if (!row.officialProgression || !row.officialProgressionId) continue;
      result.push(this.mapperProgramme(row));
    }
    return result;
  }

  async findProgrammePourSynchronisation(
    schoolId: string,
    programmeId: string,
  ): Promise<ProgrammeNationalPourSync | null> {
    const row = await this.prisma.programme.findFirst({
      where: { id: programmeId, schoolId },
      include: SYNC_PROGRAMME_INCLUDE,
    });
    if (!row || !row.officialProgression || !row.officialProgressionId) return null;
    return this.mapperProgramme(row);
  }

  async appliquerSynchronisationAtomique(
    input: AppliquerSyncAtomiqueInput,
  ): Promise<AppliquerSyncAtomiqueResultat> {
    return this.prisma.$transaction(async (tx) => {
      await tx.programme.update({
        where: { id: input.programmeId },
        data: {
          titre: input.nouveauTitre,
          sourceChecksum: input.nouveauChecksum,
        },
      });

      // Mise à jour en place par Chapitre.id — préserve strictement ChapitreAvancement et CahierDeTexte
      for (const mod of input.modifies) {
        await tx.chapitre.update({
          where: { id: mod.chapitreId },
          data: {
            titre: mod.apres.titre,
            ordre: mod.apres.ordre,
            moduleOrdre: mod.apres.moduleOrdre,
            moduleTitre: mod.apres.moduleTitre,
            positionDansModule: mod.apres.positionDansModule,
            numeroAffiche: mod.apres.numeroAffiche,
            sourceUrl: mod.apres.sourceUrl,
            sourceKey: mod.apres.sourceKey,
          },
        });
      }

      if (input.ajoutes.length > 0) {
        await tx.chapitre.createMany({
          data: input.ajoutes.map((ch) => ({
            programmeId: input.programmeId,
            titre: ch.titre,
            ordre: ch.ordre,
            volumeHeuresPrevu: ch.volumeHeuresPrevu,
            sequenceCibleFin: ch.sequenceCibleFin,
            officialProgressionId: input.officialProgressionId,
            moduleOrdre: ch.moduleOrdre,
            moduleTitre: ch.moduleTitre,
            positionDansModule: ch.positionDansModule,
            numeroAffiche: ch.numeroAffiche,
            sourceUrl: ch.sourceUrl,
            sourceKey: ch.sourceKey,
          })),
        });
      }

      return {
        programmeId: input.programmeId,
        nbAjoutes: input.ajoutes.length,
        nbModifies: input.modifies.length,
        nouveauChecksum: input.nouveauChecksum,
      };
    });
  }

  private mapperProgramme(row: {
    id: string;
    schoolId: string;
    subjectId: string;
    classId: string | null;
    level: string | null;
    filiere: string | null;
    academicYearId: string;
    titre: string;
    source: string;
    sourceChecksum: string | null;
    officialProgressionId: string | null;
    subject: { id: string; name: string };
    class: { id: string; name: string } | null;
    officialProgression: {
      id: string;
      titre: string;
      importChecksum: string | null;
      active: boolean;
      chapitres: unknown;
    } | null;
    chapitres: Array<{
      id: string;
      titre: string;
      ordre: number;
      volumeHeuresPrevu: number | null;
      sequenceCibleFin: number | null;
      moduleOrdre: number | null;
      moduleTitre: string | null;
      positionDansModule: number | null;
      numeroAffiche: string | null;
      sourceUrl: string | null;
      sourceKey: string | null;
      _count: { cahierDeTexteEntries: number; avancements: number };
    }>;
  }): ProgrammeNationalPourSync {
    const off = row.officialProgression!;
    return {
      id: row.id,
      schoolId: row.schoolId,
      subjectId: row.subjectId,
      subjectName: row.subject.name,
      classId: row.classId,
      className: row.class?.name ?? null,
      level: row.level,
      filiere: row.filiere,
      academicYearId: row.academicYearId,
      titre: row.titre,
      source: row.source,
      sourceChecksum: row.sourceChecksum,
      officialProgressionId: row.officialProgressionId!,
      officialTitre: off.titre,
      officialChecksum: off.importChecksum ?? null,
      officialActive: off.active,
      chapitresEcole: row.chapitres.map((c) => ({
        id: c.id,
        titre: c.titre,
        ordre: c.ordre,
        volumeHeuresPrevu: c.volumeHeuresPrevu,
        sequenceCibleFin: c.sequenceCibleFin,
        moduleOrdre: c.moduleOrdre,
        moduleTitre: c.moduleTitre,
        positionDansModule: c.positionDansModule,
        numeroAffiche: c.numeroAffiche,
        sourceUrl: c.sourceUrl,
        sourceKey: c.sourceKey,
        nbSeancesCahier: c._count.cahierDeTexteEntries,
        nbCochesDirectes: c._count.avancements,
      })),
      chapitresOfficiels: extraireChapitresJson(off.chapitres),
    };
  }
}
