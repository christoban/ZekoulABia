/**
 * APPLICATION LAYER — Cycle de vie du PDF scellé des bulletins
 *
 * Responsabilités :
 * - Vérifier l'éligibilité au renderer mesuré (flag SchoolConfig.useMeasuredBulletinRenderer + spec publiée).
 * - Rendre et stocker le PDF figé lors de la génération / validation / publication (avec cache médias par lot).
 * - Au téléchargement : servir le PDF stocké ; s'il est absent du stockage, le régénérer
 *   exclusivement depuis snapshotData + spec figée (templateSpecId + templateVersion), jamais
 *   depuis les données vivantes, puis le re-stocker.
 */
import type { BulletinExportData, BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinTemplateAssignmentRepository } from '@domain/ports/repositories/BulletinTemplateAssignmentRepository';
import type { BulletinTemplateSpecRepository } from '@domain/ports/repositories/BulletinTemplateSpecRepository';
import type { SchoolConfigData, SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import { resolveStudentPhotoBuffer } from '@application/student/studentPhotoService';
import { readSealedBulletinPdf, storeSealedBulletinPdf } from './bulletinStorageHelpers';
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
import {
  buildLongTokenVerifyUrl,
  deriveShortVerifyCode,
} from '@domain/policies/BulletinVerifyCrypto';
import {
  findDefaultSpecForTemplate,
  getPublishedTemplateSpec,
  hydrateTemplateSpecsFromStore,
  isSpecValidatedForProduction,
} from '@domain/templates/bulletinCatalog';
import { resolveLanguage } from '@domain/policies/LanguagePolicy';
import { decodeBase64PhotoUrl, resoudreVerifyBaseUrl } from './bulletinEnrichmentHelpers';
import {
  buildSchoolIdentityRenderContext,
  cleanOptionalText,
  createBatchSchoolIdentityContextCache,
} from './bulletinIdentityContext';

export { buildSchoolIdentityRenderContext, createBatchSchoolIdentityContextCache };

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
  templateSpecRepository?: BulletinTemplateSpecRepository;
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
  if (useMeasured && resolved.templateSpecId && params.templateSpecRepository) {
    await ensureSpecHydratedFromRepository(
      resolved.templateSpecId,
      resolved.templateVersion,
      params.templateSpecRepository,
    );
  }
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

export async function ensureSpecHydratedFromRepository(
  templateSpecId?: string | null,
  templateVersion?: number,
  templateSpecRepository?: BulletinTemplateSpecRepository,
): Promise<void> {
  if (!templateSpecId || !templateSpecRepository) return;
  const version = templateVersion ?? 1;
  if (getPublishedTemplateSpec(templateSpecId, version)) return;
  const stored = await templateSpecRepository.findBySpecAndVersion(templateSpecId, version);
  if (stored) hydrateTemplateSpecsFromStore([stored]);
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
    if (exact) {
      return isSpecValidatedForProduction(exact) ? exact : null;
    }
  }
  return findDefaultSpecForTemplate(params.template);
}

