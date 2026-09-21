import type { PrismaClient } from '@prisma/client';
import type {
  RapportsScolariteRepository,
  EffectifClasseRow,
  DossierIncompletRow,
  StatConcoursRow,
} from '@domain/ports/repositories/RapportsScolariteRepository';

export class PrismaRapportsScolariteRepository implements RapportsScolariteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getEffectifsParClasse(schoolId: string, academicYearId?: string): Promise<EffectifClasseRow[]> {
    const classes = await this.prisma.class.findMany({
      where: {
        schoolId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              select: { gender: true },
            },
          },
        },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    return classes.map((c) => {
      let garcons = 0;
      let filles = 0;

      for (const enr of c.enrollments) {
        const g = enr.student?.gender?.toUpperCase();
        if (g === 'M' || g === 'GARCON' || g === 'HOMME') {
          garcons++;
        } else if (g === 'F' || g === 'FILLE' || g === 'FEMME') {
          filles++;
        }
      }

      return {
        classId: c.id,
        className: c.name,
        level: c.level,
        serie: c.serie,
        filiere: c.filiere,
        capacity: c.capacity,
        totalInscrits: c.enrollments.length,
        garcons,
        filles,
      };
    });
  }

  async getDossiersIncomplets(schoolId: string): Promise<DossierIncompletRow[]> {
    const [dossiers, requirements] = await Promise.all([
      this.prisma.studentOnboarding.findMany({
        where: {
          schoolId,
          status: { in: ['SUBMITTED', 'DRAFT', 'LINK_SENT'] },
        },
        include: {
          classe: { select: { name: true } },
          documents: { select: { code: true, received: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.enrollmentDocumentRequirement.findMany({
        where: { schoolId, obligatoire: true },
        select: { code: true, libelle: true },
      }),
    ]);

    const reqMap = new Map(requirements.map((r) => [r.code, r.libelle]));

    return dossiers.map((d) => {
      const recues = new Set(
        d.documents
          .filter((doc) => doc.received === true)
          .map((doc) => doc.code),
      );

      const piecesManquantes: string[] = [];
      for (const [code, libelle] of reqMap.entries()) {
        if (!recues.has(code)) {
          piecesManquantes.push(libelle);
        }
      }

      return {
        id: d.id,
        nomProvisoire: d.nomProvisoire,
        className: d.classe?.name ?? null,
        contactTelephone: d.contactTelephone,
        completenessScore: d.completenessScore,
        validableSousReserve: d.validableSousReserve ?? false,
        status: d.status,
        createdAt: d.createdAt,
        piecesManquantes,
      };
    });
  }

  async getStatistiquesConcours(schoolId: string): Promise<StatConcoursRow[]> {
    const sessions = await this.prisma.entranceExamSession.findMany({
      where: { schoolId },
      include: {
        candidates: {
          select: {
            admissionStatus: true,
            totalAverage: true,
          },
        },
      },
      orderBy: { examDate: 'desc' },
    });

    return sessions.map((s) => {
      const total = s.candidates.length;
      let admis = 0;
      let listeAttente = 0;
      let refuses = 0;
      let sommeNotes = 0;
      let nbNotes = 0;

      for (const c of s.candidates) {
        if (c.admissionStatus === 'ADMIS' || c.admissionStatus === 'ADMIS_PROVISOIRE' || c.admissionStatus === 'INSCRIT') admis++;
        else if (c.admissionStatus === 'LISTE_ATTENTE' || c.admissionStatus === 'REPECHE') listeAttente++;
        else if (c.admissionStatus === 'REFUSE') refuses++;

        if (c.totalAverage !== null && c.totalAverage !== undefined) {
          sommeNotes += c.totalAverage;
          nbNotes++;
        }
      }

      const tauxReussitePercent = total > 0 ? Math.round((admis / total) * 100) : 0;
      const moyenneGenerale = nbNotes > 0 ? Math.round((sommeNotes / nbNotes) * 100) / 100 : 0;

      return {
        sessionId: s.id,
        sessionName: s.name,
        examDate: s.examDate,
        capacity: s.availableSeats ?? 0,
        totalCandidats: total,
        admis,
        listeAttente,
        refuses,
        tauxReussitePercent,
        moyenneGenerale,
      };
    });
  }
}
