import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CheckpointConfigDetail,
  EleveAOrienterDetail,
  FicheDetail,
  FicheListItem,
  ListeFichesFilters,
  OrientationStats,
  RecommandationDetail,
  SerieActuelleDetail,
} from '@domain/ports/repositories/IOrientationRepository';
import type {
  ConfidenceLevel,
  OrientationCheckpointType,
  StatutRecommandation,
} from '@domain/entities/FicheOrientation';

export const ORIENTATION_STUDENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  studentProfile: {
    select: {
      enrollmentsYearScoped: {
        where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
        select: { class: { select: { name: true } } },
        take: 1,
      },
    },
  },
} satisfies Prisma.UserSelect;

export function mapOrientationStudent(student: {
  id: string;
  firstName: string;
  lastName: string;
  studentProfile: { enrollmentsYearScoped: Array<{ class: { name: string } }> } | null;
}): FicheDetail['student'] {
  return {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    studentProfile: student.studentProfile
      ? { class: student.studentProfile.enrollmentsYearScoped[0]?.class ?? null }
      : null,
  };
}

export async function findFichesOrientationOp(
  prisma: PrismaClient,
  filters: ListeFichesFilters,
): Promise<{ fiches: FicheListItem[]; total: number }> {
  const { schoolId, classId, riskLevel, status, academicYearId, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where = {
    ...orientationFicheWhere(schoolId),
    ...(riskLevel ? { riskLevel } : {}),
    ...(status ? { status } : {}),
    ...(academicYearId ? { academicYearId } : {}),
    ...(classId ? { student: { studentProfile: { enrollmentsYearScoped: { some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } } } } } } : {}),
  } as Prisma.FicheOrientationWhereInput;

  const [total, items] = await Promise.all([
    prisma.ficheOrientation.count({ where }),
    prisma.ficheOrientation.findMany({
      where,
      include: {
        student: { select: ORIENTATION_STUDENT_SELECT },
        _count: { select: { entretiens: true, tests: true, suivis: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    fiches: items.map((f) => ({
      id: f.id,
      studentId: f.studentId,
      status: f.status,
      riskLevel: f.riskLevel,
      mainConcern: f.mainConcern,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      student: mapOrientationStudent(f.student),
      _count: f._count,
    })),
    total,
  };
}

const ENROLLMENT_CLASS_SELECT = {
  where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
  select: { class: { select: { name: true } } },
  take: 1,
} as const;

const ENROLLMENT_SERIE_SELECT = {
  where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
  select: { class: { select: { name: true, level: true, serie: true } } },
  take: 1,
} as const;

export function orientationFicheWhere(schoolId: string, ficheId?: string): Prisma.FicheOrientationWhereInput {
  return ficheId ? { id: ficheId, schoolId } : { schoolId };
}

export async function upsertRecommandationOp(
  prisma: PrismaClient,
  ficheId: string,
  studentId: string,
  payload: Prisma.RecommandationSerieUncheckedUpdateInput,
): Promise<RecommandationDetail> {
  const existing = await prisma.recommandationSerie.findUnique({ where: { ficheOrientationId: ficheId } });
  if (existing) {
    const updated = await prisma.recommandationSerie.update({
      where: { ficheOrientationId: ficheId },
      data: payload as Prisma.RecommandationSerieUpdateInput,
    });
    return updated as RecommandationDetail;
  }
  const created = await prisma.recommandationSerie.create({
    data: { ficheOrientationId: ficheId, studentId, ...(payload as unknown as Prisma.RecommandationSerieUncheckedCreateInput) },
  });
  return created as RecommandationDetail;
}

export async function updateRecommandationStatusOp(
  prisma: PrismaClient,
  id: string,
  patch: Prisma.RecommandationSerieUpdateInput,
): Promise<RecommandationDetail> {
  const updated = await prisma.recommandationSerie.update({ where: { id }, data: patch });
  return updated as RecommandationDetail;
}

export async function createOrUpdateRecommandationCheckpointOp(
  prisma: PrismaClient,
  ficheId: string,
  studentId: string,
  data: {
    checkpointType: OrientationCheckpointType;
    serieActuelle: string;
    suggestedTracks: unknown;
    confidenceLevel: ConfidenceLevel;
    dataDepthMonths: number;
    justification: string;
  },
): Promise<RecommandationDetail> {
  const tracks = data.suggestedTracks as Array<{ track: string; score: number }>;
  const topTrack = tracks?.[0]?.track ?? data.serieActuelle;
  return upsertRecommandationOp(prisma, ficheId, studentId, {
    serieActuelle: data.serieActuelle,
    serieRecommandee: topTrack,
    justification: data.justification,
    checkpointType: data.checkpointType,
    suggestedTracks: data.suggestedTracks as Prisma.InputJsonValue,
    confidenceLevel: data.confidenceLevel,
    dataDepthMonths: data.dataDepthMonths,
    status: 'CALCULEE' as StatutRecommandation,
  });
}

export async function finaliserParDefautOp(prisma: PrismaClient, recommandationId: string): Promise<RecommandationDetail> {
  const reco = await prisma.recommandationSerie.findUnique({ where: { id: recommandationId } });
  if (!reco) throw new Error('Recommandation introuvable');
  return updateRecommandationStatusOp(prisma, recommandationId, {
    status: 'VALIDEE_PAR_DEFAUT',
    finalTrack: reco.serieRecommandee,
    finalizedAt: new Date(),
  });
}

export async function ajouterRappelEnvoyeOp(prisma: PrismaClient, recommandationId: string): Promise<void> {
  const reco = await prisma.recommandationSerie.findUnique({
    where: { id: recommandationId },
    select: { remindersSentAt: true },
  });
  const existing = Array.isArray(reco?.remindersSentAt) ? (reco!.remindersSentAt as string[]) : [];
  await prisma.recommandationSerie.update({
    where: { id: recommandationId },
    data: { remindersSentAt: [...existing, new Date().toISOString()] as Prisma.InputJsonValue },
  });
}

export async function upsertCheckpointConfigOp(
  prisma: PrismaClient,
  schoolId: string,
  type: OrientationCheckpointType,
  data: {
    possibleTracks: unknown;
    relevantSubjects: unknown;
    psychotechnicalTestRequired: boolean;
    windowStartMonth: number;
    windowStartDay: number;
    windowEndMonth: number;
    windowEndDay: number;
    responseDeadlineDays: number;
  },
): Promise<CheckpointConfigDetail> {
  const fields = {
    possibleTracks: data.possibleTracks as Prisma.InputJsonValue,
    relevantSubjects: data.relevantSubjects as Prisma.InputJsonValue,
    psychotechnicalTestRequired: data.psychotechnicalTestRequired,
    windowStartMonth: data.windowStartMonth,
    windowStartDay: data.windowStartDay,
    windowEndMonth: data.windowEndMonth,
    windowEndDay: data.windowEndDay,
    responseDeadlineDays: data.responseDeadlineDays,
  };
  const config = await prisma.orientationCheckpointConfig.upsert({
    where: { schoolId_type: { schoolId, type } },
    update: fields,
    create: { schoolId, type, ...fields },
  });
  return config as CheckpointConfigDetail;
}

export async function getOrientationStatsOp(
  prisma: PrismaClient,
  schoolId: string,
  academicYearId?: string,
): Promise<OrientationStats> {
  const where: Prisma.FicheOrientationWhereInput = {
    ...orientationFicheWhere(schoolId),
    ...(academicYearId ? { academicYearId } : {}),
  };

  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    fichesOuvertes,
    elevesArisqueEleve,
    elevesArisqueCritique,
    entretiensThisMois,
    recommandationsEnAttente,
    repartition,
  ] = await Promise.all([
    prisma.ficheOrientation.count({ where: { ...where, status: { in: ['OUVERTE', 'EN_COURS'] } } }),
    prisma.ficheOrientation.count({ where: { ...where, riskLevel: 'ELEVE' } }),
    prisma.ficheOrientation.count({ where: { ...where, riskLevel: 'CRITIQUE' } }),
    prisma.entretienOrientation.count({ where: { fiche: where, date: { gte: debutMois } } }),
    prisma.recommandationSerie.count({ where: { fiche: where, status: 'PROPOSEE' } }),
    prisma.ficheOrientation.groupBy({ by: ['riskLevel'], where, _count: true }),
  ]);

  const repartitionRisque: Record<string, number> = {};
  for (const item of repartition) {
    repartitionRisque[item.riskLevel] = item._count;
  }

  return {
    fichesOuvertes,
    elevesArisqueEleve,
    elevesArisqueCritique,
    entretiensThisMois,
    recommandationsEnAttente,
    repartitionRisque,
  };
}

export async function findSerieActuelleOp(prisma: PrismaClient, studentId: string): Promise<SerieActuelleDetail | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: { enrollmentsYearScoped: ENROLLMENT_SERIE_SELECT },
  });
  const classe = profile?.enrollmentsYearScoped[0]?.class ?? null;
  if (!classe) return null;
  return { name: classe.name, level: classe.level, serie: classe.serie };
}

export async function listElevesAOrienterOp(
  prisma: PrismaClient,
  schoolId: string,
  checkpointType: OrientationCheckpointType,
  academicYearId: string,
): Promise<EleveAOrienterDetail[]> {
  const eligibiliteWhere = checkpointType === 'FIN_TROISIEME'
    ? { level: '3e' }
    : { level: '2nde', serie: 'C' };

  const eleves = await prisma.studentProfile.findMany({
    where: {
      studentStatus: 'ACTIVE',
      enrollmentsYearScoped: {
        some: { status: 'ACTIVE', academicYear: { isCurrent: true }, class: eligibiliteWhere },
      },
      user: { schoolId },
    },
    select: {
      userId: true,
      enrollmentsYearScoped: ENROLLMENT_CLASS_SELECT,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (eleves.length === 0) return [];

  const studentIds = eleves.map((e) => e.userId);
  const recommandations = await prisma.recommandationSerie.findMany({
    where: { studentId: { in: studentIds }, checkpointType, fiche: { academicYearId } },
    select: { studentId: true, status: true },
  });
  const recoByStudent = new Map(recommandations.map((r) => [r.studentId, r.status]));

  return eleves.map((e) => ({
    studentId: e.userId,
    firstName: e.user.firstName,
    lastName: e.user.lastName,
    className: e.enrollmentsYearScoped[0]?.class?.name ?? '—',
    hasRecommendation: recoByStudent.has(e.userId),
    recommendationStatus: recoByStudent.get(e.userId) ?? null,
  }));
}
