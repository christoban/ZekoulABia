import type { BulletinTemplate } from '@domain/types/enums';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { BulletinExportData } from '@domain/ports/repositories/BulletinRepository';
import { resolveLanguage } from '@domain/policies/LanguagePolicy';
import { generateBulletinPdf } from '@infrastructure/pdf/report-card/index';
import { getMention } from '@infrastructure/pdf/report-card/BulletinPdfHelpers';
import { getEffectiveSchoolSettings } from '@infrastructure/services/school-settings/SchoolSettingsService';
import { resolveFrontendUrl } from '@infrastructure/config/EnvAppConfig';

const VERIFY_BASE = resolveFrontendUrl();

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
): Promise<{ pdfBuffer: Buffer; filename: string; studentName: string }> {
  const settings = cachedSettings ?? (await getEffectiveSchoolSettings(schoolId));
  const studentName = `${reportCard.student.firstName} ${reportCard.student.lastName}`.trim();
  const periodName = reportCard.academicPeriod?.name ?? '—';
  const template = (reportCard.template ?? 'FR_SECONDARY') as BulletinTemplate;
  const sectionCode =
    reportCard.section?.code ??
    reportCard.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class?.section?.code ??
    null;
  const langue = resolveLanguage(reportCard.school?.subsystem, sectionCode);

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
    verifyUrl: `${VERIFY_BASE}/verify/${reportCard.id}`,
  });

  const filename = `bulletin-${studentName.replace(/\s+/g, '-')}-${periodName.replace(/\s+/g, '-')}.pdf`;
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
