// ponytail: 602l → ~530l via helpers, single adapter <800l ceiling, split when 2nd impl or >800l
import type { PrismaClient, Prisma, FicheOrientation as PrismaFicheOrientation } from '@prisma/client';
import type { IOrientationRepository, FicheListItem, FicheDetail, EntretienDetail, TestDetail, RecommandationDetail, SuiviDetail, OrientationStats, ListeFichesFilters, CheckpointConfigDetail, AspirationDetail, SerieActuelleDetail, EleveAOrienterDetail } from '@domain/ports/repositories/IOrientationRepository';
import { FicheOrientation } from '@domain/entities/FicheOrientation';
import type { NiveauRisque, TypePreoccupation, TypeEntretien, MotifEntretien, StatutEntretien, TypeTest, StatutRecommandation, OrientationCheckpointType, ConfidenceLevel } from '@domain/entities/FicheOrientation';

export class PrismaOrientationRepository implements IOrientationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly studentSelect = {
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

  private readonly enrollmentClassSelect = {
    where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
    select: { class: { select: { name: true } } },
    take: 1,
  } as const;

  private readonly enrollmentSerieSelect = {
    where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
    select: { class: { select: { name: true, level: true, serie: true } } },
    take: 1,
  } as const;

  private ficheWhere(schoolId: string, ficheId?: string): Prisma.FicheOrientationWhereInput {
    return ficheId ? { id: ficheId, schoolId } : { schoolId };
  }

  private async upsertRecommandation(
    ficheId: string,
    studentId: string,
    payload: Prisma.RecommandationSerieUncheckedUpdateInput,
  ): Promise<RecommandationDetail> {
    const existing = await this.prisma.recommandationSerie.findUnique({ where: { ficheOrientationId: ficheId } });
    if (existing) {
      const updated = await this.prisma.recommandationSerie.update({ where: { ficheOrientationId: ficheId }, data: payload as Prisma.RecommandationSerieUpdateInput });
      return updated as RecommandationDetail;
    }
    const created = await this.prisma.recommandationSerie.create({
      data: { ficheOrientationId: ficheId, studentId, ...(payload as unknown as Prisma.RecommandationSerieUncheckedCreateInput) },
    });
    return created as RecommandationDetail;
  }

  private async updateRecommandationStatus(id: string, patch: Prisma.RecommandationSerieUpdateInput): Promise<RecommandationDetail> {
    const updated = await this.prisma.recommandationSerie.update({ where: { id }, data: patch });
    return updated as RecommandationDetail;
  }

