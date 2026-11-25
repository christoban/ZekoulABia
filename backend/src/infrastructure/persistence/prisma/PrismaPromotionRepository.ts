import type { PrismaClient } from '@prisma/client';
import type {
  PromotionRepository,
  ClassPromotionMapping,
  DecisionConseil,
  PromotionEleveParams,
} from '@domain/ports/repositories/PromotionRepository';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import { changerClasseEleve } from '@application/shared/studentEnrollment';
import { CycleResolver } from '@domain/services/CycleResolver';

export class PrismaPromotionRepository implements PromotionRepository {
  constructor(private readonly prisma: PrismaClient, private readonly enrollmentRepository: EnrollmentRepository) {}

  async findMappingsPromotion(
    schoolId: string,
    academicYearId: string
  ): Promise<ClassPromotionMapping[]> {
    const data = await this.prisma.classPromotion.findMany({
      where: { schoolId, academicYearId },
      select: { fromClassId: true, toClassId: true },
    });
    return data;
  }

  async creerMappingsPromotion(
    mappings: (ClassPromotionMapping & { schoolId: string; academicYearId: string })[]
  ): Promise<void> {
    if (mappings.length === 0) return;
    await this.prisma.classPromotion.createMany({
      data: mappings.map(m => ({
        schoolId: m.schoolId,
        fromClassId: m.fromClassId,
        toClassId: m.toClassId,
        academicYearId: m.academicYearId,
      })),
      skipDuplicates: true,
    });
  }

  async findDecisionsEleves(
    schoolId: string,
    academicYearId: string
  ): Promise<DecisionConseil[]> {
    const periodes = await this.prisma.academicPeriod.findMany({
      where: { academicYearId },
      select: { id: true },
    });
    const periodeIds = periodes.map(p => p.id);

    const sessions = await this.prisma.classCouncilSession.findMany({
      where: { schoolId, academicPeriodId: { in: periodeIds } },
      select: { id: true, classId: true },
    });
    const sessionIds = sessions.map(s => s.id);
    const sessionClassMap = new Map(sessions.map(s => [s.id, s.classId]));

    const decisions = await this.prisma.classCouncilDecision.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { studentId: true, sessionId: true, decision: true },
    });

    return decisions.map(d => ({
      studentId: d.studentId,
      fromClassId: sessionClassMap.get(d.sessionId) ?? '',
      decision: d.decision as 'PASS' | 'REPEAT' | 'DELIBERATION',
    }));
  }

  async promouvoirEleve(params: PromotionEleveParams): Promise<void> {
    // params.studentId est un userId (convention de ClassCouncilDecision) —
    // on résout le StudentProfile.id pour l'enregistrement StudentPromotion
    // (StudentPromotion.studentId pointe vers StudentProfile, pas User).
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: params.studentId },
      select: { id: true },
    });
    if (!profile) throw new Error(`StudentProfile introuvable pour userId=${params.studentId}`);

    await this.prisma.studentPromotion.upsert({
      where: {
        studentId_academicYearId: {
          studentId: profile.id,
          academicYearId: params.academicYearId,
        },
      },
      create: {
        id: crypto.randomUUID(),
        schoolId: params.schoolId,
        studentId: profile.id,
        fromClassId: params.fromClassId,
        toClassId: params.toClassId,
        academicYearId: params.academicYearId,
        promotedById: params.promotedById,
        promotedAt: new Date(),
      },
      update: {
        toClassId: params.toClassId,
        promotedById: params.promotedById,
        promotedAt: new Date(),
      },
    });
  }

  async mettreAJourClasseEleve(studentId: string, newClassId: string, demandeurId: string): Promise<void> {
    // studentId est un userId (convention existante) — on résout le StudentProfile.id
    const [profile, classe] = await Promise.all([
      this.prisma.studentProfile.findUnique({
        where: { userId: studentId },
        select: { id: true, studentAccessScope: true, profileManagedBy: true },
      }),
      this.prisma.class.findUnique({
        where: { id: newClassId },
        select: { schoolId: true, academicYearId: true, level: true },
      }),
    ]);

    if (!profile) throw new Error(`StudentProfile introuvable pour userId=${studentId}`);
    if (!classe) throw new Error(`Classe introuvable: ${newClassId}`);

    // Recalcul du profil d'accès numérique lors du passage de cycle
    const cycle = CycleResolver.resolveCycle(classe.level);
    if (cycle === 'SECOND_CYCLE') {
      await this.prisma.studentProfile.update({
        where: { id: profile.id },
        data: {
          studentAccessScope: 'FULL',
          profileManagedBy: 'STUDENT',
        },
      });
    } else if (cycle === 'PREMIER_CYCLE') {
      await this.prisma.studentProfile.update({
        where: { id: profile.id },
        data: {
          studentAccessScope: 'READ_ONLY',
          profileManagedBy: profile.profileManagedBy === 'SECRETARIAT' ? 'SECRETARIAT' : 'PARENT',
        },
      });
    }

    await changerClasseEleve(this.enrollmentRepository, {
      studentId: profile.id,
      newClassId,
      academicYearId: classe.academicYearId,
      schoolId: classe.schoolId,
      enrolledById: demandeurId,
      exitReason: 'PROMOTION',
    });
  }

  async countPromotions(
    schoolId: string,
    academicYearId: string
  ): Promise<{ promus: number; redoublants: number }> {
    const promotions = await this.prisma.studentPromotion.findMany({
      where: { schoolId, academicYearId },
      select: { fromClassId: true, toClassId: true },
    });
    const promus = promotions.filter(p => p.fromClassId !== p.toClassId).length;
    const redoublants = promotions.filter(p => p.fromClassId === p.toClassId).length;
    return { promus, redoublants };
  }

  private static readonly NIVEAU_CIBLE_PAR_CHECKPOINT: Record<string, string> = {
    FIN_TROISIEME: '2nde',
    FIN_SECONDE_C: '1ere',
  };

  async findClasseCibleOrientation(
    schoolId: string,
    studentId: string,
    academicYearId: string
  ): Promise<string | null> {
    const reco = await this.prisma.recommandationSerie.findFirst({
      where: {
        studentId,
        status: { in: ['VALIDEE_ELEVE', 'VALIDEE_PAR_DEFAUT'] },
        finalTrack: { not: null },
        checkpointType: { not: null },
        fiche: { academicYearId },
      },
      select: { finalTrack: true, checkpointType: true },
    });
    if (!reco?.finalTrack || !reco.checkpointType) return null;

    const niveauCible = PrismaPromotionRepository.NIVEAU_CIBLE_PAR_CHECKPOINT[reco.checkpointType];
    if (!niveauCible) return null;

    // Répartit sur la classe la moins chargée en cas de plusieurs classes niveau+série identiques
    // (ex. "2nde C A" et "2nde C B") — jamais toujours la même classe par défaut.
    const classes = await this.prisma.class.findMany({
      where: { schoolId, level: niveauCible, serie: reco.finalTrack },
      select: { id: true },
    });
    if (classes.length === 0) return null;

    // Compter les inscriptions actives par classe via Enrollment
    const classIds = classes.map(c => c.id);
    const counts = await this.prisma.enrollment.groupBy({
      by: ['classId'],
      where: { classId: { in: classIds }, status: 'ACTIVE', academicYear: { isCurrent: true } },
      _count: { id: true },
    });
    const countMap = new Map(counts.map(r => [r.classId, r._count.id]));
    classes.sort((a, b) => (countMap.get(a.id) ?? 0) - (countMap.get(b.id) ?? 0));
    return classes[0]!.id;
  }
}
