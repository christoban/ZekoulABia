import type { PrismaClient } from '@prisma/client';
import type {
  ClassCouncilPreviewQueryPort,
  DonneesVueConseil,
  DonneesVueConseilParEleve,
} from '@domain/ports/repositories/ClassCouncilPreviewQueryPort';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';

export class PrismaClassCouncilPreviewQueryPort implements ClassCouncilPreviewQueryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async chargerDonneesVue(params: {
    schoolId: string;
    classId: string;
    academicPeriodId: string;
  }): Promise<DonneesVueConseil> {
    const { schoolId, classId, academicPeriodId } = params;

    const [periode, profiles] = await Promise.all([
      this.prisma.academicPeriod.findFirst({
        where: { id: academicPeriodId, academicYear: { school: { id: schoolId } } },
        select: { id: true, academicYearId: true, orderIndex: true },
      }),
      this.prisma.studentProfile.findMany({
        where: { ...whereProfilesParClasse(classId) },
        select: { userId: true },
      }),
    ]);
    if (!periode) return { effectif: 0, eleves: [] };

    const studentIds = profiles.map((p) => p.userId);
    if (studentIds.length === 0) return { effectif: 0, eleves: [] };

    const periodePrecedente = await this.prisma.academicPeriod.findFirst({
      where: { academicYearId: periode.academicYearId, orderIndex: periode.orderIndex - 1 },
      select: { id: true },
    });

    const [reportCards, reportCardsPrecedents, disciplines, recommandations, profilsSante] = await Promise.all([
      this.prisma.reportCard.findMany({
        where: { schoolId, academicPeriodId, studentId: { in: studentIds } },
        select: {
          studentId: true, generalAverage: true, rank: true, template: true,
          subjectLines: { select: { subjectAverage: true } },
        },
      }),
      periodePrecedente
        ? this.prisma.reportCard.findMany({
            where: { schoolId, academicPeriodId: periodePrecedente.id, studentId: { in: studentIds } },
            select: { studentId: true, generalAverage: true },
          })
        : Promise.resolve([]),
      this.prisma.disciplineRecord.findMany({
        where: { schoolId, studentId: { in: studentIds }, status: 'ACTIVE' },
        select: { studentId: true },
      }),
      this.prisma.recommandationSerie.findMany({
        where: { studentId: { in: studentIds }, adminValidated: false },
        select: { studentId: true },
      }),
      this.prisma.studentProfile.findMany({
        where: { userId: { in: studentIds }, studentStatus: 'ACTIVE' },
        select: { userId: true, healthScore: true },
      }),
    ]);

    const rcs = new Map(reportCards.map((r) => [r.studentId, r]));
    const rcsPrev = new Map(reportCardsPrecedents.map((r) => [r.studentId, r]));
    const discSet = new Set(disciplines.map((d) => d.studentId));
    const recoSet = new Set(recommandations.map((r) => r.studentId));
    const sante = new Map(profilsSante.map((p) => [p.userId, p.healthScore]));

    const eleves: DonneesVueConseilParEleve[] = profiles.map((p) => {
      const rc = rcs.get(p.userId);
      const template = rc?.template === 'EN_SECONDARY' ? 'EN' as const : 'FR' as const;
      const score = sante.get(p.userId) ?? 75;
      const alertLevel = score <= 30 ? 'critical' as const : score <= 50 ? 'warning' as const : null;
      return {
        studentId: p.userId,
        firstName: '',
        lastName: '',
        template,
        moyenneGenerale: rc?.generalAverage ?? null,
        rang: rc?.rank ?? null,
        moyenneGeneralePeriodePrecedente: rcsPrev.get(p.userId)?.generalAverage ?? null,
        moyennesMatieres: (rc?.subjectLines ?? []).map((l) => l.subjectAverage).filter((m): m is number => m !== null),
        alertLevel,
        casDisciplinaire: discSet.has(p.userId),
        orientationNonValidee: recoSet.has(p.userId),
      };
    });

    // Remplit les noms des élèves pour l'affichage de la vue
    const users = await this.prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    for (const e of eleves) {
      const u = userById.get(e.studentId);
      if (u) {
        e.firstName = u.firstName ?? '';
        e.lastName = u.lastName ?? '';
      }
    }

    return { effectif: eleves.length, eleves };
  }
}