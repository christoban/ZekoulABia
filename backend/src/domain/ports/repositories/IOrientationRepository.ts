/**
 * DOMAIN LAYER — Port Repository Orientation
 * Toutes les opérations de persistance du module d'orientation.
 */
import type { FicheOrientation, NiveauRisque, TypePreoccupation, TypeEntretien, MotifEntretien, StatutEntretien, TypeTest, StatutRecommandation, OrientationCheckpointType, ConfidenceLevel } from '@domain/entities/FicheOrientation';

// ── DTOs lecture ─────────────────────────────────────────────────────────────

export interface FicheListItem {
  id: string;
  studentId: string;
  status: string;
  riskLevel: string;
  mainConcern: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentProfile?: { class?: { name: string } | null } | null };
  _count: { entretiens: number; tests: number; suivis: number };
}

export interface EntretienDetail {
  id: string;
  ficheOrientationId: string;
  date: Date;
  type: TypeEntretien;
  motif: MotifEntretien;
  notes: string | null;
  recommendations: string | null;
  nextActions: string | null;
  parentNotified: boolean;
  followUpDate: Date | null;
  status: StatutEntretien;
  createdAt: Date;
}

export interface TestDetail {
  id: string;
  ficheOrientationId: string;
  type: TypeTest;
  datePassage: Date;
  resultats: string;
  interpretation: string | null;
  scoreGlobal: number | null;
  checkpointType: OrientationCheckpointType | null;
  scientificAptitude: number | null;
  literaryAptitude: number | null;
  technicalAptitude: number | null;
  administeredById: string | null;
  createdAt: Date;
}

export interface RecommandationDetail {
  id: string;
  ficheOrientationId: string;
  studentId: string;
  serieActuelle: string;
  serieRecommandee: string;
  justification: string;
  parentNotified: boolean;
  adminValidated: boolean;
  status: StatutRecommandation;
  createdAt: Date;
  checkpointType: OrientationCheckpointType | null;
  suggestedTracks: unknown;
  confidenceLevel: ConfidenceLevel | null;
  dataDepthMonths: number | null;
  responseDeadline: Date | null;
  remindersSentAt: unknown;
  studentChosenTrack: string | null;
  finalizedAt: Date | null;
  finalTrack: string | null;
}

export interface CheckpointConfigDetail {
  id: string;
  schoolId: string;
  type: OrientationCheckpointType;
  possibleTracks: unknown;
  relevantSubjects: unknown;
  psychotechnicalTestRequired: boolean;
  windowStartMonth: number;
  windowStartDay: number;
  windowEndMonth: number;
  windowEndDay: number;
  responseDeadlineDays: number;
}

export interface AspirationDetail {
  id: string;
  studentId: string;
  schoolId: string;
  checkpointType: OrientationCheckpointType;
  desiredTrack: string | null;
  careerInterest: string | null;
  submittedAt: Date;
}

export interface SuiviDetail {
  id: string;
  ficheOrientationId: string;
  date: Date;
  riskLevel: NiveauRisque;
  mainConcern: TypePreoccupation;
  interventions: string | null;
  prochainRdv: Date | null;
  notes: string | null;
}

export interface FicheDetail {
  id: string;
  studentId: string;
  schoolId: string;
  academicYearId: string;
  conseillerId: string;
  status: string;
  riskLevel: string;
  mainConcern: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentProfile?: { class?: { name: string } | null } | null };
  entretiens: EntretienDetail[];
  tests: TestDetail[];
  recommandation: RecommandationDetail | null;
  suivis: SuiviDetail[];
}

export interface OrientationStats {
  fichesOuvertes:      number;
  elevesArisqueEleve:  number;
  elevesArisqueCritique: number;
  entretiensThisMois:  number;
  recommandationsEnAttente: number;
  repartitionRisque: Record<string, number>;
}

// ── Filtres ──────────────────────────────────────────────────────────────────

export interface ListeFichesFilters {
  schoolId:       string;
  classId?:       string;
  riskLevel?:     string;
  status?:        string;
  academicYearId?: string;
  page?:          number;
  limit?:         number;
}

// ── DTOs lecture —.Orientation board / moteur ────────────────────────────────

export interface SerieActuelleDetail {
  name: string | null;
  level: string | null;
  serie: string | null;
}

