import { describe, it, expect, afterEach } from 'bun:test';
import PDFDocument from 'pdfkit';
import type { Request, Response, NextFunction } from 'express';
import {
  ANNUAL_BILINGUAL_V1,
  BILINGUAL_APC_V1,
  EN_SECONDARY_V1,
  GENERAL_GROUPED_V1,
  PRIMARY_POINTS_RATIO_EN_V1,
  PRIMARY_POINTS_RATIO_FR_LABELS_V1,
  TECH_GROUPED_V1,
  clearCustomTemplateSpecsForRestartSimulation,
  createNewTemplateSpecVersion,
  findDefaultSpecForTemplate,
  isSpecValidatedForProduction,
  registerTemplateSpecVersion,
} from '@domain/templates/bulletinCatalog';
import { resolveActiveSpecForBulletin } from '@application/reportCard/bulletinPdfLifecycle';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { MasterBulletinAtelierController } from '@infrastructure/http/controllers/MasterBulletinAtelierController';
import { School } from '@domain/entities/School';
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { SchoolIdentityKitRepository } from '@domain/ports/repositories/SchoolIdentityKitRepository';
import type { BulletinTemplateAssignmentRepository } from '@domain/ports/repositories/BulletinTemplateAssignmentRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { SchoolAssetStoragePort } from '@domain/ports/services/SchoolAssetStoragePort';

function createStub<T extends object>(overrides: Partial<T>): T {
  return new Proxy(overrides as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return async () => null;
    },
  }) as unknown as T;
}

function createMockRes() {
  const state = { statusCode: 200, headers: {} as Record<string, string>, jsonBody: null as unknown, rawBody: null as Buffer | null };
  const mock = {
    status(c: number) { state.statusCode = c; return mock; },
    setHeader(k: string, v: string | number) { state.headers[k.toLowerCase()] = String(v); return mock; },
    json(b: unknown) { state.jsonBody = b; return mock; },
    end(b?: Buffer | string) { state.rawBody = b ? (Buffer.isBuffer(b) ? b : Buffer.from(b)) : null; return mock; },
  };
  return { state, res: mock as unknown as Response };
}

