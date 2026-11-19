/**
 * DOMAIN LAYER — Port Repository Bulletin (ReportCard)
 */
import type { Bulletin } from '@domain/entities/Bulletin';
import type { BulletinGroupingScheme, BulletinValidationStatus } from '@domain/types/enums';
import type { BulletinTemplate } from '@domain/types/enums';

export interface BulletinAvecContexteClasse {
  bulletin: Bulletin;
  professorPrincipalId: string | null;
}

export interface BulletinEnrichi {
  bulletin: Bulletin;
  schoolSubsystem: string | null;
  sectionCode: string | null;
  studentFirstName: string;
  studentLastName: string;
  professorPrincipalId: string | null;
}

export interface BulletinExportData {
  id: string;
  schoolId: string;
  studentId: string;
  academicYearId: string;
  academicPeriodId: string;
  template: BulletinTemplate | string | null;
  templateSpecId?: string | null;
  templateVersion?: number;
  computationVersion?: number;
  snapshotData?: unknown;
  contentHash?: string | null;
  verifyToken?: string | null;
  reprintCount?: number;
  pdfUrl?: string | null;
  generalAverage: number | null;
  rank: number | null;
  totalStudents: number | null;
  absenceCount: number;
  mention: string | null;
  classMasterComment: string | null;
  academicYear: { id: string; name: string } | null;
  academicPeriod: { id: string; name: string } | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentProfile: {
      matricule?: string | null;
      dateOfBirth?: Date | null;
      placeOfBirth?: string | null;
      gender?: string | null;
      isRepeater?: boolean;
      photoUrl?: string | null;
      enrollmentsYearScoped: Array<{ class: { id?: string; name: string; level?: string | null; section: { code: string } | null } | null }>;
    } | null;
  };
  subjectLines: Array<{
    subjectId: string;
    subjectName: string;
    coefficient: number;
    seq1Score: number | null;
    seq2Score: number | null;
    compositionScore: number | null;
    seq3Score: number | null;
    seq4Score: number | null;
    seq5Score: number | null;
    seq6Score: number | null;
    classTestScore: number | null;
    terminalExamScore: number | null;
    theoreticalScore: number | null;
    practicalScore: number | null;
    professionalAttitude: number | null;
    oralScore: number | null;
    selfDevelopmentScore: number | null;
    subjectAverage: number | null;
    weightedScore: number | null;
    subjectRank?: number | null;
    groupKey?: string | null;
    groupLabel?: string | null;
    groupOrder?: number | null;
    teacherName?: string | null;
    classSubjectAverage?: number | null;
    minSubjectAverage?: number | null;
    maxSubjectAverage?: number | null;
    teacherComment: string | null;
    competenceLabel: string | null;
  }>;
  school: {
    id: string;
    name: string;
    city?: string | null;
    region?: string | null;
    phone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    subsystem: string | null;
    schoolConfig: {
      bulletinTemplate?: string | null;
      bulletinGroupingScheme?: BulletinGroupingScheme | null;
      useMeasuredBulletinRenderer?: boolean;
      sequenceCalculationMode?: string | null;
      classTestWeight?: number | null;
      terminalExamWeight?: number | null;
      ds1Weight?: number | null;
      ds2Weight?: number | null;
      compositionWeight?: number | null;
      passMark?: number | null;
    } | null;
    schoolSettings: { timezone?: string | null; locale?: string | null; schoolMotto?: string | null } | null;
  } | null;
  section: { code: string } | null;
}

export interface BulletinRevocationArchiveRecord {
  id: string;
  originalReportCardId: string;
  schoolId: string;
  studentId: string;
  academicYearId: string;
  academicPeriodId: string;
  computationVersion: number;
  templateSpecId: string | null;
  templateVersion: number;
  generalAverage: number | null;
  rank: number | null;
  snapshotData: unknown;
  contentHash: string | null;
  verifyToken: string | null;
  revokedById: string;
  revocationReason: string;
  revokedAt: Date;
}

