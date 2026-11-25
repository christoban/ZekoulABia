import { describe, it, expect } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { premierCycleFR } from '@application/school/curriculum/francophone/premier-cycle';
import { bacCoefficients } from '@application/school/curriculum/francophone/deuxieme-cycle-bac';
import { techniqueFR, professionnelFR } from '@application/school/curriculum/francophone/technique';
import {
  deriveSubjectCodeFromName,
  resolveGroupBySubjectCode,
} from '@domain/services/bulletin/bulletinGroupingSchemes';
import { resolveCurriculumSubjectConfig } from '@domain/services/bulletin/bulletinSnapshotMath';
import { GENERAL_GROUPED_V1 } from '@domain/templates/bulletinCatalog';
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
  const state = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    jsonBody: null as unknown,
    rawBody: null as Buffer | null,
  };
  const mock = {
    status(c: number) { state.statusCode = c; return mock; },
    setHeader(k: string, v: string | number) { state.headers[k.toLowerCase()] = String(v); return mock; },
    json(b: unknown) { state.jsonBody = b; return mock; },
    end(b?: Buffer | string) { state.rawBody = b ? (Buffer.isBuffer(b) ? b : Buffer.from(b)) : null; return mock; },
  };
  return { state, res: mock as unknown as Response };
}

