import type { PrismaClient, FicheOrientation as PrismaFicheOrientation } from '@prisma/client';
import type {
  IOrientationRepository,
  FicheListItem,
  FicheDetail,
  EntretienDetail,
  TestDetail,
  RecommandationDetail,
  SuiviDetail,
  OrientationStats,
  ListeFichesFilters,
  CheckpointConfigDetail,
  AspirationDetail,
  SerieActuelleDetail,
  EleveAOrienterDetail,
} from '@domain/ports/repositories/IOrientationRepository';
import { FicheOrientation } from '@domain/entities/FicheOrientation';
import type {
  NiveauRisque,
  TypePreoccupation,
  TypeEntretien,
  MotifEntretien,
  StatutEntretien,
  TypeTest,
  StatutRecommandation,
  OrientationCheckpointType,
  ConfidenceLevel,
} from '@domain/entities/FicheOrientation';
import {
  ORIENTATION_STUDENT_SELECT,
  ajouterRappelEnvoyeOp,
  createOrUpdateRecommandationCheckpointOp,
  finaliserParDefautOp,
  findFichesOrientationOp,
  findSerieActuelleOp,
  getOrientationStatsOp,
  listElevesAOrienterOp,
  mapOrientationStudent,
  orientationFicheWhere,
  updateRecommandationStatusOp,
  upsertCheckpointConfigOp,
  upsertRecommandationOp,
} from './helpers/orientationAnalyticsHelpers';

export class PrismaOrientationRepository implements IOrientationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findFicheByStudentAndYear(studentId: string, academicYearId: string): Promise<FicheOrientation | null> {
    const data = await this.prisma.ficheOrientation.findFirst({ where: { studentId, academicYearId } });
    return data ? this.toDomain(data) : null;
  }

  async findFicheById(ficheId: string, schoolId: string): Promise<FicheOrientation | null> {
    const data = await this.prisma.ficheOrientation.findFirst({ where: orientationFicheWhere(schoolId, ficheId) });
    return data ? this.toDomain(data) : null;
  }

  async findFicheDetailById(ficheId: string, schoolId: string): Promise<FicheDetail | null> {
    const data = await this.prisma.ficheOrientation.findFirst({
      where: orientationFicheWhere(schoolId, ficheId),
      include: {
        student: { select: ORIENTATION_STUDENT_SELECT },
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
      student: mapOrientationStudent(data.student),
      entretiens: data.entretiens as EntretienDetail[],
      tests: data.tests as TestDetail[],
      recommandation: data.recommandation as RecommandationDetail | null,
      suivis: data.suivis as SuiviDetail[],
    };
  }

  async findFiches(filters: ListeFichesFilters): Promise<{ fiches: FicheListItem[]; total: number }> {
    return findFichesOrientationOp(this.prisma, filters);
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
      where: { id: entretienId, fiche: orientationFicheWhere(schoolId) },
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
    return upsertRecommandationOp(this.prisma, ficheId, studentId, {
      serieActuelle: data.serieActuelle,
      serieRecommandee: data.serieRecommandee,
      justification: data.justification,
      status: 'PROPOSEE',
    });
  }

  async validerRecommandation(recommandationId: string, schoolId: string): Promise<RecommandationDetail> {
    const existante = await this.findRecommandationById(recommandationId, schoolId);
    if (!existante) throw new Error('Recommandation introuvable');
    return updateRecommandationStatusOp(this.prisma, recommandationId, { adminValidated: true, status: 'VALIDEE_ADMIN' });
  }

  async findRecommandationById(recommandationId: string, schoolId: string): Promise<RecommandationDetail | null> {
    const reco = await this.prisma.recommandationSerie.findFirst({
      where: { id: recommandationId, fiche: orientationFicheWhere(schoolId) },
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
    return createOrUpdateRecommandationCheckpointOp(this.prisma, ficheId, studentId, data);
  }

  async validerRecommandationConseiller(recommandationId: string, serieRecommandee: string): Promise<RecommandationDetail> {
    return updateRecommandationStatusOp(this.prisma, recommandationId, { serieRecommandee, status: 'VALIDEE_CONSEILLER' });
  }

  async proposerRecommandationEleve(recommandationId: string, responseDeadline: Date): Promise<RecommandationDetail> {
    return updateRecommandationStatusOp(this.prisma, recommandationId, { status: 'PROPOSEE_A_L_ELEVE', responseDeadline });
  }

  async choisirPisteEleve(recommandationId: string, track: string): Promise<RecommandationDetail> {
    return updateRecommandationStatusOp(this.prisma, recommandationId, { status: 'VALIDEE_ELEVE', studentChosenTrack: track, finalTrack: track, finalizedAt: new Date() });
  }

  async finaliserParDefaut(recommandationId: string): Promise<RecommandationDetail> {
    return finaliserParDefautOp(this.prisma, recommandationId);
  }

  async ajouterRappelEnvoye(recommandationId: string): Promise<void> {
    return ajouterRappelEnvoyeOp(this.prisma, recommandationId);
  }

  async findRecommandationsParStatut(schoolId: string, status: StatutRecommandation): Promise<RecommandationDetail[]> {
    const recos = await this.prisma.recommandationSerie.findMany({
      where: { status, fiche: orientationFicheWhere(schoolId) },
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
    return upsertCheckpointConfigOp(this.prisma, schoolId, type, data);
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
    return getOrientationStatsOp(this.prisma, schoolId, academicYearId);
  }

  // ── Moteur / board ──────────────────────────────────────────────────────────

  async findSerieActuelle(studentId: string): Promise<SerieActuelleDetail | null> {
    return findSerieActuelleOp(this.prisma, studentId);
  }

  async listElevesAOrienter(schoolId: string, checkpointType: OrientationCheckpointType, academicYearId: string): Promise<EleveAOrienterDetail[]> {
    return listElevesAOrienterOp(this.prisma, schoolId, checkpointType, academicYearId);
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
