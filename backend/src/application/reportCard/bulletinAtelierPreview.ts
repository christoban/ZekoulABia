/**
 * APPLICATION LAYER — Génération d'aperçu PDF sur élève fictif pour l'Atelier Master & l'aperçu Admin.
 */
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
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
    PRIMARY: { className: isEn ? 'Class V (Sample)' : 'CM2 (Spécimen)', periodName: isEn ? 'Month 2 — Term 1' : 'Mois 2 — Trimestre 1' },
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

const LEVEL_TYPICAL_AGE_RULES: ReadonlyArray<{ pattern: RegExp; age: number; month: string; day: string }> = [
  { pattern: /\b(sil|cp|class\s*1|class\s*i)\b/i, age: 6, month: '02', day: '18' },
  { pattern: /\b(ce1|class\s*2|class\s*ii)\b/i, age: 7, month: '04', day: '11' },
  { pattern: /\b(ce2|class\s*3|class\s*iii)\b/i, age: 8, month: '06', day: '22' },
  { pattern: /\b(cm1|class\s*4|class\s*iv)\b/i, age: 9, month: '09', day: '07' },
  { pattern: /\b(cm2|class\s*5|class\s*v)\b/i, age: 11, month: '04', day: '19' },
  { pattern: /\b(class\s*6|class\s*vi|6e|6eme|form\s*1)\b/i, age: 12, month: '03', day: '12' },
  { pattern: /\b(5e|5eme|form\s*2)\b/i, age: 13, month: '07', day: '25' },
  { pattern: /\b(4e|4eme|form\s*3)\b/i, age: 14, month: '10', day: '08' },
  { pattern: /\b(3e|3eme|form\s*4)\b/i, age: 15, month: '05', day: '14' },
  { pattern: /\b(2nde|2nd|seconde|form\s*5)\b/i, age: 16, month: '08', day: '21' },
  { pattern: /\b(1ere|premiere|lower\s*sixth|lss|lsa)\b/i, age: 17, month: '02', day: '27' },
  { pattern: /\b(tle|terminale|upper\s*sixth|uss|usa)\b/i, age: 18, month: '11', day: '09' },
];

/**
 * Calcule une date de naissance fictive réaliste selon le niveau de la classe et l'année scolaire
 * (ex. 2026-2027 : Class V / CM2 -> 2015, 3ème / Form 4 -> 2011, 2nde -> 2010, 1ère -> 2009).
 */
export function computeFictitiousBirthDateForClass(className: string, yearName: string): string {
  const yearMatch = /\b(20\d{2})\b/.exec(yearName);
  const startYear = yearMatch ? Number(yearMatch[1]) : new Date().getUTCFullYear();
  const normalized = className
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const matched = LEVEL_TYPICAL_AGE_RULES.find((r) => r.pattern.test(normalized));
  const age = matched?.age ?? 14;
  const month = matched?.month ?? '05';
  const day = matched?.day ?? '15';
  return `${startYear - age}-${month}-${day}T00:00:00.000Z`;
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
      dateOfBirth: computeFictitiousBirthDateForClass(base.className, base.yearName),
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
  schoolId?: string;
  schoolName: string;
  fallbackMotto?: string | null;
  fallbackCity?: string | null;
  fallbackPhone?: string | null;
  fallbackLogoUrl?: string | null;
  kit: SchoolIdentityKitRecord | null;
  spec: BulletinTemplateSpec;
  renderer: BulletinRendererPort;
  fileStorage?: FileStoragePort;
  passThresholdOn20?: number | null;
  issuedAt?: Date;
}): Promise<Buffer> {
  const language: 'fr' | 'en' = params.spec.language === 'en' ? 'en' : 'fr';
  const preview = buildFictitiousPreviewSnapshot(params.spec, params.passThresholdOn20 ?? 10);
  const schoolIdentity = await createBatchSchoolIdentityContextCache({
    schoolId: params.schoolId,
    schoolName: params.schoolName,
    fallbackMotto: params.fallbackMotto,
    fallbackCity: params.fallbackCity,
    fallbackPhone: params.fallbackPhone,
    fallbackLogoUrl: params.fallbackLogoUrl,
    kit: params.kit,
    fileStorage: params.fileStorage,
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

