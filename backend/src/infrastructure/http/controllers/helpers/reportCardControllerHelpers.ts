import type { BulletinTemplate } from '@domain/types/enums';
import type { IAService } from '@domain/ports/services/IAService';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { BulletinExportData, BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinRendererPort } from '@domain/ports/services/BulletinRendererPort';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import type { BulletinTemplateSpecRepository } from '@domain/ports/repositories/BulletinTemplateSpecRepository';
import { getOrRegenerateSealedBulletinPdf } from '@application/reportCard/bulletinPdfLifecycle';
import { resolveLanguage } from '@domain/policies/LanguagePolicy';
import { buildLongTokenVerifyUrl } from '@domain/policies/BulletinVerifyCrypto';
import { generateBulletinPdf } from '@infrastructure/pdf/report-card/index';
import { getMention } from '@infrastructure/pdf/report-card/BulletinPdfHelpers';
import { getEffectiveSchoolSettings } from '@infrastructure/services/school-settings/SchoolSettingsService';
import { resolvePublicVerifyBaseUrl } from '@infrastructure/config/EnvAppConfig';

export async function isBulletinBlockedByUnpaidFees(params: {
  schoolConfigRepository?: SchoolConfigRepository;
  factureRepository?: FactureRepository;
  schoolId: string;
  studentId: string;
}): Promise<boolean> {
  if (!params.schoolConfigRepository || !params.factureRepository) return false;
  const config = await params.schoolConfigRepository.findBySchoolId(params.schoolId);
  if (!config?.bulletinBlockOnUnpaidFees) return false;
  return params.factureRepository.aFactureImpayeeBloquante(params.studentId);
}

export async function filterParentReportCardsByUnpaidFees(params: {
  schoolConfigRepository?: SchoolConfigRepository;
  factureRepository?: FactureRepository;
  schoolId: string;
  reportCards: Record<string, unknown>[];
}): Promise<{ blockedAll: boolean; filtered: Record<string, unknown>[] }> {
  if (!params.schoolConfigRepository || !params.factureRepository || params.reportCards.length === 0) {
    return { blockedAll: false, filtered: params.reportCards };
  }
  const config = await params.schoolConfigRepository.findBySchoolId(params.schoolId);
  if (!config?.bulletinBlockOnUnpaidFees) {
    return { blockedAll: false, filtered: params.reportCards };
  }

  const blockedCache = new Map<string, boolean>();
  const filtered: Record<string, unknown>[] = [];
  for (const rc of params.reportCards) {
    const sid = typeof rc.studentId === 'string' ? rc.studentId : '';
    if (!sid) {
      filtered.push(rc);
      continue;
    }
    let blocked = blockedCache.get(sid);
    if (blocked === undefined) {
      blocked = await params.factureRepository.aFactureImpayeeBloquante(sid);
      blockedCache.set(sid, blocked);
    }
    if (!blocked) filtered.push(rc);
  }
  return { blockedAll: filtered.length === 0, filtered };
}

export async function renderReportCardPdfBuffer(
  reportCard: BulletinExportData,
  schoolId: string,
  role: string,
  cachedSettings?: Awaited<ReturnType<typeof getEffectiveSchoolSettings>>,
  measuredDeps?: {
    bulletinRenderer?: BulletinRendererPort;
    templateSpecRepository?: BulletinTemplateSpecRepository;
    fileStorage?: FileStoragePort;
    forceRegenerateFromSnapshot?: boolean;
    persistRegeneratedPdf?: boolean;
  },
): Promise<{ pdfBuffer: Buffer; filename: string; studentName: string }> {
  const inlineSettings =
    reportCard.school && 'schoolSettings' in reportCard.school
      ? {
          schoolName: reportCard.school.name,
          schoolMotto: reportCard.school.schoolSettings?.schoolMotto ?? reportCard.school.identityKit?.mottoFr ?? '',
          schoolLogoUrl: reportCard.school.logoUrl ?? '',
        }
      : null;
  const settings = cachedSettings ?? inlineSettings ?? (await getEffectiveSchoolSettings(schoolId));
  const verifyBase = resolvePublicVerifyBaseUrl();
  const studentName = `${reportCard.student.firstName} ${reportCard.student.lastName}`.trim();
  const periodName = reportCard.academicPeriod?.name ?? '—';
  const template = (reportCard.template ?? 'FR_SECONDARY') as BulletinTemplate;
  const sectionCode =
    reportCard.section?.code ??
    reportCard.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class?.section?.code ??
    null;
  const langue = resolveLanguage(reportCard.school?.subsystem, sectionCode);
  const filename = `bulletin-${studentName.replace(/\s+/g, '-')}-${periodName.replace(/\s+/g, '-')}.pdf`;

  const sealedBuffer = await getOrRegenerateSealedBulletinPdf({
    reportCard,
    role,
    language: langue,
    verifyBaseUrl: verifyBase,
    schoolMotto: settings.schoolMotto,
    forceRegenerateFromSnapshot: measuredDeps?.forceRegenerateFromSnapshot,
    persistRegeneratedPdf: measuredDeps?.persistRegeneratedPdf,
    bulletinRenderer: measuredDeps?.bulletinRenderer,
    templateSpecRepository: measuredDeps?.templateSpecRepository,
    fileStorage: measuredDeps?.fileStorage,
  });
  if (sealedBuffer) {
    return { pdfBuffer: sealedBuffer, filename, studentName };
  }

  const pdfBuffer = await generateBulletinPdf(template, {
    schoolName: settings.schoolName ?? reportCard.school?.name ?? 'École',
    schoolMotto: settings.schoolMotto ?? '',
    logoUrl: settings.schoolLogoUrl ?? undefined,
    studentName,
    className: reportCard.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class?.name ?? '—',
    periodName,
    yearName: reportCard.academicYear?.name ?? '—',
    generalAverage: reportCard.generalAverage ?? 0,
    rank: reportCard.rank,
    totalStudents: reportCard.totalStudents,
    absenceCount: reportCard.absenceCount,
    language: langue,
    mention: reportCard.mention ?? getMention(reportCard.generalAverage ?? 0, template, langue),
    classMasterComment: reportCard.classMasterComment,
    subjectLines: reportCard.subjectLines.map((line) => ({
      subjectName: line.subjectName,
      coefficient: line.coefficient,
      seq1Score: line.seq1Score,
      seq2Score: line.seq2Score,
      compositionScore: line.compositionScore,
      seq3Score: line.seq3Score,
      seq4Score: line.seq4Score,
      seq5Score: line.seq5Score,
      seq6Score: line.seq6Score,
      classTestScore: line.classTestScore,
      terminalExamScore: line.terminalExamScore,
      theoreticalScore: line.theoreticalScore,
      practicalScore: line.practicalScore,
      professionalAttitude: line.professionalAttitude,
      oralScore: line.oralScore,
      selfDevelopmentScore: line.selfDevelopmentScore,
      subjectAverage: line.subjectAverage,
      weightedScore: line.weightedScore,
      teacherComment: line.teacherComment,
      competenceLabel: line.competenceLabel,
    })),
    isOfficial: role !== 'PARENT',
    verifyUrl: reportCard.verifyToken
      ? buildLongTokenVerifyUrl(verifyBase, reportCard.verifyToken)
      : `${verifyBase}/verify/${reportCard.id}`,
  });

  return { pdfBuffer, filename, studentName };
}