describe('Couverture des schémas de regroupement curricula & mode économique Atelier', () => {
  it('dérive des codes distincts sans collision pour ECM, EAC et EPS tout en gardant les codes historiques', () => {
    expect(deriveSubjectCodeFromName('Éducation à la Citoyenneté et à la Morale')).toBe('ECM');
    expect(deriveSubjectCodeFromName('Éducation Artistique et Culturelle')).toBe('EAC');
    expect(deriveSubjectCodeFromName('Éducation Physique et Sportive')).toBe('EPS');
    expect(deriveSubjectCodeFromName('Mathématiques')).toBe('MATHMATI');
    expect(deriveSubjectCodeFromName('Français')).toBe('FRANAIS');

    // Non-régression : ECM et EAC tombent bien dans des groupes distincts
    expect(resolveGroupBySubjectCode('GROUP_1_2_3', 'ECM')?.groupKey).toBe('GROUPE_2');
    expect(resolveGroupBySubjectCode('GROUP_1_2_3', 'EAC')?.groupKey).toBe('GROUPE_3');
    expect(resolveGroupBySubjectCode('SCI_LIT_OTHER', 'ECM')?.groupKey).toBe('LITTERAIRE');
    expect(resolveGroupBySubjectCode('SCI_LIT_OTHER', 'EAC')?.groupKey).toBe('AUTRE');
  });

  it('couvre 100 % des matières du 1er cycle FR et 2e cycle BAC dans GROUP_1_2_3 et SCI_LIT_OTHER sans 422', () => {
    const names = new Set<string>();
    for (const lvl of premierCycleFR.levels) {
      for (const s of lvl.subjects) names.add(s.name);
    }
    for (const bc of bacCoefficients) {
      names.add(bc.subjectName);
    }

    const missingG123: string[] = [];
    const missingSciLit: string[] = [];
    for (const name of names) {
      const code = deriveSubjectCodeFromName(name);
      if (!resolveGroupBySubjectCode('GROUP_1_2_3', code)) missingG123.push(`${name} (${code})`);
      if (!resolveGroupBySubjectCode('SCI_LIT_OTHER', code)) missingSciLit.push(`${name} (${code})`);
    }

    expect(missingG123).toEqual([]);
    expect(missingSciLit).toEqual([]);
  });

  it('couvre 100 % des matières techniques et professionnelles FR dans TECH_GEN_PRO_DIV (3 blocs dont DIVERS)', () => {
    const names = new Set<string>();
    for (const curriculum of [techniqueFR, professionnelFR]) {
      for (const lvl of curriculum.levels) {
        for (const s of lvl.subjects) names.add(s.name);
      }
    }

    const missingTech: string[] = [];
    const seenGroups = new Set<string>();
    for (const name of names) {
      const code = deriveSubjectCodeFromName(name);
      const grp = resolveGroupBySubjectCode('TECH_GEN_PRO_DIV', code);
      if (!grp) {
        missingTech.push(`${name} (${code})`);
      } else {
        seenGroups.add(grp.groupKey);
      }
    }

    expect(missingTech).toEqual([]);
    expect(seenGroups.has('GENERAL')).toBe(true);
    expect(seenGroups.has('PROFESSIONNEL')).toBe(true);
    expect(seenGroups.has('DIVERS')).toBe(true);
  });

  it('préserve le défaut FLAT quand aucun groupKey n’est forcé sur SubjectCoefficient', () => {
    const res = resolveCurriculumSubjectConfig({
      subject: { id: 's-ecm', name: 'Éducation à la Citoyenneté et à la Morale', code: 'ECM', coefficient: 2 },
      groupingScheme: 'FLAT',
    });
    expect(res.groupKey).toBe('DEFAULT');
  });

  it('Atelier Master propage inkSaverMode: true dans createSpecVersion et previewPdf', async () => {
    const school = School.reconstituer({
      id: 'sc-eco', name: 'Collège Eco', subdomain: 'eco', status: 'ACTIVE', plan: 'PREMIUM',
      subsystem: 'FRANCOPHONE', educationType: 'GENERAL', ownership: 'PRIVATE_SECULAR',
      city: 'Garoua', phone: '+237600000002', saturdaySchedule: false,
      createdByMasterId: 'sa-1', createdAt: new Date(), updatedAt: new Date(),
    });
    const controller = new MasterBulletinAtelierController(
      createStub<MasterAdminQueryRepository>({
        async findSchoolBasic() {
          return { id: school.id, name: school.name, status: school.status, onboardingConfig: null, templateCode: null, createdByMasterId: 'sa-1' };
        },
      }),
      createStub<SchoolRepository>({ async findById() { return school; } }),
      createStub<SchoolConfigRepository>({ async findBySchoolId() { return { aiAlertsEnabled: false, subjectDropThreshold: 8, passMark: 10 }; } }),
      createStub<SchoolIdentityKitRepository>({ async findBySchoolId() { return null; } }),
      createStub<BulletinTemplateAssignmentRepository>({}),
      createStub<ClasseRepository>({ async findBySchool() { return []; } }),
      new MeasuredPdfKitBulletinRenderer(),
      createStub<SchoolAssetStoragePort>({ async readAssetBuffer() { return null; } }),
    );
    const noopNext: NextFunction = (err?: unknown) => { if (err) throw err; };
    const masterUser = { id: 'sa-1', role: 'super_admin', email: 'sa@zekoul.cm', isOwner: true, assignedSchoolIds: [] };

    const verRes = createMockRes();
    await controller.createSpecVersion(
      {
        params: { schoolId: school.id },
        body: { baseSpecId: GENERAL_GROUPED_V1.id, baseVersion: 1, inkSaverMode: true, publish: false },
        masterUser,
      } as unknown as Request,
      verRes.res,
      noopNext,
    );
    expect(verRes.state.statusCode).toBe(201);
    const verBody = verRes.state.jsonBody as { data?: { spec?: { inkSaverMode?: boolean; status?: string } } };
    expect(verBody.data?.spec?.inkSaverMode).toBe(true);
    expect(verBody.data?.spec?.status).toBe('DRAFT');

    const prevRes = createMockRes();
    await controller.previewPdf(
      {
        params: { schoolId: school.id },
        body: { templateSpecId: GENERAL_GROUPED_V1.id, templateVersion: 1, draftOverrides: { inkSaverMode: true } },
        masterUser,
      } as unknown as Request,
      prevRes.res,
      noopNext,
    );
    expect(prevRes.state.statusCode).toBe(200);
    expect(prevRes.state.rawBody?.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