describe('Étape 6 bis — Point 7 : états VALIDATED / TO_VALIDATE, refus d’affectation en prod et mention réservée à l’aperçu', () => {
  afterEach(() => {
    clearCustomTemplateSpecsForRestartSimulation();
  });

  it('classe les 7 specs du catalogue officiel en VALIDATED et empêche toute résolution production pour une spec TO_VALIDATE', () => {
    for (const s of [
      GENERAL_GROUPED_V1,
      TECH_GROUPED_V1,
      BILINGUAL_APC_V1,
      ANNUAL_BILINGUAL_V1,
      EN_SECONDARY_V1,
      PRIMARY_POINTS_RATIO_EN_V1,
      PRIMARY_POINTS_RATIO_FR_LABELS_V1,
    ]) {
      expect(s.validationStatus).toBe('VALIDATED');
      expect(isSpecValidatedForProduction(s)).toBe(true);
    }

    expect(findDefaultSpecForTemplate('EN_SECONDARY')?.id).toBe(EN_SECONDARY_V1.id);

    const pendingSpec = registerTemplateSpecVersion(
      createNewTemplateSpecVersion(EN_SECONDARY_V1, {
        name: 'Famille E — Variante expérimentale',
        validationStatus: 'TO_VALIDATE',
        validationNotice: 'À VALIDER SUR UN BULLETIN RÉEL',
        publish: true,
      }),
    );
    expect(pendingSpec.validationStatus).toBe('TO_VALIDATE');
    expect(isSpecValidatedForProduction(pendingSpec)).toBe(false);
    expect(
      resolveActiveSpecForBulletin({
        useMeasuredBulletinRenderer: true,
        template: 'EN_SECONDARY',
        templateSpecId: pendingSpec.id,
        templateVersion: pendingSpec.version,
      }),
    ).toBeNull();
  });

  it('l’Atelier refuse l’affectation en production d’une spec TO_VALIDATE (400 clair) mais autorise son aperçu PDF et les specs VALIDATED', async () => {
    const school = School.reconstituer({
      id: 'sc-pt7', name: 'École Test Pt7', subdomain: 'pt7', status: 'ACTIVE', plan: 'PREMIUM',
      subsystem: 'BILINGUAL', educationType: 'GENERAL', ownership: 'PRIVATE_SECULAR',
      city: 'Yaoundé', phone: '+237600000001', saturdaySchedule: false,
      createdByMasterId: 'sa-1', createdAt: new Date(), updatedAt: new Date(),
    });
    let savedAssignments = 0;
    const controller = new MasterBulletinAtelierController(
      createStub<MasterAdminQueryRepository>({
        async findSchoolBasic() {
          return { id: school.id, name: school.name, status: school.status, onboardingConfig: null, templateCode: null, createdByMasterId: 'sa-1' };
        },
      }),
      createStub<SchoolRepository>({ async findById() { return school; } }),
      createStub<SchoolConfigRepository>({ async findBySchoolId() { return { aiAlertsEnabled: false, subjectDropThreshold: 8, passMark: 10 }; } }),
      createStub<SchoolIdentityKitRepository>({ async findBySchoolId() { return null; } }),
      createStub<BulletinTemplateAssignmentRepository>({
        async save(inp) {
          savedAssignments++;
          return { id: 'a-1', schoolId: inp.schoolId, classLevel: inp.classLevel ?? null, classId: inp.classId ?? null, periodKind: inp.periodKind, template: inp.template, templateSpecId: inp.templateSpecId, templateVersion: inp.templateVersion ?? 1, groupingScheme: inp.groupingScheme ?? null, isActive: true };
        },
      }),
      createStub<ClasseRepository>({ async findBySchool() { return []; } }),
      new MeasuredPdfKitBulletinRenderer(),
      createStub<SchoolAssetStoragePort>({ async readAssetBuffer() { return null; } }),
    );
    const noopNext: NextFunction = (err?: unknown) => { if (err) throw err; };
    const masterUser = { id: 'sa-1', role: 'super_admin', email: 'sa@zekoul.cm', isOwner: true, assignedSchoolIds: [] };

    const pendingSpec = registerTemplateSpecVersion(
      createNewTemplateSpecVersion(EN_SECONDARY_V1, {
        name: 'Famille E — À valider terrain',
        validationStatus: 'TO_VALIDATE',
        validationNotice: 'À VALIDER SUR UN BULLETIN RÉEL',
        publish: true,
      }),
    );

    // Refus d'affectation pour une spec TO_VALIDATE
    const { state, res } = createMockRes();
    await controller.saveAssignment(
      { params: { schoolId: school.id }, body: { templateSpecId: pendingSpec.id, templateVersion: pendingSpec.version, periodKind: 'TRIMESTER' }, masterUser } as unknown as Request,
      res,
      noopNext,
    );
    expect(state.statusCode).toBe(400);
    const body = state.jsonBody as { code?: string; message?: string };
    expect(body.code).toBe('SPEC_TO_VALIDATE');
    expect(body.message).toContain('TO_VALIDATE');
    expect(savedAssignments).toBe(0);

    // Aperçu PDF autorisé pour une spec TO_VALIDATE
    const prev = createMockRes();
    await controller.previewPdf(
      { params: { schoolId: school.id }, body: { templateSpecId: pendingSpec.id, templateVersion: pendingSpec.version }, masterUser } as unknown as Request,
      prev.res,
      noopNext,
    );
    expect(prev.state.statusCode).toBe(200);
    expect(prev.state.headers['content-type']).toBe('application/pdf');
    expect(prev.state.rawBody?.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    // Affectation autorisée pour les specs VALIDATED (y compris Famille E et Famille F libellés FR désormais validées)
    for (const validSpec of [GENERAL_GROUPED_V1, EN_SECONDARY_V1, PRIMARY_POINTS_RATIO_FR_LABELS_V1]) {
      const ok = createMockRes();
      await controller.saveAssignment(
        { params: { schoolId: school.id }, body: { templateSpecId: validSpec.id, templateVersion: 1, periodKind: 'TRIMESTER' }, masterUser } as unknown as Request,
        ok.res,
        noopNext,
      );
      expect(ok.state.statusCode).toBe(201);
    }
    expect(savedAssignments).toBe(3);
  });

  it('affiche "À VALIDER SUR UN BULLETIN RÉEL" uniquement en mode aperçu (isPreview: true) sur une spec TO_VALIDATE, jamais sur un bulletin scellé', async () => {
    const renderer = new MeasuredPdfKitBulletinRenderer();
    const pendingSpec = createNewTemplateSpecVersion(EN_SECONDARY_V1, {
      validationStatus: 'TO_VALIDATE',
      validationNotice: 'À VALIDER SUR UN BULLETIN RÉEL',
      publish: true,
    });
    const preview = buildFictitiousPreviewSnapshot(pendingSpec);

    const captureTexts = async (isPreview?: boolean): Promise<string> => {
      const texts: string[] = [];
      const origText = PDFDocument.prototype.text;
      PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t: string, ...rest: unknown[]) {
        if (typeof t === 'string') texts.push(t);
        return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
      } as typeof PDFDocument.prototype.text;
      try {
        await renderer.render(preview.snapshot, pendingSpec, {
          className: 'Form 4',
          periodName: 'Term 1',
          yearName: '2026-2027',
          mention: 'Good',
          language: 'en',
          isPreview,
          school: { schoolName: 'Bilingual High School', city: 'Yaoundé' },
        });
      } finally {
        PDFDocument.prototype.text = origText;
      }
      return texts.join('\n');
    };

    const previewText = await captureTexts(true);
    expect(previewText).toContain('À VALIDER SUR UN BULLETIN RÉEL');

    const sealedText = await captureTexts(false);
    expect(sealedText).not.toContain('À VALIDER SUR UN BULLETIN RÉEL');

    const defaultSealedText = await captureTexts(undefined);
    expect(defaultSealedText).not.toContain('À VALIDER SUR UN BULLETIN RÉEL');
  });
});

