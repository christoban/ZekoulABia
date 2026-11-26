import { afterEach, describe, expect, it } from 'bun:test';
import type { Request, Response } from 'express';
import {
  getOfficialProgrammesPilotSchoolIds,
  isOfficialProgrammesMaterialisationEnabled,
  OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG,
  OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV,
  requireOfficialProgrammesMaterialisation,
} from '@infrastructure/config/featureFlags';
import { PedagogieMaterialisationController } from '@infrastructure/http/controllers/PedagogieMaterialisationController';
import { FeatureFlaggedAutoMaterialisationService } from '@infrastructure/services/pedagogie/FeatureFlaggedAutoMaterialisationService';
import type { ProposerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/ProposerInitialisationProgrammesClasseUseCase';
import type { AppliquerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/AppliquerInitialisationProgrammesClasseUseCase';
import type { BasculerAvancementChapitreUseCase } from '@application/pedagogie/BasculerAvancementChapitreUseCase';
import type { BasculerModuleActifUseCase } from '@application/pedagogie/BasculerModuleActifUseCase';
import type { InitialiserProgrammesEcoleUseCase } from '@application/pedagogie/InitialiserProgrammesEcoleUseCase';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

interface MockRes {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
}

function createMockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe('Feature flag global + filtrage par écoles pilotes (OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS)', () => {
  const originalFlag = process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];
  const originalPilot = process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV];

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];
    else process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = originalFlag;

    if (originalPilot === undefined) delete process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV];
    else process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV] = originalPilot;
  });

  it('est désactivé par défaut même si OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS est renseignée', () => {
    delete process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];
    process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV] = 'sch_pilot_1';

    expect(isOfficialProgrammesMaterialisationEnabled('sch_pilot_1')).toBe(false);

    let nextCalled = false;
    const res = createMockRes();
    requireOfficialProgrammesMaterialisation(
      { user: { schoolId: 'sch_pilot_1' } } as unknown as Request,
      res as unknown as Response,
      () => { nextCalled = true; },
    );

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      code: 'FEATURE_DISABLED',
      message: 'Fonctionnalité non activée',
    });
  });

  it('autorise toutes les écoles quand flag=true et OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS est vide/absente', () => {
    process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = 'true';
    process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV] = '  ,  ';

    expect(getOfficialProgrammesPilotSchoolIds()).toBeNull();
    expect(isOfficialProgrammesMaterialisationEnabled('sch_any')).toBe(true);
    expect(isOfficialProgrammesMaterialisationEnabled()).toBe(true);
  });

  it('autorise uniquement les écoles pilotes et bloque les autres sur routes, status et hooks cycle de vie', async () => {
    process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = 'true';
    process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV] = 'sch_pilot_1, sch_pilot_2 ';

    // 1. Middleware HTTP
    let pilotNext = false;
    const resPilot = createMockRes();
    requireOfficialProgrammesMaterialisation(
      { user: { schoolId: 'sch_pilot_2' } } as unknown as Request,
      resPilot as unknown as Response,
      () => { pilotNext = true; },
    );
    expect(pilotNext).toBe(true);

    let otherNext = false;
    const resOther = createMockRes();
    requireOfficialProgrammesMaterialisation(
      { user: { schoolId: 'sch_other' } } as unknown as Request,
      resOther as unknown as Response,
      () => { otherNext = true; },
    );
    expect(otherNext).toBe(false);
    expect(resOther.statusCode).toBe(403);

    // 2. Endpoint GET /materialisation/status par école
    const ctrl = new PedagogieMaterialisationController(
      {} as ProposerInitialisationProgrammesClasseUseCase,
      {} as AppliquerInitialisationProgrammesClasseUseCase,
      {} as BasculerAvancementChapitreUseCase,
      {} as BasculerModuleActifUseCase,
      {} as AIActionAuditPort,
    );

    const statusPilotRes = createMockRes();
    ctrl.getStatus({ user: { schoolId: 'sch_pilot_1' } } as unknown as Request, statusPilotRes as unknown as Response);
    expect(statusPilotRes.body).toEqual({ success: true, data: { enabled: true } });

    const statusOtherRes = createMockRes();
    ctrl.getStatus({ user: { schoolId: 'sch_other' } } as unknown as Request, statusOtherRes as unknown as Response);
    expect(statusOtherRes.body).toEqual({ success: true, data: { enabled: false } });

    // 3. Hooks de cycle de vie (FeatureFlaggedAutoMaterialisationService)
    const calledClasses: string[] = [];
    const calledSchools: string[] = [];
    const svc = new FeatureFlaggedAutoMaterialisationService(
      {
        execute: async (p: { schoolId: string; classId: string }) => {
          calledClasses.push(`${p.schoolId}:${p.classId}`);
        },
      } as unknown as AppliquerInitialisationProgrammesClasseUseCase,
      {
        appliquer: async (p: { schoolId: string }) => {
          calledSchools.push(p.schoolId);
        },
      } as unknown as InitialiserProgrammesEcoleUseCase,
    );

    await svc.materialiserPourClasseSiActif({ schoolId: 'sch_other', classId: 'c1' });
    await svc.materialiserPourEcoleSiActif({ schoolId: 'sch_other' });
    expect(calledClasses).toEqual([]);
    expect(calledSchools).toEqual([]);

    await svc.materialiserPourClasseSiActif({ schoolId: 'sch_pilot_1', classId: 'c1' });
    await svc.materialiserPourEcoleSiActif({ schoolId: 'sch_pilot_2' });
    expect(calledClasses).toEqual(['sch_pilot_1:c1']);
    expect(calledSchools).toEqual(['sch_pilot_2']);
  });
});
