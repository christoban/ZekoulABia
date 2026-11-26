/**
 * INFRASTRUCTURE LAYER — Adaptateur Prisma pour la matérialisation des programmes
 * officiels nationaux (OfficialProgrammeProgression) vers Programme / Chapitre d'école.
 */
import type { PrismaClient } from '@prisma/client';
import type {
  ClasseMatierePourInit,
  ClassePourMaterialisation,
  MaterialisationProgrammeRepository,
  OfficialChapterSource,
  OfficialProgressionAvecChapitres,
  ProgrammeExistantClasse,
  ProgrammeMaterialiseResultat,
  ProgrammeNationalACreer,
} from '@domain/ports/repositories/MaterialisationProgrammeRepository';

function toNullableInt(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return Math.trunc(val);
  return null;
}

function toNullableString(val: unknown): string | null {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  return null;
}

export function extraireChapitresJson(raw: unknown): OfficialChapterSource[] {
  if (!Array.isArray(raw)) return [];
  const chapitres: OfficialChapterSource[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (rec.exclure === true) continue;

    const titre = toNullableString(rec.titre);
    if (!titre) continue;

    const ordre = toNullableInt(rec.ordre) ?? i + 1;
    const moduleOrdre = toNullableInt(rec.moduleOrdre);
    const positionDansModule = toNullableInt(rec.positionDansModule);
    const sourceKey =
      moduleOrdre !== null && positionDansModule !== null
        ? `${moduleOrdre}:${positionDansModule}`
        : String(ordre);

    chapitres.push({
      ordre,
      titre,
      volumeHeuresPrevu: toNullableInt(rec.volumeHeuresPrevu),
      sequenceCibleFin: toNullableInt(rec.sequenceCibleFin),
      moduleOrdre,
      moduleTitre: toNullableString(rec.moduleTitre),
      positionDansModule,
      numeroAffiche: toNullableString(rec.numeroAffiche),
      sourceUrl: toNullableString(rec.sourceUrl),
      sourceKey,
    });
  }

  chapitres.sort((a, b) => a.ordre - b.ordre);
  return chapitres;
}