export interface EleveAOrienterDetail {
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
  hasRecommendation: boolean;
  recommendationStatus: string | null;
}

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IOrientationRepository {
  // Fiches
  findFicheByStudentAndYear(studentId: string, academicYearId: string): Promise<FicheOrientation | null>;
  findFicheById(ficheId: string, schoolId: string): Promise<FicheOrientation | null>;
  findFicheDetailById(ficheId: string, schoolId: string): Promise<FicheDetail | null>;
  findFiches(filters: ListeFichesFilters): Promise<{ fiches: FicheListItem[]; total: number }>;
  createFiche(data: {
    studentId: string; schoolId: string; academicYearId: string;
    conseillerId: string; mainConcern?: TypePreoccupation;
  }): Promise<FicheOrientation>;
  updateFicheRiskLevel(ficheId: string, riskLevel: NiveauRisque, mainConcern: TypePreoccupation): Promise<void>;

  // Entretiens
  createEntretien(ficheId: string, data: {
    date: Date; type: TypeEntretien; motif: MotifEntretien;
    notes?: string; recommendations?: string; nextActions?: string;
    parentNotified?: boolean; followUpDate?: Date;
    status?: StatutEntretien;
  }): Promise<EntretienDetail>;
  /**
   * Le `schoolId` est OBLIGATOIRE. EntretienOrientation ne porte pas de schoolId : sa tenancy
   * vient de sa FicheOrientation, le filtre passe donc par la relation `fiche`.
   */
  updateEntretien(entretienId: string, schoolId: string, data: Partial<{
    notes: string; recommendations: string; nextActions: string;
    parentNotified: boolean; followUpDate: Date; status: StatutEntretien;
  }>): Promise<EntretienDetail>;

  // Tests
  createTest(ficheId: string, data: {
    type: TypeTest; datePassage: Date; resultats: string;
    interpretation?: string; scoreGlobal?: number;
    checkpointType?: OrientationCheckpointType;
    scientificAptitude?: number; literaryAptitude?: number; technicalAptitude?: number;
    administeredById?: string;
  }): Promise<TestDetail>;
  findTestByFicheAndCheckpoint(ficheId: string, checkpointType: OrientationCheckpointType): Promise<TestDetail | null>;

  // Recommandation série
  createOrUpdateRecommandation(ficheId: string, studentId: string, data: {
    serieActuelle: string; serieRecommandee: string; justification: string;
  }): Promise<RecommandationDetail>;
  /** Le `schoolId` est OBLIGATOIRE : une recommandation d'une autre école doit être introuvable. */
  validerRecommandation(recommandationId: string, schoolId: string): Promise<RecommandationDetail>;

  // Recommandation — moteur de checkpoints (workflow CALCULEE → ... → VALIDEE_ELEVE/VALIDEE_PAR_DEFAUT)
  findRecommandationById(recommandationId: string, schoolId: string): Promise<RecommandationDetail | null>;
  createOrUpdateRecommandationCheckpoint(ficheId: string, studentId: string, data: {
    checkpointType: OrientationCheckpointType;
    serieActuelle: string;
    suggestedTracks: unknown;
    confidenceLevel: ConfidenceLevel;
    dataDepthMonths: number;
    justification: string;
  }): Promise<RecommandationDetail>;
  validerRecommandationConseiller(recommandationId: string, serieRecommandee: string): Promise<RecommandationDetail>;
  proposerRecommandationEleve(recommandationId: string, responseDeadline: Date): Promise<RecommandationDetail>;
  choisirPisteEleve(recommandationId: string, track: string): Promise<RecommandationDetail>;
  finaliserParDefaut(recommandationId: string): Promise<RecommandationDetail>;
  ajouterRappelEnvoye(recommandationId: string): Promise<void>;
  findRecommandationsParStatut(schoolId: string, status: StatutRecommandation): Promise<RecommandationDetail[]>;

  // Configuration des checkpoints
  findCheckpointConfig(schoolId: string, type: OrientationCheckpointType): Promise<CheckpointConfigDetail | null>;
  findCheckpointConfigsActives(schoolId: string): Promise<CheckpointConfigDetail[]>;
  upsertCheckpointConfig(schoolId: string, type: OrientationCheckpointType, data: {
    possibleTracks: unknown; relevantSubjects: unknown; psychotechnicalTestRequired: boolean;
    windowStartMonth: number; windowStartDay: number; windowEndMonth: number; windowEndDay: number;
    responseDeadlineDays: number;
  }): Promise<CheckpointConfigDetail>;

  // Aspirations élève
  findAspiration(studentId: string, checkpointType: OrientationCheckpointType): Promise<AspirationDetail | null>;
  createOrUpdateAspiration(studentId: string, schoolId: string, checkpointType: OrientationCheckpointType, data: {
    desiredTrack?: string; careerInterest?: string;
  }): Promise<AspirationDetail>;

  // Suivis
  createSuivi(ficheId: string, data: {
    riskLevel: NiveauRisque; mainConcern: TypePreoccupation;
    interventions?: string; prochainRdv?: Date; notes?: string;
  }): Promise<SuiviDetail>;

  // Stats
  getStats(schoolId: string, academicYearId?: string): Promise<OrientationStats>;

  // Moteur / board
  findSerieActuelle(studentId: string): Promise<SerieActuelleDetail | null>;
  listElevesAOrienter(schoolId: string, checkpointType: OrientationCheckpointType, academicYearId: string): Promise<EleveAOrienterDetail[]>;
}