export interface BulletinRepository {
  // Lecture
  findById(id: string): Promise<Bulletin | null>;
  findByEleve(studentId: string, academicYearId: string): Promise<Bulletin[]>;
  findByEleveEtPeriode(studentId: string, academicPeriodId: string): Promise<Bulletin | null>;
  findByClasse(classId: string, academicPeriodId: string): Promise<Bulletin[]>;
  findBySchool(schoolId: string, academicYearId: string): Promise<Bulletin[]>;
  findWithClasseContext(bulletinId: string, schoolId: string): Promise<BulletinAvecContexteClasse | null>;
  findEnrichedById(bulletinId: string, schoolId: string): Promise<BulletinEnrichi | null>;
  findPreviousByStudent(studentId: string, schoolId: string, excludeBulletinId?: string): Promise<{ generalAverage: number | null } | null>;
  // Export / PDF — shared prisma include (enrollmentsYearScoped/class.name, schoolConfig, section.code, schoolSettings)
  findForExport(schoolId: string, academicPeriodId: string, classId?: string): Promise<BulletinExportData[]>;
  findExportDataByPeriode(schoolId: string, academicPeriodId: string, classId?: string): Promise<BulletinExportData[]>;
  findForPdf(bulletinId: string, schoolId: string): Promise<BulletinExportData | null>;

  // Listing — report-card controller (mesBulletins / lister)
  findByEleveFiltre(params: { schoolId: string; studentId: string; academicYearId?: string; classWorkflowStatusIn?: string[] }): Promise<Record<string, unknown>[]>;
  findPaginated(params: {
    schoolId: string;
    academicYearId?: string;
    academicPeriodId?: string;
    studentId?: string | { in: string[] };
    classId?: string;
    classWorkflowStatusIn?: string[];
    page: number;
    limit: number;
  }): Promise<{ items: Record<string, unknown>[]; total: number }>;
  getStatsValidationParClasse(params: { classId: string; schoolId: string; sequenceIds: string[] }): Promise<{ total: number; DRAFT: number; LOCKED: number }>;

  // Stats pour le classement
  getMoyennesClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<{ studentId: string; generalAverage: number }[]>;

  // Écriture
  save(bulletin: Bulletin): Promise<void>;
  update(bulletin: Bulletin): Promise<void>;
  archiverEtRemplacerRevoque(revokedBulletin: Bulletin, replacement: Bulletin): Promise<void>;
  findRevocationsByStudent(schoolId: string, studentId: string): Promise<BulletinRevocationArchiveRecord[]>;
  updatePdfUrl(bulletinId: string, pdfUrl: string): Promise<void>;
  updatePdfMetadata(bulletinId: string, params: { pdfUrl: string; templateSpecId?: string | null; templateVersion?: number }): Promise<void>;
  updateClassMasterComment(bulletinId: string, comment: string): Promise<void>;
  updateAiComment(bulletinId: string, comment: string): Promise<void>;
  majStatutWorkflowParClasse(classId: string, academicPeriodId: string, schoolId: string, status: BulletinValidationStatus | null): Promise<number>;
  delete(id: string): Promise<void>;

  // ReportCardController — déport des prisma.* (1 caller, reuse port, no use case)
  findRecentSince(schoolId: string, academicPeriodId: string, since: Date): Promise<Array<{ studentId: string; student: { id: string; firstName: string | null; lastName: string | null } }>>;

  // Tableau d'honneur — trimestriel & annuel
  findTableauHonneur(params: { classId: string; schoolId: string; academicPeriodId: string; top: number }): Promise<{ student: { firstName: string; lastName: string }; generalAverage: number; mention: string | null }[]>;
  findForAnnual(params: { classId: string; schoolId: string; periodIds: string[] }): Promise<{ studentId: string; student: { firstName: string; lastName: string }; generalAverage: number | null }[]>;

  // Inngest — upsert direct (reportCards inngest historique)
  upsertBulletin(data: { schoolId: string; studentId: string; academicYearId: string; academicPeriodId: string; generalAverage: number; rank: number | null; mention: string; absenceCount: number }): Promise<{ id: string }>;
  upsertLigneMatiere(reportCardId: string, ligne: { subjectId: string; subjectName: string; coefficient: number; seq1Score: number | null; seq2Score: number | null; subjectAverage: number }): Promise<void>;
}