export class PrismaMaterialisationProgrammeRepository
  implements MaterialisationProgrammeRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findClassePourMaterialisation(
    schoolId: string,
    classId: string,
    academicYearId?: string,
  ): Promise<ClassePourMaterialisation | null> {
    const classe = await this.prisma.class.findFirst({
      where: { id: classId, schoolId, deletedAt: null },
      select: {
        id: true,
        schoolId: true,
        name: true,
        level: true,
        filiere: true,
        serie: true,
        pebsMixte: true,
        academicYearId: true,
        school: { select: { templateCode: true } },
      },
    });
    if (!classe) return null;

    const targetYearId = academicYearId ?? classe.academicYearId;
    const serieBase = classe.serie ? classe.serie.split(/[-\s]/)[0]?.trim() ?? classe.serie : null;

    const [assignments, overrides, coefficients] = await Promise.all([
      this.prisma.teachingAssignment.findMany({
        where: { schoolId, classId: classe.id, academicYearId: targetYearId },
        select: { subject: { select: { id: true, name: true } } },
      }),
      this.prisma.classSubjectOverride.findMany({
        where: { schoolId, classId: classe.id },
        select: { subject: { select: { id: true, name: true } } },
      }),
      classe.level
        ? this.prisma.subjectCoefficient.findMany({
            where: {
              schoolId,
              classLevel: classe.level,
              OR: serieBase
                ? [{ serieCode: classe.serie }, { serieCode: serieBase }, { serieCode: null }]
                : [{ serieCode: null }],
            },
            select: { subject: { select: { id: true, name: true } } },
          })
        : Promise.resolve([]),
    ]);

    const subjectsMap = new Map<string, ClasseMatierePourInit>();
    for (const row of [...assignments, ...overrides, ...coefficients]) {
      if (row.subject && !subjectsMap.has(row.subject.id)) {
        subjectsMap.set(row.subject.id, { id: row.subject.id, name: row.subject.name });
      }
    }

    const subjects = [...subjectsMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
    );

    return {
      id: classe.id,
      schoolId: classe.schoolId,
      name: classe.name,
      level: classe.level,
      filiere: classe.filiere,
      serie: classe.serie,
      pebsMixte: classe.pebsMixte,
      academicYearId: targetYearId,
      schoolTemplateCode: classe.school?.templateCode ?? '__ALL__',
      subjects,
    };
  }

  async findOfficialProgressionsCandidates(params: {
    templateCodes: string[];
    levels: string[];
    filieres: string[];
  }): Promise<OfficialProgressionAvecChapitres[]> {
    const rows = await this.prisma.officialProgrammeProgression.findMany({
      where: {
        active: true,
        templateCode: { in: params.templateCodes },
      },
      orderBy: [{ level: 'asc' }, { filiere: 'asc' }, { subjectName: 'asc' }],
    });

    return rows.map((row) => {
      const chapitres = extraireChapitresJson(row.chapitres);
      return {
        id: row.id,
        templateCode: row.templateCode,
        level: row.level,
        filiere: row.filiere,
        subjectName: row.subjectName,
        titre: row.titre,
        importChecksum: row.importChecksum ?? null,
        nbLecons: chapitres.length,
        chapitres,
      };
    });
  }

  async findProgrammesExistantsClasse(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<ProgrammeExistantClasse[]> {
    const rows = await this.prisma.programme.findMany({
      where: { schoolId, classId, academicYearId },
      select: {
        id: true,
        subjectId: true,
        titre: true,
        source: true,
        officialProgressionId: true,
        _count: { select: { chapitres: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      subjectId: r.subjectId,
      titre: r.titre,
      source: r.source,
      officialProgressionId: r.officialProgressionId,
      nbChapitres: r._count.chapitres,
    }));
  }

  async creerProgrammesEtChapitresAtomique(
    items: ProgrammeNationalACreer[],
  ): Promise<ProgrammeMaterialiseResultat[]> {
    if (items.length === 0) return [];

    return this.prisma.$transaction(async (tx) => {
      const resultats: ProgrammeMaterialiseResultat[] = [];

      for (const item of items) {
        // Double-garde idempotente intra-transaction : ne jamais créer de doublon ni écraser un manuel
        const dejaPresent = await tx.programme.findFirst({
          where: {
            schoolId: item.schoolId,
            classId: item.classId,
            subjectId: item.subjectId,
            academicYearId: item.academicYearId,
          },
          select: { id: true },
        });
        if (dejaPresent) continue;

        const created = await tx.programme.create({
          data: {
            schoolId: item.schoolId,
            subjectId: item.subjectId,
            classId: item.classId,
            level: item.level,
            academicYearId: item.academicYearId,
            titre: item.titre,
            officialProgressionId: item.officialProgressionId,
            source: 'national',
            sourceChecksum: item.sourceChecksum,
            filiere: item.filiere,
          },
          select: { id: true },
        });

        if (item.chapitres.length > 0) {
          await tx.chapitre.createMany({
            data: item.chapitres.map((ch) => ({
              programmeId: created.id,
              titre: ch.titre,
              ordre: ch.ordre,
              volumeHeuresPrevu: ch.volumeHeuresPrevu,
              sequenceCibleFin: ch.sequenceCibleFin,
              officialProgressionId: item.officialProgressionId,
              moduleOrdre: ch.moduleOrdre,
              moduleTitre: ch.moduleTitre,
              positionDansModule: ch.positionDansModule,
              numeroAffiche: ch.numeroAffiche,
              sourceUrl: ch.sourceUrl,
              sourceKey: ch.sourceKey,
            })),
          });
        }

        resultats.push({
          programmeId: created.id,
          subjectId: item.subjectId,
          titre: item.titre,
          officialProgressionId: item.officialProgressionId,
          nbLeconsCreees: item.chapitres.length,
        });
      }

      return resultats;
    });
  }
}

