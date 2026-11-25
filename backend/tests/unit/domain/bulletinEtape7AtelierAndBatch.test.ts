import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { MasterBulletinAtelierController } from '@infrastructure/http/controllers/MasterBulletinAtelierController';
import { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { MAX_SYNC_CLASS_EXPORT_STUDENTS, streamClassReportCardsMergedPdf } from '@infrastructure/http/controllers/helpers/reportCardGenerationOps';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import {
  GENERAL_GROUPED_V1,
  createNewTemplateSpecVersion,
  getPublishedTemplateSpec,
  getTemplateSpecAnyStatus,
  listAllTemplateSpecs,
  registerTemplateSpecVersion,
} from '@domain/templates/bulletinCatalog';
import { School } from '@domain/entities/School';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { genererVerifyToken } from '@application/reportCard/bulletinEnrichmentHelpers';
import type { BulletinTemplateAssignmentRule } from '@domain/policies/BulletinTemplatePolicy';
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { SchoolConfigData, SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { SchoolIdentityKitRecord, SchoolIdentityKitRepository } from '@domain/ports/repositories/SchoolIdentityKitRepository';
import type { BulletinTemplateAssignmentRepository } from '@domain/ports/repositories/BulletinTemplateAssignmentRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import type { BulletinExportData, BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import type { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import type { IAService } from '@domain/ports/services/IAService';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

function createStub<T extends object>(overrides: Partial<T>): T {
  const map = overrides as Record<string, unknown>;
  return new Proxy(map, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return async () => null;
    },
  }) as unknown as T;
}

interface CapturedRes {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: unknown;
  rawBody: Buffer | null;
  res: Response;
}

function createMockRes(): CapturedRes {
  const captured: CapturedRes = {
    statusCode: 200,
    headers: {},
    jsonBody: null,
    rawBody: null,
    res: {} as Response,
  };
  const mock = {
    headersSent: false,
    status(code: number) {
      captured.statusCode = code;
      return mock;
    },
    setHeader(name: string, value: string | number) {
      captured.headers[name.toLowerCase()] = String(value);
      return mock;
    },
    json(payload: unknown) {
      mock.headersSent = true;
      captured.jsonBody = payload;
      return mock;
    },
    end(chunk?: Buffer | string) {
      mock.headersSent = true;
      if (chunk) {
        captured.rawBody = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      }
      return mock;
    },
  };
  captured.res = mock as unknown as Response;
  return captured;
}

