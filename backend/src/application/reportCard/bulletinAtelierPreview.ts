/**
 * APPLICATION LAYER — Génération d'aperçu PDF sur élève fictif pour l'Atelier Master & l'aperçu Admin.
 */
import type { SchoolAssetStoragePort } from '@domain/ports/services/SchoolAssetStoragePort';
import type { SchoolIdentityKitRecord } from '@domain/ports/repositories/SchoolIdentityKitRepository';
import type { BulletinRendererPort } from '@domain/ports/services/BulletinRendererPort';
import type { BulletinTemplateSpec, CouncilDecisionBlockSpec } from '@domain/types/bulletinTemplateSpec';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import { buildLongTokenVerifyUrl, deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';
import { resolveCouncilDistinctions } from '@domain/services/bulletin/bulletinCouncilPolicy';
import { createBatchSchoolIdentityContextCache } from './bulletinIdentityContext';
import { calculerMentionBulletin, resoudreVerifyBaseUrl } from './bulletinEnrichmentHelpers';
import {
  PREVIEW_FOCUS_STUDENT_ID,
  buildFictitiousPreviewClass,
  type PreviewFamilyKind,
} from './bulletinPreviewFictitiousClass';

const PREVIEW_VERIFY_TOKEN = 'aabbccddeeff00112233445566778899aabbccddeeff0011';

function resolvePreviewKind(spec: BulletinTemplateSpec): PreviewFamilyKind {
  if (spec.layoutVariant === 'PRIMARY_POINTS_RATIO' || spec.familyKey === 'F') return 'PRIMARY';
  if (spec.layoutVariant === 'ANNUAL_BILINGUAL' || spec.familyKey === 'D') return 'ANNUAL';
  if (spec.layoutVariant === 'TECHNICAL_GROUPED' || spec.familyKey === 'B') return 'TECH';
  if (spec.layoutVariant === 'BILINGUAL_APC' || spec.familyKey === 'C') return 'APC';
  if (spec.language === 'en') return 'EN';
  return 'GENERAL';
}

function buildPreviewInputsForFamily(spec: BulletinTemplateSpec, passThresholdOn20: number) {
  const kind = resolvePreviewKind(spec);
  const isEn = spec.language === 'en';
  const res = buildFictitiousPreviewClass({ spec, kind, passThresholdOn20 });
  const labels: Record<PreviewFamilyKind, { className: string; periodName: string }> = {
    PRIMARY: { className: isEn ? 'Class V (Sample)' : 'Class V (Spécimen)', periodName: isEn ? 'Month 2 — Term 1' : 'Mois 2 — Trimestre 1' },
    ANNUAL: { className: '1ère A4 (Spécimen)', periodName: 'Annuel' },
    TECH: { className: '2nde F3 (Spécimen)', periodName: 'Trimestre 1' },
    APC: { className: '2nde C (Spécimen)', periodName: 'Trimestre 2' },
    EN: { className: 'Form 4 Science (Sample)', periodName: 'Term 1' },
    GENERAL: { className: '3ème (Spécimen)', periodName: 'Trimestre 1' },
  };
  const snapshot = res.snapshotsByStudentId.get(PREVIEW_FOCUS_STUDENT_ID)!;
  return {
    snapshot,
    className: labels[kind].className,
    periodName: labels[kind].periodName,
    yearName: '2026-2027',
    mention: calculerMentionBulletin(snapshot.generalAverage, spec.targetTemplate ?? 'FR_SECONDARY', isEn ? 'en' : 'fr'),
  };
}

export function buildFictitiousPreviewSnapshot(spec: BulletinTemplateSpec, passThresholdOn20 = 10): {
  snapshot: StudentBulletinSnapshot;
  className: string;
  periodName: string;
  yearName: string;
  mention: string;
} {
  const base = buildPreviewInputsForFamily(spec, passThresholdOn20);
  const councilBlock = spec.blocks.find((b): b is CouncilDecisionBlockSpec => b.type === 'councilDecision');
  const isAnnual = spec.layoutVariant === 'ANNUAL_BILINGUAL' || spec.familyKey === 'D';
  const councilDecision = councilBlock
    ? resolveCouncilDistinctions({
        generalAverage: base.snapshot.generalAverage,
        rank: base.snapshot.rank,
        totalStudents: base.snapshot.totalStudents,
        passThresholdOn20,
        thresholds: councilBlock.distinctionThresholds,
        isAnnual,
        promotedToClass: isAnnual ? 'Terminale A4' : null,
        repeatClass: isAnnual ? '1ère A4' : null,
        observations: spec.language === 'en' ? 'Commendable specimen term.' : 'Aperçu spécimen du modèle configuré.',
      })
    : undefined;

  const enriched: StudentBulletinSnapshot = {
    ...base.snapshot,
    mainTeacherName: spec.language === 'en' ? 'Mr CHE Emmanuel (Sample)' : 'Mme ESSOMBA Claire (Fictif)',
    studentIdentity: {
      studentId: PREVIEW_FOCUS_STUDENT_ID,
      fullName: spec.language === 'en' ? 'NDAMUKONG Grace (Sample)' : 'KAMGA Élodie (Élève Fictif)',
      firstName: spec.language === 'en' ? 'Grace' : 'Élodie',
      lastName: spec.language === 'en' ? 'NDAMUKONG' : 'KAMGA',
      matricule: '26-PREVIEW-001',
      dateOfBirth: '2010-05-14T00:00:00.000Z',
      placeOfBirth: 'Garoua',
      gender: 'F',
      isRepeater: false,
      photoUrl: null,
    },
    conduct: {
      justifiedAbsenceHours: 2,
      unjustifiedAbsenceHours: 0,
      totalAbsenceHours: 2,
      trimesterAbsences: { t1: { j: 2, nj: 0 }, t2: { j: 0, nj: 0 }, t3: { j: 0, nj: 0 } },
      workDayPenaltyDays: 0,
      totalAbsenceDays: 0,
      lateCount: 0,
      warningsCount: 0,
      blamesCount: 0,
      exclusionsCount: 0,
      consignesCount: 0,
      sanctions: [],
    },
    councilDecision,
  };
  return { ...base, snapshot: enriched };
}

export async function renderAtelierPreviewPdf(params: {
  schoolName: string;
  fallbackMotto?: string | null;
  fallbackCity?: string | null;
  fallbackPhone?: string | null;
  fallbackLogoUrl?: string | null;
  kit: SchoolIdentityKitRecord | null;
  spec: BulletinTemplateSpec;
  renderer: BulletinRendererPort;
  schoolAssetStorage?: SchoolAssetStoragePort;
  passThresholdOn20?: number | null;
  issuedAt?: Date;
}): Promise<Buffer> {
  const language: 'fr' | 'en' = params.spec.language === 'en' ? 'en' : 'fr';
  const preview = buildFictitiousPreviewSnapshot(params.spec, params.passThresholdOn20 ?? 10);
  const schoolIdentity = await createBatchSchoolIdentityContextCache({
    schoolName: params.schoolName,
    fallbackMotto: params.fallbackMotto,
    fallbackCity: params.fallbackCity,
    fallbackPhone: params.fallbackPhone,
    fallbackLogoUrl: params.fallbackLogoUrl,
    kit: params.kit,
    schoolAssetStorage: params.schoolAssetStorage,
  }).getForLanguage(language);

  const verifyBaseUrl = resoudreVerifyBaseUrl();
  return params.renderer.render(preview.snapshot, params.spec, {
    className: preview.className,
    periodName: preview.periodName,
    yearName: preview.yearName,
    isAnnual: params.spec.layoutVariant === 'ANNUAL_BILINGUAL' || params.spec.targetTemplate === 'ANNUAL',
    mention: preview.mention,
    language,
    isOfficial: true,
    isPreview: true,
    verifyToken: PREVIEW_VERIFY_TOKEN,
    shortVerifyCode: deriveShortVerifyCode(PREVIEW_VERIFY_TOKEN),
    verifyUrl: buildLongTokenVerifyUrl(verifyBaseUrl, PREVIEW_VERIFY_TOKEN),
    verifyBaseUrl,
    school: schoolIdentity,
    issuedAt: params.issuedAt,
  });
}

