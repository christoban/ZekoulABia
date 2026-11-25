import { describe, it, expect, mock } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { idempotency } from '../../../../../src/infrastructure/http/middlewares/idempotency.ts';

function makePrisma(overrides: Partial<{ findUnique: any; create: any }> = {}) {
  return {
    idempotencyRecord: {
      findUnique: overrides.findUnique ?? mock(async () => null),
      create: overrides.create ?? mock(async () => ({})),
    },
  } as any;
}

function makeReq(headers: Record<string, string | undefined>, user?: { userId: string }): Partial<Request> {
  return {
    header: ((name: string) => headers[name] ?? headers[name.toLowerCase()]) as any,
    method: 'POST',
    path: '/api/v2/finance/payments/cash',
    user: user as any,
  };
}

function makeRes(statusCode = 200): any {
  const res: any = { statusCode };
  res.status = mock((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = mock((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('idempotency middleware', () => {
  it('no-op si pas de header Idempotency-Key → next()', async () => {
    const mw = idempotency(makePrisma());
    const next = mock(() => {});
    await mw(makeReq({}) as Request, makeRes() as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('rejoue la réponse stockée si clé déjà connue (2xx)', async () => {
    const stored = { statusCode: 201, responseBody: { success: true, data: { id: 'p1' } } };
    const mw = idempotency(
      makePrisma({
        findUnique: mock(async () => stored),
      }),
    );
    const res = makeRes();
    const next = mock(() => {});
    await mw(makeReq({ 'Idempotency-Key': 'k1' }) as Request, res as Response, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored.responseBody);
  });

  it('laisse passer et enregistre uniquement les 2xx après traitement', async () => {
    const create = mock(async () => ({}));
    const mw = idempotency(makePrisma({ create }));
    const res = makeRes(201);
    res.statusCode = 201;
    const next = mock(() => {
      res.json({ success: true });
    });
    await mw(makeReq({ 'Idempotency-Key': 'k2' }, { userId: 'u1' }) as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    await Promise.resolve();
    // microtask for fire-and-forget create may need tick
    await new Promise((r) => setTimeout(r, 10));
    expect(create).toHaveBeenCalled();
    const args = (create.mock.calls[0] as any)?.[0];
    expect(args?.data?.key).toBe('k2');
    expect(args?.data?.statusCode).toBe(201);
  });

  it('n’enregistre PAS les réponses non-2xx', async () => {
    const create = mock(async () => ({}));
    const mw = idempotency(makePrisma({ create }));
    const res = makeRes(400);
    res.statusCode = 400;
    const next = mock(() => {
      res.json({ success: false });
    });
    await mw(makeReq({ 'Idempotency-Key': 'k3' }, { userId: 'u1' }) as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 10));
    expect(create).not.toHaveBeenCalled();
  });

  it('n’enregistre PAS si userId absent même en 2xx', async () => {
    const create = mock(async () => ({}));
    const mw = idempotency(makePrisma({ create }));
    const res = makeRes(200);
    res.statusCode = 200;
    const next = mock(() => {
      res.json({ success: true });
    });
    await mw(makeReq({ 'Idempotency-Key': 'k5' }) as Request, res as Response, next as NextFunction);
    await new Promise((r) => setTimeout(r, 10));
    expect(create).not.toHaveBeenCalled();
  });

  it('si findUnique throw → laisse passer (fail-open)', async () => {
    const mw = idempotency(
      makePrisma({
        findUnique: mock(async () => {
          throw new Error('DB down');
        }),
      }),
    );
    const next = mock(() => {});
    await mw(makeReq({ 'Idempotency-Key': 'k4' }) as Request, makeRes() as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('si create throw → n’empêche pas la réponse (catch silencieux)', async () => {
    const create = mock(async () => {
      throw new Error('DB down');
    });
    const mw = idempotency(makePrisma({ create }));
    const res = makeRes(201);
    res.statusCode = 201;
    let threw = false;
    const next = mock(() => {
      try {
        res.json({ success: true });
      } catch {
        threw = true;
      }
    });
    await mw(makeReq({ 'Idempotency-Key': 'k6' }, { userId: 'u1' }) as Request, res as Response, next as NextFunction);
    await new Promise((r) => setTimeout(r, 10));
    expect(threw).toBe(false);
    expect(res.body).toEqual({ success: true });
  });
});