export function extractCommentPromptMetrics(
  previousAvg: number | null | undefined,
  currentAvg: number | null | undefined,
  lignesMatiereRaw: unknown,
): { evolution: 'HAUSSE' | 'BAISSE' | 'STABLE'; pointsForts: string[]; pointsFaibles: string[] } {
  let evolution: 'HAUSSE' | 'BAISSE' | 'STABLE' = 'STABLE';
  if (previousAvg != null && currentAvg != null) {
    const diff = currentAvg - previousAvg;
    evolution = diff > 0.5 ? 'HAUSSE' : diff < -0.5 ? 'BAISSE' : 'STABLE';
  }
  const lines = (lignesMatiereRaw as { subjectName: string; subjectAverage: number | null }[]) ?? [];
  const pointsForts = lines.filter((s) => (s.subjectAverage ?? 0) >= 14).map((s) => s.subjectName).slice(0, 3);
  const pointsFaibles = lines.filter((s) => (s.subjectAverage ?? 0) < 10).map((s) => s.subjectName).slice(0, 3);
  return { evolution, pointsForts, pointsFaibles };
}

export async function addClassMasterCommentOp(params: {
  bulletinId: string;
  schoolId: string;
  userId: string;
  role: string;
  classMasterComment: unknown;
  bulletinRepository: BulletinRepository;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (typeof params.classMasterComment !== 'string' || !params.classMasterComment.trim()) {
    return { status: 400, body: { success: false, message: 'classMasterComment (string non vide) requis' } };
  }
  const ctx = await params.bulletinRepository.findWithClasseContext(params.bulletinId, params.schoolId);
  if (!ctx) return { status: 404, body: { success: false, message: 'Bulletin introuvable' } };
  if (params.role !== 'ADMIN' && ctx.professorPrincipalId !== params.userId) {
    return {
      status: 403,
      body: { success: false, message: 'Seul le Professeur Principal de cette classe ou un Admin peut écrire ce commentaire' },
    };
  }
  await params.bulletinRepository.updateClassMasterComment(params.bulletinId, params.classMasterComment.trim());
  return { status: 200, body: { success: true, message: 'Commentaire enregistré' } };
}

export async function generateBulletinAiCommentOp(params: {
  bulletinId: string;
  schoolId: string;
  userId: string;
  role: string;
  bulletinRepository: BulletinRepository;
  iaService: IAService;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const enriched = await params.bulletinRepository.findEnrichedById(params.bulletinId, params.schoolId);
  if (!enriched) return { status: 404, body: { success: false, message: 'Bulletin introuvable' } };
  if (params.role !== 'ADMIN' && enriched.professorPrincipalId !== params.userId) {
    return {
      status: 403,
      body: { success: false, message: 'Seul le Professeur Principal de cette classe ou un Admin peut générer ce commentaire' },
    };
  }
  const reportCard = enriched.bulletin;
  const previous = await params.bulletinRepository.findPreviousByStudent(reportCard.studentId, params.schoolId, reportCard.id);
  const { evolution, pointsForts, pointsFaibles } = extractCommentPromptMetrics(
    previous?.generalAverage,
    reportCard.generalAverage,
    reportCard.lignesMatiere,
  );
  const langue = resolveLanguage(enriched.schoolSubsystem, enriched.sectionCode);
  const nomEleve = `${enriched.studentFirstName ?? ''} ${enriched.studentLastName ?? ''}`.trim();
  const comment = await params.iaService.genererCommentaireBulletin({
    nomEleve,
    moyenneGenerale: reportCard.generalAverage ?? 0,
    evolution,
    pointsForts,
    pointsFaibles,
    langue: langue.toUpperCase() as 'FR' | 'EN',
  });
  await params.bulletinRepository.updateAiComment(reportCard.id, comment);
  return { status: 200, body: { success: true, comment } };
}