export function buildRenderOptionsForExport(
  reportCard: BulletinExportData,
  params: {
    role: string;
    language: 'fr' | 'en';
    verifyBaseUrl: string;
    schoolMotto?: string | null;
    schoolIdentity?: SchoolIdentityRenderContext;
    studentPhotoBuffer?: Buffer | null;
  },
): BulletinRenderOptions {
  const cls = reportCard.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class;
  const studentPhotoBuffer =
    params.studentPhotoBuffer !== undefined
      ? params.studentPhotoBuffer
      : decodeBase64PhotoUrl(reportCard.student?.studentProfile?.photoUrl);
  const verifyToken = reportCard.verifyToken ?? undefined;
  const shortVerifyCode =
    reportCard.shortVerifyCode ?? (verifyToken ? deriveShortVerifyCode(verifyToken) : undefined);
  const verifyUrl = verifyToken
    ? buildLongTokenVerifyUrl(params.verifyBaseUrl, verifyToken)
    : `${params.verifyBaseUrl.trim().replace(/\/+$/, '')}/verify/${reportCard.id}`;
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
      cleanOptionalText(isEn ? (kit?.mottoEn ?? kit?.mottoFr) : (kit?.mottoFr ?? kit?.mottoEn)) ??
      cleanOptionalText(params.schoolMotto) ??
      cleanOptionalText(reportCard.school?.schoolSettings?.schoolMotto),
    regionalDelegation: cleanOptionalText(isEn ? (kit?.regionalDelegationEn ?? kit?.regionalDelegationFr) : (kit?.regionalDelegationFr ?? kit?.regionalDelegationEn)),
    departmentalDelegation: cleanOptionalText(isEn ? (kit?.departmentalDelegationEn ?? kit?.departmentalDelegationFr) : (kit?.departmentalDelegationFr ?? kit?.departmentalDelegationEn)),
    city: cleanOptionalText(kit?.city) ?? cleanOptionalText(reportCard.school?.city),
    phone: cleanOptionalText(kit?.phone) ?? cleanOptionalText(reportCard.school?.phone),
    bp: cleanOptionalText(kit?.poBox),
    foundingYear: kit?.foundingYear ?? null,
    authorizationNumber: cleanOptionalText(kit?.authorizationNumber),
    accentColor: cleanOptionalText(kit?.accentColor),
    coatOfArmsEnabled: kit?.useCoatOfArms ?? false,
    logoUrl: cleanOptionalText(reportCard.school?.logoUrl),
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
    verifyBaseUrl: params.verifyBaseUrl,
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
  schoolConfigRepository?: SchoolConfigRepository;
  templateSpecRepository?: BulletinTemplateSpecRepository;
  fileStorage?: FileStoragePort;
  verifyBaseUrl?: string;
}): Promise<{ sealedCount: number }> {
  if (!params.bulletinRenderer || !params.fileStorage) {
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

  const firstSchool = rows[0]?.school;
  const batchIdentityCache = createBatchSchoolIdentityContextCache({
    schoolId: params.schoolId,
    schoolName: firstSchool?.name ?? 'Établissement',
    fallbackMotto: firstSchool?.schoolSettings?.schoolMotto,
    fallbackCity: firstSchool?.city,
    fallbackPhone: firstSchool?.phone,
    fallbackLogoUrl: firstSchool?.logoUrl,
    kit: firstSchool?.identityKit,
    fileStorage: params.fileStorage,
  });

  const verifyBaseUrl = params.verifyBaseUrl ?? resoudreVerifyBaseUrl();
  let sealedCount = 0;

  for (const row of rows) {
    const useMeasured =
      schoolConfig?.useMeasuredBulletinRenderer ?? row.school?.schoolConfig?.useMeasuredBulletinRenderer ?? false;
    if (useMeasured && row.templateSpecId) {
      await ensureSpecHydratedFromRepository(row.templateSpecId, row.templateVersion ?? 1, params.templateSpecRepository);
    }
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
    const schoolIdentity = await batchIdentityCache.getForLanguage(language);
    const resolvedPhoto = await resolveStudentPhotoBuffer({
      photoUrl: row.student?.studentProfile?.photoUrl,
      schoolId: params.schoolId,
      fileStorage: params.fileStorage,
    });
    const options = buildRenderOptionsForExport(row, {
      role: 'ADMIN',
      language,
      verifyBaseUrl,
      schoolIdentity,
      studentPhotoBuffer: resolvedPhoto?.buffer ?? null,
    });

    const pdfBuffer = await params.bulletinRenderer.render(row.snapshotData, spec, options);
    const storedKey = await storeSealedBulletinPdf({
      fileStorage: params.fileStorage,
      schoolId: params.schoolId,
      academicPeriodId: params.academicPeriodId,
      bulletinId: row.id,
      templateVersion: spec.version,
      pdfBuffer,
    });
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
  persistRegeneratedPdf?: boolean;
  bulletinRenderer?: BulletinRendererPort;
  templateSpecRepository?: BulletinTemplateSpecRepository;
  fileStorage?: FileStoragePort;
}): Promise<Buffer | null> {
  const useMeasured = params.reportCard.school?.schoolConfig?.useMeasuredBulletinRenderer === true;
  if (useMeasured && params.reportCard.templateSpecId) {
    await ensureSpecHydratedFromRepository(
      params.reportCard.templateSpecId,
      params.reportCard.templateVersion ?? 1,
      params.templateSpecRepository,
    );
  }
  const spec = resolveActiveSpecForBulletin({
    useMeasuredBulletinRenderer: useMeasured,
    template: (params.reportCard.template ?? 'FR_SECONDARY') as BulletinTemplate,
    templateSpecId: params.reportCard.templateSpecId,
    templateVersion: params.reportCard.templateVersion ?? 1,
  });

  if (!spec || !params.bulletinRenderer || !isStudentBulletinSnapshot(params.reportCard.snapshotData)) {
    return null;
  }

  if (!params.forceRegenerateFromSnapshot && params.fileStorage && params.reportCard.pdfUrl) {
    const cached = await readSealedBulletinPdf({
      fileStorage: params.fileStorage,
      pdfUrl: params.reportCard.pdfUrl,
      schoolId: params.reportCard.schoolId,
    });
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  const schoolIdentity = await buildSchoolIdentityRenderContext({
    schoolId: params.reportCard.schoolId,
    schoolName: params.reportCard.school?.name ?? 'Établissement',
    language: params.language,
    fallbackMotto: params.schoolMotto ?? params.reportCard.school?.schoolSettings?.schoolMotto,
    fallbackCity: params.reportCard.school?.city,
    fallbackPhone: params.reportCard.school?.phone,
    fallbackLogoUrl: params.reportCard.school?.logoUrl,
    kit: params.reportCard.school?.identityKit,
    fileStorage: params.fileStorage,
  });
  const resolvedPhoto = await resolveStudentPhotoBuffer({
    photoUrl: params.reportCard.student?.studentProfile?.photoUrl,
    schoolId: params.reportCard.schoolId,
    fileStorage: params.fileStorage,
  });
  const options = buildRenderOptionsForExport(params.reportCard, {
    role: params.role,
    language: params.language,
    verifyBaseUrl: params.verifyBaseUrl,
    schoolMotto: params.schoolMotto,
    schoolIdentity,
    studentPhotoBuffer: resolvedPhoto?.buffer ?? null,
  });
  const pdfBuffer = await params.bulletinRenderer.render(params.reportCard.snapshotData, spec, options);

  if (params.fileStorage && (!params.forceRegenerateFromSnapshot || params.persistRegeneratedPdf)) {
    await storeSealedBulletinPdf({
      fileStorage: params.fileStorage,
      schoolId: params.reportCard.schoolId,
      academicPeriodId: params.reportCard.academicPeriodId,
      bulletinId: params.reportCard.id,
      templateVersion: spec.version,
      existingKey: params.reportCard.pdfUrl,
      pdfBuffer,
    });
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
  schoolIdentity?: SchoolIdentityRenderContext;
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
  fileStorage?: FileStoragePort;
}): Promise<string | null> {
  if (!params.spec || !params.bulletinRenderer) return null;
  const resolvedPhoto = await resolveStudentPhotoBuffer({
    photoUrl: params.studentPhotoUrl,
    schoolId: params.schoolId,
    fileStorage: params.fileStorage,
  });
  const studentPhotoBuffer = resolvedPhoto?.buffer ?? null;
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
    school: params.schoolIdentity ?? {
      schoolName: params.school.name,
      schoolMotto: cleanOptionalText(params.schoolMotto),
      city: cleanOptionalText(params.school.city),
      phone: cleanOptionalText(params.school.phone),
      regionalDelegation: null,
      logoUrl: cleanOptionalText(params.school.logoUrl),
    },
  };
  const pdfBuffer = await params.bulletinRenderer.render(params.snapshot, params.spec, options);
  if (!params.fileStorage) return null;
  return storeSealedBulletinPdf({
    fileStorage: params.fileStorage,
    schoolId: params.schoolId,
    academicPeriodId: params.academicPeriodId,
    bulletinId: params.bulletinId,
    templateVersion: params.spec.version,
    pdfBuffer,
  });
}
