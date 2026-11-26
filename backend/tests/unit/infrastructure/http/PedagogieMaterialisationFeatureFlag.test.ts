import { afterEach, describe, expect, it } from 'bun:test';
import type { Request, Response } from 'express';
import {
  isOfficialProgrammesMaterialisationEnabled,
  OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG,
  requireOfficialProgrammesMaterialisation,
} from '@infrastructure/config/featureFlags';

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

describe('Feature flag ENABLE_OFFICIAL_PROGRAMMES_MATERIALISATION', () => {
  const originalValue = process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];
    } else {
      process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = originalValue;
    }
  });

  it('est désactivé par défaut et bloque les nouvelles routes avec 403 FEATURE_DISABLED', () => {
    delete process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];
    expect(isOfficialProgrammesMaterialisationEnabled()).toBe(false);

    let nextCalled = false;
    const res = createMockRes();
    requireOfficialProgrammesMaterialisation(
      {} as Request,
      res as unknown as Response,
      () => {
        nextCalled = true;
      },
    );

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      code: 'FEATURE_DISABLED',
      message: 'Fonctionnalité non activée',
    });
  });

  it('bloque également quand la variable vaut "false"', () => {
    process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = 'false';
    expect(isOfficialProgrammesMaterialisationEnabled()).toBe(false);

    let nextCalled = false;
    const res = createMockRes();
    requireOfficialProgrammesMaterialisation(
      {} as Request,
      res as unknown as Response,
      () => {
        nextCalled = true;
      },
    );
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('autorise le passage uniquement quand la variable vaut exactement "true"', () => {
    process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = 'true';
    expect(isOfficialProgrammesMaterialisationEnabled()).toBe(true);

    let nextCalled = false;
    const res = createMockRes();
    requireOfficialProgrammesMaterialisation(
      {} as Request,
      res as unknown as Response,
      () => {
        nextCalled = true;
      },
    );
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
  });
});