function buildKitRecord(schoolId: string, overrides: Partial<SchoolIdentityKitRecord> = {}): SchoolIdentityKitRecord {
  return {
    id: 'kit-1', schoolId, regionalDelegationFr: null, regionalDelegationEn: null,
    departmentalDelegationFr: null, departmentalDelegationEn: null, mottoFr: null, mottoEn: null,
    poBox: null, city: null, phone: null, foundingYear: null, authorizationNumber: null, accentColor: null,
    logoAssetKey: null, coatOfArmsAssetKey: null, stampAssetKey: null, principalSignatureAssetKey: null,
    censorSignatureAssetKey: null, useCoatOfArms: false, updatedById: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

function makeTestSchool(id: string, createdByMasterId: string): School {
  return School.reconstituer({
    id, name: 'Lycée Bilingue Test Étape 7', subdomain: `test-${id}`, status: 'ACTIVE', plan: 'PREMIUM',
    subsystem: 'BILINGUAL', educationType: 'GENERAL', ownership: 'PRIVATE_SECULAR',
    city: 'Yaoundé', phone: '+237600000000', saturdaySchedule: false,
    createdByMasterId, createdAt: new Date(), updatedAt: new Date(),
  });
}

function buildAtelierControllerFixture() {
  const schoolA = makeTestSchool('school-a', 'mgr-1');
  const schoolB = makeTestSchool('school-b', 'mgr-2');
  const schoolsMap = new Map<string, School>([
    ['school-a', schoolA],
    ['school-b', schoolB],
  ]);

  let upsertKitCalls = 0;
  let storedKit: SchoolIdentityKitRecord | null = null;
  let storedCfg: SchoolConfigData = {
    aiAlertsEnabled: false,
    subjectDropThreshold: 8,
    bulletinTemplate: 'FR_SECONDARY',
    bulletinGroupingScheme: 'SCI_LIT_OTHER',
    useMeasuredBulletinRenderer: false,
  };
  const assignments: BulletinTemplateAssignmentRule[] = [];

  const masterQueryRepo = createStub<MasterAdminQueryRepository>({
    async findSchoolBasic(id: string) {
      const s = schoolsMap.get(id);
      if (!s) return null;
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        onboardingConfig: null,
        templateCode: null,
        createdByMasterId: s.createdByMasterId ?? null,
      };
    },
  });
  const schoolRepo = createStub<SchoolRepository>({
    async findById(id: string) {
      return schoolsMap.get(id) ?? null;
    },
  });
  const schoolConfigRepo = createStub<SchoolConfigRepository>({
    async findBySchoolId() {
      return storedCfg;
    },
    async upsertBulletinConfig(_sid, input) {
      storedCfg = { ...storedCfg, ...input };
      return storedCfg;
    },
  });
  const kitRepo = createStub<SchoolIdentityKitRepository>({
    async findBySchoolId() { return storedKit; },
    async upsert(input) {
      upsertKitCalls += 1;
      storedKit = buildKitRecord(input.schoolId, input);
      return storedKit;
    },
  });
  const assignmentRepo = createStub<BulletinTemplateAssignmentRepository>({
    async findBySchool() { return assignments; },
    async save(input) {
      const rule: BulletinTemplateAssignmentRule = {
        id: `assign-${assignments.length + 1}`, schoolId: input.schoolId,
        classLevel: input.classLevel ?? null, classId: input.classId ?? null,
        periodKind: input.periodKind, template: input.template,
        templateSpecId: input.templateSpecId, templateVersion: input.templateVersion ?? 1,
        groupingScheme: input.groupingScheme ?? null, isActive: true,
      };
      assignments.push(rule);
      return rule;
    },
    async delete(id: string) {
      const idx = assignments.findIndex((a) => a.id === id);
      if (idx >= 0) assignments.splice(idx, 1);
    },
  });
  const classeRepo = createStub<ClasseRepository>({ async findBySchool() { return []; } });
  const assetStorage = createStub<FileStoragePort>({ async get() { return null; } });

  const controller = new MasterBulletinAtelierController(
    masterQueryRepo,
    schoolRepo,
    schoolConfigRepo,
    kitRepo,
    assignmentRepo,
    classeRepo,
    new MeasuredPdfKitBulletinRenderer(),
    assetStorage,
  );
  return {
    controller,
    schoolRepo,
    schoolConfigRepo,
    kitRepo,
    assignmentRepo,
    assetStorage,
    getUpsertKitCalls: () => upsertKitCalls,
  };
}

const noopNext: NextFunction = (err?: unknown) => {
  if (err) throw err;
};

describe('Étape 7 — Atelier Master RBAC, versioning DRAFT/PUBLISHED, aperçu fictif & export PDF fusionné', () => {
  it('enforces Master Atelier RBAC for super_admin, school_manager (scoped) and support (read-only)', async () => {
    const fix = buildAtelierControllerFixture();

    const superReq = {
      params: { schoolId: 'school-b' },
      masterUser: { id: 'sa-1', role: 'super_admin', email: 'sa@zekoul.cm', isOwner: true, assignedSchoolIds: [] },
    } as unknown as Request;
    const res1 = createMockRes();
    await fix.controller.getAtelierState(superReq, res1.res, noopNext);
    expect(res1.statusCode).toBe(200);
    expect((res1.jsonBody as { data: { canEdit: boolean } }).data.canEdit).toBe(true);

    const mgrOwnWrite = {
      params: { schoolId: 'school-a' },
      body: { city: 'Douala', useMeasuredBulletinRenderer: true },
      masterUser: { id: 'mgr-1', role: 'school_manager', email: 'm1@zekoul.cm', isOwner: false, assignedSchoolIds: [] },
    } as unknown as Request;
    const res2 = createMockRes();
    await fix.controller.saveIdentityKitAndConfig(mgrOwnWrite, res2.res, noopNext);
    expect(res2.statusCode).toBe(200);

    const mgrOtherReq = {
      params: { schoolId: 'school-b' },
      masterUser: { id: 'mgr-1', role: 'school_manager', email: 'm1@zekoul.cm', isOwner: false, assignedSchoolIds: [] },
    } as unknown as Request;
    const res3 = createMockRes();
    await fix.controller.getAtelierState(mgrOtherReq, res3.res, noopNext);
    expect(res3.statusCode).toBe(403);

    const supportRead = {
      params: { schoolId: 'school-a' },
      masterUser: { id: 'sup-1', role: 'support', email: 'sup@zekoul.cm', isOwner: false, assignedSchoolIds: ['school-a'] },
    } as unknown as Request;
    const res4 = createMockRes();
    await fix.controller.getAtelierState(supportRead, res4.res, noopNext);
    expect(res4.statusCode).toBe(200);
    expect((res4.jsonBody as { data: { canEdit: boolean } }).data.canEdit).toBe(false);

    const supportWrite = {
      params: { schoolId: 'school-a' },
      body: { city: 'Hack' },
      masterUser: { id: 'sup-1', role: 'support', email: 'sup@zekoul.cm', isOwner: false, assignedSchoolIds: ['school-a'] },
    } as unknown as Request;
    const res5 = createMockRes();
    await fix.controller.saveIdentityKitAndConfig(supportWrite, res5.res, noopNext);
    expect(res5.statusCode).toBe(403);
  });

  it('keeps DRAFT spec versions isolated from published catalog & preserves v1 immutability when publishing v2', async () => {
    const fix = buildAtelierControllerFixture();
    const specId = `TEST_ETAPE7_SPEC_${Date.now()}`;
    const v1 = { ...structuredClone(GENERAL_GROUPED_V1), id: specId, version: 1, status: 'PUBLISHED' as const };
    registerTemplateSpecVersion(v1);

    const draftReq = {
      params: { schoolId: 'school-a' },
      body: { baseSpecId: specId, name: 'Brouillon v2', publish: false, language: 'en' },
      masterUser: { id: 'sa-1', role: 'super_admin', email: 'sa@zekoul.cm', isOwner: true, assignedSchoolIds: [] },
    } as unknown as Request;
    const draftRes = createMockRes();
    await fix.controller.createSpecVersion(draftReq, draftRes.res, noopNext);
    expect(draftRes.statusCode).toBe(201);
    const createdV2 = (draftRes.jsonBody as { data: { spec: { version: number; status: string } } }).data.spec;
    expect(createdV2.version).toBe(2);
    expect(createdV2.status).toBe('DRAFT');

    // Published getter still resolves v1, not v2 DRAFT
    expect(getPublishedTemplateSpec(specId)?.version).toBe(1);
    expect(getTemplateSpecAnyStatus(specId, 2)?.status).toBe('DRAFT');
    expect(listAllTemplateSpecs({ includeDrafts: true }).some((s) => s.id === specId && s.version === 2)).toBe(true);

    // Assigning a DRAFT version must fail with 400
    const badAssignReq = {
      params: { schoolId: 'school-a' },
      body: { templateSpecId: specId, templateVersion: 2, periodKind: 'TRIMESTER' },
      masterUser: { id: 'sa-1', role: 'super_admin', email: 'sa@zekoul.cm', isOwner: true, assignedSchoolIds: [] },
    } as unknown as Request;
    const badAssignRes = createMockRes();
    await fix.controller.saveAssignment(badAssignReq, badAssignRes.res, noopNext);
    expect(badAssignRes.statusCode).toBe(400);

    // Publishing creates v3 PUBLISHED while v1 stays unchanged for sealed bulletins
    const pubV3 = createNewTemplateSpecVersion(v1, { name: 'Publiée v3', publish: true });
    registerTemplateSpecVersion(pubV3);
    expect(pubV3.version).toBe(3);
    expect(getPublishedTemplateSpec(specId)?.version).toBe(3);
    expect(getPublishedTemplateSpec(specId, 1)?.name).toBe(v1.name);
  });

  it('renders Master live preview PDF and Admin read-only template preview (JSON & PDF) on fictitious student without DB writes', async () => {
    const fix = buildAtelierControllerFixture();

    const masterPreviewReq = {
      params: { schoolId: 'school-a' },
      body: {
        templateSpecId: GENERAL_GROUPED_V1.id,
        templateVersion: 1,
        draftOverrides: { periodLabelMode: 'SEQUENCE', appreciationScale: 'NUMERIC_COMPETENCE' },
        kitOverrides: { regionalDelegationFr: 'DÉLÉGATION TEST ATELIER' },
      },
      masterUser: { id: 'sup-1', role: 'support', email: 'sup@zekoul.cm', isOwner: false, assignedSchoolIds: ['school-a'] },
    } as unknown as Request;
    const masterPreviewRes = createMockRes();
    await fix.controller.previewPdf(masterPreviewReq, masterPreviewRes.res, noopNext);
    expect(masterPreviewRes.statusCode).toBe(200);
    expect(masterPreviewRes.headers['content-type']).toBe('application/pdf');
    expect(masterPreviewRes.rawBody?.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(fix.getUpsertKitCalls()).toBe(0);

    const adminController = new ReportCardController(
      createStub<GenererBulletinUseCase>({}),
      createStub<EnvoyerBulletinsUseCase>({}),
      createStub<IAService>({}),
      fix.schoolRepo,
      createStub<ClasseRepository>({}),
      createStub<AnneeAcademiqueRepository>({}),
      createStub<SectionRepository>({}),
      createStub<BulletinRepository>({}),
      createStub<ParentRepository>({}),
      createStub<AIActionAuditPort>({}),
      undefined,
      undefined,
      undefined,
      fix.schoolConfigRepo,
      new MeasuredPdfKitBulletinRenderer(),
      fix.assetStorage,
      fix.assignmentRepo,
      fix.kitRepo,
    );

    const adminJsonReq = {
      user: { userId: 'adm-1', schoolId: 'school-a', role: 'ADMIN' },
      query: {},
    } as unknown as Request;
    const adminJsonRes = createMockRes();
    await adminController.previsualiserModeleOfficiel(adminJsonReq, adminJsonRes.res, noopNext);
    expect(adminJsonRes.statusCode).toBe(200);
    const jsonData = (adminJsonRes.jsonBody as { data: { activeSpec: { id: string } } }).data;
    expect(jsonData.activeSpec.id).toBe(GENERAL_GROUPED_V1.id);

    const adminPdfReq = {
      user: { userId: 'adm-1', schoolId: 'school-a', role: 'ADMIN' },
      query: { format: 'pdf' },
    } as unknown as Request;
    const adminPdfRes = createMockRes();
    await adminController.previsualiserModeleOfficiel(adminPdfReq, adminPdfRes.res, noopNext);
    expect(adminPdfRes.statusCode).toBe(200);
    expect(adminPdfRes.headers['content-type']).toBe('application/pdf');
    expect(adminPdfRes.rawBody?.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('merges a whole class into a single multi-page PDF and caches identity assets once per batch', async () => {
    const preview1 = buildFictitiousPreviewSnapshot(GENERAL_GROUPED_V1);
    const preview2 = buildFictitiousPreviewSnapshot(GENERAL_GROUPED_V1);
    let readAssetCalls = 0;

    // Tiny valid 1x1 PNG buffer
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const cachedAssetStorage = createStub<FileStoragePort>({
      async get(key: string) {
        readAssetCalls += 1;
        return { buffer: tinyPng, contentType: 'image/png' };
      },
    });

    const baseExportRow = (id: string, snap: typeof preview1.snapshot): BulletinExportData => ({
      id, schoolId: 'school-a', studentId: `stu-${id}`, academicYearId: 'yr-1', academicPeriodId: 'per-1',
      template: 'FR_SECONDARY', templateSpecId: GENERAL_GROUPED_V1.id, templateVersion: 1,
      snapshotData: snap, verifyToken: genererVerifyToken(), shortVerifyCode: 'ZK-TEST-7777',
      reprintCount: 0, generalAverage: snap.generalAverage, rank: snap.rank, totalStudents: snap.totalStudents,
      absenceCount: 0, mention: 'Bien', classMasterComment: 'Bon travail',
      academicYear: { id: 'yr-1', name: '2026-2027' }, academicPeriod: { id: 'per-1', name: 'Trimestre 1' },
      student: {
        id: `stu-${id}`, firstName: id === 'rc-1' ? 'Alice' : 'Bruno', lastName: 'Ndongo',
        studentProfile: {
          matricule: `MAT-${id}`,
          enrollmentsYearScoped: [{ class: { id: 'cls-1', name: '3ème A', level: '3e', section: { code: 'FR' } } }],
        },
      },
      subjectLines: [],
      school: {
        id: 'school-a', name: 'Collège Test Lot', subsystem: 'FRANCOPHONE',
        schoolConfig: null, schoolSettings: { schoolMotto: 'Travail & Succès' },
        identityKit: buildKitRecord('school-a', {
          regionalDelegationFr: 'CENTRE', regionalDelegationEn: 'CENTRE',
          departmentalDelegationFr: 'MFOUNDI', departmentalDelegationEn: 'MFOUNDI',
          mottoFr: 'Travail', mottoEn: 'Work', poBox: 'BP 100', city: 'Yaoundé', phone: '600000000',
          foundingYear: 2010, logoAssetKey: 'school-a/school-assets/logo.png', stampAssetKey: 'school-a/school-assets/stamp.png',
        }),
      },
      section: { code: 'FR' },
    });

    const mockBulletinRepo = createStub<BulletinRepository>({
      async findForExport() {
        return [baseExportRow('rc-1', preview1.snapshot), baseExportRow('rc-2', preview2.snapshot)];
      },
    });
    const mockAnneeRepo = createStub<AnneeAcademiqueRepository>({});
    const captured = createMockRes();

    await streamClassReportCardsMergedPdf({
      res: captured.res,
      schoolId: 'school-a',
      classId: 'cls-1',
      requestedPeriodId: 'per-1',
      anneeRepository: mockAnneeRepo,
      bulletinRepository: mockBulletinRepo,
      bulletinRenderer: new MeasuredPdfKitBulletinRenderer(),
      fileStorage: cachedAssetStorage,
    });

    expect(captured.statusCode).toBe(200);
    expect(captured.headers['content-type']).toBe('application/pdf');
    expect(captured.rawBody).not.toBeNull();
    const pdfLatin = captured.rawBody!.toString('latin1');
    expect(pdfLatin.startsWith('%PDF-')).toBe(true);
    // Single merged document contains 2 student pages in the /Pages tree
    expect(pdfLatin).toMatch(/\/Count\s+2\b/);
    // Logo + Stamp read at most once each across the whole class batch (cache hit for student 2)
    expect(readAssetCalls).toBe(2);
  });

  it('enforces heavyPdfExportLimiter on heavy PDF routes and returns 422 CLASS_EXPORT_LIMIT_EXCEEDED beyond sync cap', async () => {
    expect(MAX_SYNC_CLASS_EXPORT_STUDENTS).toBe(80);
    const rcRoutes = readFileSync(join(import.meta.dir, '../../../src/infrastructure/http/routes/reportCard.routes.ts'), 'utf8');
    const atelierRoutes = readFileSync(join(import.meta.dir, '../../../src/infrastructure/http/routes/masterBulletinAtelier.routes.ts'), 'utf8');
    expect(rcRoutes).toContain("'/template-preview', heavyPdfExportLimiter");
    expect(rcRoutes).toContain("'/export-pdf/:classId', heavyPdfExportLimiter");
    expect(rcRoutes).toContain("'/export/:classId', heavyPdfExportLimiter");
    expect(atelierRoutes).toContain("'/schools/:schoolId/preview-pdf', heavyPdfExportLimiter");

    const preview = buildFictitiousPreviewSnapshot(GENERAL_GROUPED_V1);
    const oversizedList = Array.from({ length: MAX_SYNC_CLASS_EXPORT_STUDENTS + 1 }, (_, i) => ({
      id: `rc-cap-${i}`, schoolId: 'school-a', studentId: `stu-${i}`, academicYearId: 'yr-1', academicPeriodId: 'per-1',
      template: 'FR_SECONDARY', templateSpecId: GENERAL_GROUPED_V1.id, templateVersion: 1,
      snapshotData: preview.snapshot, verifyToken: genererVerifyToken(), shortVerifyCode: `ZK-CAP-${i}`,
      reprintCount: 0, generalAverage: 12, rank: i + 1, totalStudents: 81, absenceCount: 0, mention: 'Assez Bien',
      classMasterComment: null, academicYear: null, academicPeriod: null,
      student: { id: `stu-${i}`, firstName: 'E', lastName: `${i}`, studentProfile: null },
      subjectLines: [], school: null, section: null,
    })) as BulletinExportData[];

    const mockBulletinRepo = createStub<BulletinRepository>({ async findForExport() { return oversizedList; } });
    const captured = createMockRes();
    await streamClassReportCardsMergedPdf({
      res: captured.res, schoolId: 'school-a', classId: 'cls-cap', requestedPeriodId: 'per-1',
      anneeRepository: createStub<AnneeAcademiqueRepository>({}),
      bulletinRepository: mockBulletinRepo,
      bulletinRenderer: new MeasuredPdfKitBulletinRenderer(),
    });
    expect(captured.statusCode).toBe(422);
    expect((captured.jsonBody as { code: string; maxSyncStudents: number; actualStudents: number }).code).toBe('CLASS_EXPORT_LIMIT_EXCEEDED');
    expect((captured.jsonBody as { maxSyncStudents: number; actualStudents: number }).actualStudents).toBe(81);
  });
});
