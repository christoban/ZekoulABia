/**
 * APPLICATION LAYER — Cycle de vie du PDF scellé des bulletins
 *
 * Responsabilités :
 * - Vérifier l'éligibilité au renderer mesuré (flag SchoolConfig.useMeasuredBulletinRenderer + spec publiée).
 * - Rendre et stocker le PDF figé lors de la génération / validation / publication.
 * - Au téléchargement : servir le PDF stocké ; s'il est absent du stockage, le régénérer
 *   exclusivement depuis snapshotData + spec figée (templateSpecId + templateVersion), jamais
 *   depuis les données vivantes, puis le re-stocker.
 */
import type { BulletinExportData, BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinTemplateAssignmentRepository } from '@domain/ports/repositories/BulletinTemplateAssignmentRepository';
import type { SchoolConfigData, SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { BulletinPdfStoragePort } from '@domain/ports/services/BulletinPdfStoragePort';
import type { SchoolAssetStoragePort } from '@domain/ports/services/SchoolAssetStoragePort';
import type { SchoolIdentityKitRecord } from '@domain/ports/repositories/SchoolIdentityKitRepository';
import type {
  BulletinGradingPolicy,
  BulletinRendererPort,
  BulletinRenderOptions,
  SchoolIdentityRenderContext,
} from '@domain/ports/services/BulletinRendererPort';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type { BulletinTemplateSpec } from '@domain/types/bulletinTemplateSpec';
import type { BulletinGroupingScheme, BulletinTemplate } from '@domain/types/enums';
import {
  resolveEffectiveTemplateAssignment,
  resolvePeriodKindFromName,
} from '@domain/policies/BulletinTemplatePolicy';
import { deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';
import {
  findDefaultSpecForTemplate,
  getPublishedTemplateSpec,
} from '@domain/templates/bulletinCatalog';
import { resolveLanguage } from '@domain/policies/LanguagePolicy';
import { decodeBase64PhotoUrl, resoudreVerifyBaseUrl } from './bulletinEnrichmentHelpers';

export interface ResolvedGenerationRenderPlan {
  template: BulletinTemplate;
  templateSpecId: string | null;
  templateVersion: number;
  groupingScheme: BulletinGroupingScheme;
  useMeasuredRenderer: boolean;
  spec: Readonly<BulletinTemplateSpec> | null;
  passThresholdOn20: number;
  gradingPolicy: BulletinGradingPolicy;
}

export function extractGradingPolicy(config?: Partial<SchoolConfigData> | null): BulletinGradingPolicy {
  return {
    mode: config?.sequenceCalculationMode ?? 'single',
    classTestWeight: config?.classTestWeight ?? undefined,
    terminalExamWeight: config?.terminalExamWeight ?? undefined,
    ds1Weight: config?.ds1Weight ?? undefined,
    ds2Weight: config?.ds2Weight ?? undefined,
    compositionWeight: config?.compositionWeight ?? undefined,
  };
}

export function normalizeSequenceCalculationMode(mode?: string | null): 'single' | 'triple' | 'weighted' {
  if (mode === 'triple' || mode === 'weighted') return mode;
  return 'single';
}

export async function resolveClassGenerationPlan(params: {
  schoolId: string;
  classId: string;
  classLevel: string | null;
  periodName: string;
  requestedTemplate: BulletinTemplate;
  schoolConfigRepository?: SchoolConfigRepository;
  assignmentRepository?: BulletinTemplateAssignmentRepository;
}): Promise<ResolvedGenerationRenderPlan> {
  const schoolConfig = params.schoolConfigRepository
    ? await params.schoolConfigRepository.findBySchoolId(params.schoolId)
    : null;
  const assignments = params.assignmentRepository
    ? await params.assignmentRepository.findBySchool(params.schoolId)
    : [];
  const periodKind = resolvePeriodKindFromName(params.periodName, params.requestedTemplate);
  const resolved = resolveEffectiveTemplateAssignment({
    assignments,
    classId: params.classId,
    classLevel: params.classLevel,
    periodKind,
    defaultTemplate: params.requestedTemplate,
    defaultGroupingScheme: schoolConfig?.bulletinGroupingScheme ?? 'FLAT',
  });
  const useMeasured = schoolConfig?.useMeasuredBulletinRenderer ?? false;
  const spec = resolveActiveSpecForBulletin({
    useMeasuredBulletinRenderer: useMeasured,
    template: resolved.template,
    templateSpecId: resolved.templateSpecId,
    templateVersion: resolved.templateVersion,
  });

  return {
    template: resolved.template,
    templateSpecId: spec ? spec.id : resolved.templateSpecId,
    templateVersion: spec ? spec.version : resolved.templateVersion,
    groupingScheme: resolved.groupingScheme,
    useMeasuredRenderer: spec !== null,
    spec,
    passThresholdOn20: schoolConfig?.passMark ?? 10,
    gradingPolicy: extractGradingPolicy(schoolConfig),
  };
}

export function isStudentBulletinSnapshot(raw: unknown): raw is StudentBulletinSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  return Array.isArray(obj.subjectLines) && typeof obj.generalAverage === 'number' && typeof obj.studentId === 'string';
}

export function resolveActiveSpecForBulletin(params: {
  useMeasuredBulletinRenderer?: boolean;
  template: BulletinTemplate;
  templateSpecId?: string | null;
  templateVersion?: number;
}): Readonly<BulletinTemplateSpec> | null {
  if (!params.useMeasuredBulletinRenderer) return null;
  if (params.templateSpecId) {
    const exact = getPublishedTemplateSpec(params.templateSpecId, params.templateVersion);
    if (exact) return exact;
  }
  return findDefaultSpecForTemplate(params.template);
}

function cleanOpt(val: string | null | undefined): string | null {
  const t = val?.trim();
  return t && t.length > 0 ? t : null;
}

export async function buildSchoolIdentityRenderContext(params: {
  schoolName: string;
  language: 'fr' | 'en';
  fallbackMotto?: string | null;
  fallbackCity?: string | null;
  fallbackPhone?: string | null;
  fallbackLogoUrl?: string | null;
  kit?: SchoolIdentityKitRecord | null;
  schoolAssetStorage?: SchoolAssetStoragePort;
}): Promise<SchoolIdentityRenderContext> {
  const isEn = params.language === 'en';
  const k = params.kit;
  const storage = params.schoolAssetStorage;
  const pick = (fr?: string | null, en?: string | null) =>
    cleanOpt(isEn ? (en ?? fr) : (fr ?? en));

  const [logoBuffer, coatOfArmsBuffer, stampBuffer, principalSignatureBuffer, censorSignatureBuffer] = storage
    ? await Promise.all([
        storage.readAssetBuffer(k?.logoAssetKey ?? params.fallbackLogoUrl),
        k?.useCoatOfArms ? storage.readAssetBuffer(k.coatOfArmsAssetKey) : Promise.resolve(null),
        storage.readAssetBuffer(k?.stampAssetKey),
        storage.readAssetBuffer(k?.principalSignatureAssetKey),
        storage.readAssetBuffer(k?.censorSignatureAssetKey),
      ])
    : [null, null, null, null, null];

  return {
    schoolName: params.schoolName,
    schoolMotto: pick(k?.mottoFr, k?.mottoEn) ?? cleanOpt(params.fallbackMotto),
    regionalDelegation: pick(k?.regionalDelegationFr, k?.regionalDelegationEn),
    departmentalDelegation: pick(k?.departmentalDelegationFr, k?.departmentalDelegationEn),
    city: cleanOpt(k?.city) ?? cleanOpt(params.fallbackCity),
    phone: cleanOpt(k?.phone) ?? cleanOpt(params.fallbackPhone),
    bp: cleanOpt(k?.poBox),
    foundingYear: k?.foundingYear ?? null,
    authorizationNumber: cleanOpt(k?.authorizationNumber),
    accentColor: cleanOpt(k?.accentColor),
    coatOfArmsEnabled: k?.useCoatOfArms ?? false,
    logoUrl: cleanOpt(params.fallbackLogoUrl),
    logoBuffer,
    coatOfArmsBuffer,
    stampBuffer,
    principalSignatureBuffer,
    censorSignatureBuffer,
  };
}

export function buildRenderOptionsForExport(
  reportCard: BulletinExportData,
  params: {
    role: string;
    language: 'fr' | 'en';
    verifyBaseUrl: string;
    schoolMotto?: string | null;
    schoolIdentity?: SchoolIdentityRenderContext;
  },
): BulletinRenderOptions {
  const cls = reportCard.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class;
  const studentPhotoBuffer = decodeBase64PhotoUrl(reportCard.student?.studentProfile?.photoUrl);
  const verifyToken = reportCard.verifyToken ?? undefined;
  const shortVerifyCode =
    reportCard.shortVerifyCode ?? (verifyToken ? deriveShortVerifyCode(verifyToken) : undefined);
  const verifyUrl = verifyToken
    ? `${params.verifyBaseUrl}/verify/${verifyToken}`
    : `${params.verifyBaseUrl}/verify/${reportCard.id}`;
  const reprintCount = reportCard.reprintCount ?? 0;

  const sc = reportCard.school?.schoolConfig;
  const kit = reportCard.school?.identityKit;
  const isEn = params.language === 'en';
  const gradingPolicy: BulletinGradingPolicy = {
    mode: sc?.sequenceCalculationMode ?? 'single',
    classTestWeight: sc?.classTestWeight ?? undefined,
    terminalExamWeight: sc?.terminalExamWeight ?? undefined,
    ds1Weight: sc?.ds1Weight ?? undefined,
    ds2Weight: sc?.ds2Weight ?? undefined,
    compositionWeight: sc?.compositionWeight ?? undefined,
  };

  const defaultSchoolCtx: SchoolIdentityRenderContext = params.schoolIdentity ?? {
    schoolName: reportCard.school?.name ?? 'Établissement',
    schoolMotto:
      cleanOpt(isEn ? (kit?.mottoEn ?? kit?.mottoFr) : (kit?.mottoFr ?? kit?.mottoEn)) ??
      cleanOpt(params.schoolMotto) ??
      cleanOpt(reportCard.school?.schoolSettings?.schoolMotto),
    regionalDelegation: cleanOpt(isEn ? (kit?.regionalDelegationEn ?? kit?.regionalDelegationFr) : (kit?.regionalDelegationFr ?? kit?.regionalDelegationEn)),
    departmentalDelegation: cleanOpt(isEn ? (kit?.departmentalDelegationEn ?? kit?.departmentalDelegationFr) : (kit?.departmentalDelegationFr ?? kit?.departmentalDelegationEn)),
    city: cleanOpt(kit?.city) ?? cleanOpt(reportCard.school?.city),
    phone: cleanOpt(kit?.phone) ?? cleanOpt(reportCard.school?.phone),
    bp: cleanOpt(kit?.poBox),
    foundingYear: kit?.foundingYear ?? null,
    authorizationNumber: cleanOpt(kit?.authorizationNumber),
    accentColor: cleanOpt(kit?.accentColor),
    coatOfArmsEnabled: kit?.useCoatOfArms ?? false,
    logoUrl: cleanOpt(reportCard.school?.logoUrl),
  };

  return {
    className: cls?.name ?? '—',
    periodName: reportCard.academicPeriod?.name ?? '—',
    yearName: reportCard.academicYear?.name ?? '—',
    mention: reportCard.mention ?? '—',
    classMasterComment: reportCard.classMasterComment,
    isOfficial: params.role !== 'PARENT',
    isAnnual: reportCard.template === 'ANNUAL',
    verifyUrl,
    verifyToken,
    shortVerifyCode,
    isDuplicate: reprintCount > 0,
    reprintCount,
    language: params.language,
    studentPhotoBuffer,
    gradingPolicy,
    school: defaultSchoolCtx,
  };
}

export async function sealAndStoreBulletinsForClass(params: {
  classId: string;
  academicPeriodId: string;
  schoolId: string;
  bulletinRepository: BulletinRepository;
  bulletinRenderer?: BulletinRendererPort;
  bulletinPdfStorage?: BulletinPdfStoragePort;
  schoolConfigRepository?: SchoolConfigRepository;
  schoolAssetStorage?: SchoolAssetStoragePort;
  verifyBaseUrl?: string;
}): Promise<{ sealedCount: number }> {
  if (!params.bulletinRenderer || !params.bulletinPdfStorage) {
    return { sealedCount: 0 };
  }

  const schoolConfig = params.schoolConfigRepository
    ? await params.schoolConfigRepository.findBySchoolId(params.schoolId)
    : null;
  const rows = await params.bulletinRepository.findForExport(
    params.schoolId,
    params.academicPeriodId,
    params.classId,
  );
  if (rows.length === 0) return { sealedCount: 0 };

  const verifyBaseUrl = params.verifyBaseUrl ?? resoudreVerifyBaseUrl();
  let sealedCount = 0;

  for (const row of rows) {
    const useMeasured =
      schoolConfig?.useMeasuredBulletinRenderer ?? row.school?.schoolConfig?.useMeasuredBulletinRenderer ?? false;
    const spec = resolveActiveSpecForBulletin({
      useMeasuredBulletinRenderer: useMeasured,
      template: (row.template ?? 'FR_SECONDARY') as BulletinTemplate,
      templateSpecId: row.templateSpecId,
      templateVersion: row.templateVersion ?? 1,
    });
    if (!spec || !isStudentBulletinSnapshot(row.snapshotData)) continue;

    const sectionCode =
      row.section?.code ?? row.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class?.section?.code ?? null;
    const language = resolveLanguage(row.school?.subsystem, sectionCode);
    const schoolIdentity = await buildSchoolIdentityRenderContext({
      schoolName: row.school?.name ?? 'Établissement',
      language,
      fallbackMotto: row.school?.schoolSettings?.schoolMotto,
      fallbackCity: row.school?.city,
      fallbackPhone: row.school?.phone,
      fallbackLogoUrl: row.school?.logoUrl,
      kit: row.school?.identityKit,
      schoolAssetStorage: params.schoolAssetStorage,
    });
    const options = buildRenderOptionsForExport(row, {
      role: 'ADMIN',
      language,
      verifyBaseUrl,
      schoolIdentity,
    });

    const pdfBuffer = await params.bulletinRenderer.render(row.snapshotData, spec, options);
    const storageKey = params.bulletinPdfStorage.buildStorageKey({
      schoolId: params.schoolId,
      academicPeriodId: params.academicPeriodId,
      bulletinId: row.id,
      templateVersion: spec.version,
    });
    const storedKey = await params.bulletinPdfStorage.storePdf(storageKey, pdfBuffer);
    await params.bulletinRepository.updatePdfMetadata(row.id, {
      pdfUrl: storedKey,
      templateSpecId: spec.id,
      templateVersion: spec.version,
    });
    sealedCount++;
  }

  return { sealedCount };
}

export async function getOrRegenerateSealedBulletinPdf(params: {
  reportCard: BulletinExportData;
  role: string;
  language: 'fr' | 'en';
  verifyBaseUrl: string;
  schoolMotto?: string | null;
  forceRegenerateFromSnapshot?: boolean;
  bulletinRenderer?: BulletinRendererPort;
  bulletinPdfStorage?: BulletinPdfStoragePort;
  schoolAssetStorage?: SchoolAssetStoragePort;
}): Promise<Buffer | null> {
  const useMeasured = params.reportCard.school?.schoolConfig?.useMeasuredBulletinRenderer === true;
  const spec = resolveActiveSpecForBulletin({
    useMeasuredBulletinRenderer: useMeasured,
    template: (params.reportCard.template ?? 'FR_SECONDARY') as BulletinTemplate,
    templateSpecId: params.reportCard.templateSpecId,
    templateVersion: params.reportCard.templateVersion ?? 1,
  });

  if (!spec || !params.bulletinRenderer || !isStudentBulletinSnapshot(params.reportCard.snapshotData)) {
    return null;
  }

  if (!params.forceRegenerateFromSnapshot && params.bulletinPdfStorage && params.reportCard.pdfUrl) {
    const cached = await params.bulletinPdfStorage.readPdf(params.reportCard.pdfUrl);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  // PDF absent du stockage ou réédition DUPLICATA : régénération stricte depuis snapshotData + spec figée
  const schoolIdentity = await buildSchoolIdentityRenderContext({
    schoolName: params.reportCard.school?.name ?? 'Établissement',
    language: params.language,
    fallbackMotto: params.schoolMotto ?? params.reportCard.school?.schoolSettings?.schoolMotto,
    fallbackCity: params.reportCard.school?.city,
    fallbackPhone: params.reportCard.school?.phone,
    fallbackLogoUrl: params.reportCard.school?.logoUrl,
    kit: params.reportCard.school?.identityKit,
    schoolAssetStorage: params.schoolAssetStorage,
  });
  const options = buildRenderOptionsForExport(params.reportCard, {
    role: params.role,
    language: params.language,
    verifyBaseUrl: params.verifyBaseUrl,
    schoolMotto: params.schoolMotto,
    schoolIdentity,
  });
  const pdfBuffer = await params.bulletinRenderer.render(params.reportCard.snapshotData, spec, options);

  if (params.bulletinPdfStorage && !params.forceRegenerateFromSnapshot) {
    const key =
      params.reportCard.pdfUrl ||
      params.bulletinPdfStorage.buildStorageKey({
        schoolId: params.reportCard.schoolId,
        academicPeriodId: params.reportCard.academicPeriodId,
        bulletinId: params.reportCard.id,
        templateVersion: spec.version,
      });
    await params.bulletinPdfStorage.storePdf(key, pdfBuffer);
  }

  return pdfBuffer;
}

export async function renderAndStoreBulletinIfSpecActive(params: {
  bulletinId: string;
  schoolId: string;
  academicPeriodId: string;
  snapshot: StudentBulletinSnapshot;
  spec: Readonly<BulletinTemplateSpec> | null;
  school: { name: string; city?: string; phone?: string; region?: string; logoUrl?: string };
  className: string;
  periodName: string;
  yearName: string;
  mention: string;
  classMasterComment?: string | null;
  language: 'fr' | 'en';
  isAnnual?: boolean;
  gradingPolicy?: BulletinGradingPolicy;
  schoolMotto?: string | null;
  verifyUrl: string;
  verifyToken: string;
  shortVerifyCode?: string;
  studentPhotoUrl?: string | null;
  bulletinRenderer?: BulletinRendererPort;
  bulletinPdfStorage?: BulletinPdfStoragePort;
}): Promise<string | null> {
  if (!params.spec || !params.bulletinRenderer) return null;
  const studentPhotoBuffer = decodeBase64PhotoUrl(params.studentPhotoUrl);
  const options: BulletinRenderOptions = {
    className: params.className,
    periodName: params.periodName,
    yearName: params.yearName,
    mention: params.mention,
    classMasterComment: params.classMasterComment,
    isOfficial: true,
    isAnnual: params.isAnnual,
    verifyUrl: params.verifyUrl,
    verifyToken: params.verifyToken,
    shortVerifyCode: params.shortVerifyCode ?? deriveShortVerifyCode(params.verifyToken),
    isDuplicate: false,
    reprintCount: 0,
    language: params.language,
    gradingPolicy: params.gradingPolicy,
    studentPhotoBuffer,
    school: {
      schoolName: params.school.name,
      schoolMotto: cleanOpt(params.schoolMotto),
      city: cleanOpt(params.school.city),
      phone: cleanOpt(params.school.phone),
      regionalDelegation: null,
      logoUrl: cleanOpt(params.school.logoUrl),
    },
  };
  const pdfBuffer = await params.bulletinRenderer.render(params.snapshot, params.spec, options);
  const fallbackKey = `bulletins/${params.schoolId}/${params.bulletinId}.pdf`;
  if (!params.bulletinPdfStorage) return fallbackKey;
  const key = params.bulletinPdfStorage.buildStorageKey({
    schoolId: params.schoolId,
    academicPeriodId: params.academicPeriodId,
    bulletinId: params.bulletinId,
    templateVersion: params.spec.version,
  });
  return params.bulletinPdfStorage.storePdf(key, pdfBuffer);
}