  async findFicheByStudentAndYear(studentId: string, academicYearId: string): Promise<FicheOrientation | null> {
    const data = await this.prisma.ficheOrientation.findFirst({
      where: { studentId, academicYearId },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findFicheById(ficheId: string, schoolId: string): Promise<FicheOrientation | null> {
    const data = await this.prisma.ficheOrientation.findFirst({
      where: this.ficheWhere(schoolId, ficheId),
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findFicheDetailById(ficheId: string, schoolId: string): Promise<FicheDetail | null> {
    const data = await this.prisma.ficheOrientation.findFirst({
      where: this.ficheWhere(schoolId, ficheId),
      include: {
        student: { select: this.studentSelect },
        entretiens: { orderBy: { date: 'desc' } },
        tests: { orderBy: { datePassage: 'desc' } },
        recommandation: true,
        suivis: { orderBy: { date: 'desc' } },
      },
    });
    if (!data) return null;
    return {
      id: data.id,
      studentId: data.studentId,
      schoolId: data.schoolId,
      academicYearId: data.academicYearId,
      conseillerId: data.conseillerId,
      status: data.status,
      riskLevel: data.riskLevel,
      mainConcern: data.mainConcern,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      student: this.mapStudent(data.student),
      entretiens: data.entretiens as EntretienDetail[],
      tests: data.tests as TestDetail[],
      recommandation: data.recommandation as RecommandationDetail | null,
      suivis: data.suivis as SuiviDetail[],
    };
  }

  async findFiches(filters: ListeFichesFilters): Promise<{ fiches: FicheListItem[]; total: number }> {
    const { schoolId, classId, riskLevel, status, academicYearId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      ...this.ficheWhere(schoolId),
      ...(riskLevel ? { riskLevel } : {}),
      ...(status ? { status } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(classId ? { student: { studentProfile: { enrollmentsYearScoped: { some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } } } } } } : {}),
    } as Prisma.FicheOrientationWhereInput;

    const [total, items] = await Promise.all([
      this.prisma.ficheOrientation.count({ where }),
      this.prisma.ficheOrientation.findMany({
        where,
        include: {
          student: { select: this.studentSelect },
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
        student: this.mapStudent(f.student),
        _count: f._count,
      })),
      total,
    };
  }

  async createFiche(data: {
    studentId: string; schoolId: string; academicYearId: string;
    conseillerId: string; mainConcern?: TypePreoccupation;
  }): Promise<FicheOrientation> {
    const created = await this.prisma.ficheOrientation.create({
      data: {
        studentId: data.studentId,
        schoolId: data.schoolId,
        academicYearId: data.academicYearId,
        conseillerId: data.conseillerId,
        mainConcern: data.mainConcern ?? null,
        status: 'OUVERTE',
        riskLevel: 'FAIBLE',
      },
    });
    return this.toDomain(created);
  }

  async updateFicheRiskLevel(ficheId: string, riskLevel: NiveauRisque, mainConcern: TypePreoccupation): Promise<void> {
    await this.prisma.ficheOrientation.update({
      where: { id: ficheId },
      data: { riskLevel, mainConcern },
    });
  }

  async createEntretien(ficheId: string, data: {
    date: Date; type: TypeEntretien; motif: MotifEntretien;
    notes?: string; recommendations?: string; nextActions?: string;
    parentNotified?: boolean; followUpDate?: Date; status?: StatutEntretien;
  }): Promise<EntretienDetail> {
    const created = await this.prisma.entretienOrientation.create({
      data: {
        ficheOrientationId: ficheId,
        date: data.date,
        type: data.type,
        motif: data.motif,
        notes: data.notes ?? null,
        recommendations: data.recommendations ?? null,
        nextActions: data.nextActions ?? null,
        parentNotified: data.parentNotified ?? false,
        followUpDate: data.followUpDate ?? null,
        status: data.status ?? 'PLANIFIE',
      },
    });
    return created as EntretienDetail;
  }

  async updateEntretien(entretienId: string, schoolId: string, data: Partial<{
    notes: string; recommendations: string; nextActions: string;
    parentNotified: boolean; followUpDate: Date; status: StatutEntretien;
  }>): Promise<EntretienDetail> {
    const autorise = await this.prisma.entretienOrientation.findFirst({
      where: { id: entretienId, fiche: this.ficheWhere(schoolId) },
      select: { id: true },
    });
    if (!autorise) throw new Error('Entretien introuvable');

    const updated = await this.prisma.entretienOrientation.update({
      where: { id: entretienId },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.recommendations !== undefined ? { recommendations: data.recommendations } : {}),
        ...(data.nextActions !== undefined ? { nextActions: data.nextActions } : {}),
        ...(data.parentNotified !== undefined ? { parentNotified: data.parentNotified } : {}),
        ...(data.followUpDate !== undefined ? { followUpDate: data.followUpDate } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
    return updated as EntretienDetail;
  }

  async createTest(ficheId: string, data: {
    type: TypeTest; datePassage: Date; resultats: string;
    interpretation?: string; scoreGlobal?: number;
    checkpointType?: OrientationCheckpointType;
    scientificAptitude?: number; literaryAptitude?: number; technicalAptitude?: number;
    administeredById?: string;
  }): Promise<TestDetail> {
    const created = await this.prisma.testAptitude.create({
      data: {
        ficheOrientationId: ficheId,
        type: data.type,
        datePassage: data.datePassage,
        resultats: data.resultats,
        interpretation: data.interpretation ?? null,
        scoreGlobal: data.scoreGlobal ?? null,
        checkpointType: data.checkpointType ?? null,
        scientificAptitude: data.scientificAptitude ?? null,
        literaryAptitude: data.literaryAptitude ?? null,
        technicalAptitude: data.technicalAptitude ?? null,
        administeredById: data.administeredById ?? null,
      },
    });
    return created as TestDetail;
  }

  async findTestByFicheAndCheckpoint(ficheId: string, checkpointType: OrientationCheckpointType): Promise<TestDetail | null> {
    const test = await this.prisma.testAptitude.findFirst({
      where: { ficheOrientationId: ficheId, checkpointType },
      orderBy: { datePassage: 'desc' },
    });
    return test as TestDetail | null;
  }

  async createOrUpdateRecommandation(ficheId: string, studentId: string, data: {
    serieActuelle: string; serieRecommandee: string; justification: string;
  }): Promise<RecommandationDetail> {
    return this.upsertRecommandation(ficheId, studentId, {
      serieActuelle: data.serieActuelle,
      serieRecommandee: data.serieRecommandee,
      justification: data.justification,
      status: 'PROPOSEE',
    });
  }

  async validerRecommandation(recommandationId: string, schoolId: string): Promise<RecommandationDetail> {
    const existante = await this.findRecommandationById(recommandationId, schoolId);
    if (!existante) throw new Error('Recommandation introuvable');
    return this.updateRecommandationStatus(recommandationId, { adminValidated: true, status: 'VALIDEE_ADMIN' });
  }

  async findRecommandationById(recommandationId: string, schoolId: string): Promise<RecommandationDetail | null> {
    const reco = await this.prisma.recommandationSerie.findFirst({
      where: { id: recommandationId, fiche: this.ficheWhere(schoolId) },
    });
    return reco as RecommandationDetail | null;
  }

  async createOrUpdateRecommandationCheckpoint(ficheId: string, studentId: string, data: {
    checkpointType: OrientationCheckpointType;
    serieActuelle: string;
    suggestedTracks: unknown;
    confidenceLevel: ConfidenceLevel;
    dataDepthMonths: number;
    justification: string;
  }): Promise<RecommandationDetail> {
    const tracks = data.suggestedTracks as Array<{ track: string; score: number }>;
    const topTrack = tracks?.[0]?.track ?? data.serieActuelle;
    return this.upsertRecommandation(ficheId, studentId, {
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

  async validerRecommandationConseiller(recommandationId: string, serieRecommandee: string): Promise<RecommandationDetail> {
    return this.updateRecommandationStatus(recommandationId, { serieRecommandee, status: 'VALIDEE_CONSEILLER' });
  }

  async proposerRecommandationEleve(recommandationId: string, responseDeadline: Date): Promise<RecommandationDetail> {
    return this.updateRecommandationStatus(recommandationId, { status: 'PROPOSEE_A_L_ELEVE', responseDeadline });
  }

  async choisirPisteEleve(recommandationId: string, track: string): Promise<RecommandationDetail> {
    return this.updateRecommandationStatus(recommandationId, { status: 'VALIDEE_ELEVE', studentChosenTrack: track, finalTrack: track, finalizedAt: new Date() });
  }

  async finaliserParDefaut(recommandationId: string): Promise<RecommandationDetail> {
    const reco = await this.prisma.recommandationSerie.findUnique({ where: { id: recommandationId } });
    if (!reco) throw new Error('Recommandation introuvable');
    return this.updateRecommandationStatus(recommandationId, { status: 'VALIDEE_PAR_DEFAUT', finalTrack: reco.serieRecommandee, finalizedAt: new Date() });
  }

  async ajouterRappelEnvoye(recommandationId: string): Promise<void> {
    const reco = await this.prisma.recommandationSerie.findUnique({
      where: { id: recommandationId },
      select: { remindersSentAt: true },
    });
    const existing = Array.isArray(reco?.remindersSentAt) ? (reco!.remindersSentAt as string[]) : [];
    await this.prisma.recommandationSerie.update({
      where: { id: recommandationId },
      data: { remindersSentAt: [...existing, new Date().toISOString()] as Prisma.InputJsonValue },
    });
  }

  async findRecommandationsParStatut(schoolId: string, status: StatutRecommandation): Promise<RecommandationDetail[]> {
    const recos = await this.prisma.recommandationSerie.findMany({
      where: { status, fiche: this.ficheWhere(schoolId) },
    });
    return recos as RecommandationDetail[];
  }

  async findCheckpointConfig(schoolId: string, type: OrientationCheckpointType): Promise<CheckpointConfigDetail | null> {
    const config = await this.prisma.orientationCheckpointConfig.findUnique({
      where: { schoolId_type: { schoolId, type } },
    });
    return config as CheckpointConfigDetail | null;
  }

  async findCheckpointConfigsActives(schoolId: string): Promise<CheckpointConfigDetail[]> {
    const configs = await this.prisma.orientationCheckpointConfig.findMany({ where: { schoolId } });
    return configs as CheckpointConfigDetail[];
  }

  async upsertCheckpointConfig(schoolId: string, type: OrientationCheckpointType, data: {
    possibleTracks: unknown; relevantSubjects: unknown; psychotechnicalTestRequired: boolean;
    windowStartMonth: number; windowStartDay: number; windowEndMonth: number; windowEndDay: number;
    responseDeadlineDays: number;
  }): Promise<CheckpointConfigDetail> {
    const config = await this.prisma.orientationCheckpointConfig.upsert({
      where: { schoolId_type: { schoolId, type } },
      update: {
        possibleTracks: data.possibleTracks as Prisma.InputJsonValue,
        relevantSubjects: data.relevantSubjects as Prisma.InputJsonValue,
        psychotechnicalTestRequired: data.psychotechnicalTestRequired,
        windowStartMonth: data.windowStartMonth,
        windowStartDay: data.windowStartDay,
        windowEndMonth: data.windowEndMonth,
        windowEndDay: data.windowEndDay,
        responseDeadlineDays: data.responseDeadlineDays,
      },
      create: {
        schoolId, type,
        possibleTracks: data.possibleTracks as Prisma.InputJsonValue,
        relevantSubjects: data.relevantSubjects as Prisma.InputJsonValue,
        psychotechnicalTestRequired: data.psychotechnicalTestRequired,
        windowStartMonth: data.windowStartMonth,
        windowStartDay: data.windowStartDay,
        windowEndMonth: data.windowEndMonth,
        windowEndDay: data.windowEndDay,
        responseDeadlineDays: data.responseDeadlineDays,
      },
    });
    return config as CheckpointConfigDetail;
  }

  async findAspiration(studentId: string, checkpointType: OrientationCheckpointType): Promise<AspirationDetail | null> {
    const aspiration = await this.prisma.studentAspiration.findUnique({
      where: { studentId_checkpointType: { studentId, checkpointType } },
    });
    return aspiration as AspirationDetail | null;
  }

  async createOrUpdateAspiration(studentId: string, schoolId: string, checkpointType: OrientationCheckpointType, data: {
    desiredTrack?: string; careerInterest?: string;
  }): Promise<AspirationDetail> {
    const aspiration = await this.prisma.studentAspiration.upsert({
      where: { studentId_checkpointType: { studentId, checkpointType } },
      update: { desiredTrack: data.desiredTrack ?? null, careerInterest: data.careerInterest ?? null },
      create: {
        studentId, schoolId, checkpointType,
        desiredTrack: data.desiredTrack ?? null,
        careerInterest: data.careerInterest ?? null,
      },
    });
    return aspiration as AspirationDetail;
  }

  async createSuivi(ficheId: string, data: {
    riskLevel: NiveauRisque; mainConcern: TypePreoccupation;
    interventions?: string; prochainRdv?: Date; notes?: string;
  }): Promise<SuiviDetail> {
    const created = await this.prisma.suiviOrientation.create({
      data: {
        ficheOrientationId: ficheId,
        riskLevel: data.riskLevel,
        mainConcern: data.mainConcern,
        interventions: data.interventions ?? null,
        prochainRdv: data.prochainRdv ?? null,
        notes: data.notes ?? null,
        date: new Date(),
      },
    });
    return created as SuiviDetail;
  }

  async getStats(schoolId: string, academicYearId?: string): Promise<OrientationStats> {
    const where: Prisma.FicheOrientationWhereInput = { ...this.ficheWhere(schoolId), ...(academicYearId ? { academicYearId } : {}) };

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
      this.prisma.ficheOrientation.count({ where: { ...where, status: { in: ['OUVERTE', 'EN_COURS'] } } }),
      this.prisma.ficheOrientation.count({ where: { ...where, riskLevel: 'ELEVE' } }),
      this.prisma.ficheOrientation.count({ where: { ...where, riskLevel: 'CRITIQUE' } }),
      this.prisma.entretienOrientation.count({
        where: {
          fiche: where,
          date: { gte: debutMois },
        },
      }),
      this.prisma.recommandationSerie.count({
        where: {
          fiche: where,
          status: 'PROPOSEE',
        },
      }),
      this.prisma.ficheOrientation.groupBy({
        by: ['riskLevel'],
        where,
        _count: true,
      }),
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

  private mapStudent(student: {
    id: string; firstName: string; lastName: string;
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

  // ── Moteur / board ──────────────────────────────────────────────────────────

  async findSerieActuelle(studentId: string): Promise<SerieActuelleDetail | null> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: {
        enrollmentsYearScoped: this.enrollmentSerieSelect,
      },
    });
    const classe = profile?.enrollmentsYearScoped[0]?.class ?? null;
    if (!classe) return null;
    return { name: classe.name, level: classe.level, serie: classe.serie };
  }

  async listElevesAOrienter(schoolId: string, checkpointType: OrientationCheckpointType, academicYearId: string): Promise<EleveAOrienterDetail[]> {
    const eligibiliteWhere = checkpointType === 'FIN_TROISIEME'
      ? { level: '3e' }
      : { level: '2nde', serie: 'C' };

    const eleves = await this.prisma.studentProfile.findMany({
      where: {
        studentStatus: 'ACTIVE',
        enrollmentsYearScoped: {
          some: {
            status: 'ACTIVE',
            academicYear: { isCurrent: true },
            class: eligibiliteWhere,
          },
        },
        user: { schoolId },
      },
      select: {
        userId: true,
        enrollmentsYearScoped: this.enrollmentClassSelect,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (eleves.length === 0) return [];

    const studentIds = eleves.map(e => e.userId);
    const recommandations = await this.prisma.recommandationSerie.findMany({
      where: {
        studentId: { in: studentIds },
        checkpointType,
        fiche: { academicYearId },
      },
      select: { studentId: true, status: true },
    });
    const recoByStudent = new Map(recommandations.map(r => [r.studentId, r.status]));

    return eleves.map(e => ({
      studentId: e.userId,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      className: e.enrollmentsYearScoped[0]?.class?.name ?? '—',
      hasRecommendation: recoByStudent.has(e.userId),
      recommendationStatus: recoByStudent.get(e.userId) ?? null,
    }));
  }

  private toDomain(data: PrismaFicheOrientation): FicheOrientation {
    return new FicheOrientation({
      id: data.id,
      studentId: data.studentId,
      schoolId: data.schoolId,
      academicYearId: data.academicYearId,
      conseillerId: data.conseillerId,
      status: data.status,
      riskLevel: data.riskLevel,
      mainConcern: data.mainConcern ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
