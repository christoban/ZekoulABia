import { describe, it, expect, mock } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { authorizeSchool } from '../../../../../src/infrastructure/http/middlewares/authMultiTenant.ts';

function makeReq(user: any): Partial<Request> {
  return { user } as any;
}

function makeRes(): { statusCode?: number; body?: any; status: any; json: any } {
  const res: any = {};
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

describe('authorizeSchool', () => {
  it('laisse passer si le rôle correspond', () => {
    const mw = authorizeSchool(['ADMIN', 'STAFF']);
    const req = makeReq({ role: 'ADMIN', permissions: [] });
    const res = makeRes();
    const next = mock(() => {});
    mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it('refuse 403 si le rôle ne correspond pas', () => {
    const mw = authorizeSchool(['ADMIN']);
    const req = makeReq({ role: 'TEACHER', permissions: [] });
    const res = makeRes();
    const next = mock(() => {});
    mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepte via perm:XXX si la permission est présente', () => {
    const mw = authorizeSchool(['perm:MANAGE_FINANCE']);
    const req = makeReq({ role: 'STAFF', permissions: ['MANAGE_FINANCE'] });
    const res = makeRes();
    const next = mock(() => {});
    mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('refuse 403 si perm:XXX absente', () => {
    const mw = authorizeSchool(['perm:MANAGE_FINANCE']);
    const req = makeReq({ role: 'STAFF', permissions: ['VALIDATE_GRADES'] });
    const res = makeRes();
    const next = mock(() => {});
    mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.statusCode).toBe(403);
  });

  it('refuse 401 si req.user est absent', () => {
    const mw = authorizeSchool(['ADMIN']);
    const req = makeReq(undefined);
    const res = makeRes();
    const next = mock(() => {});
    mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.statusCode).toBe(401);
  });

  it('mix rôle + perm : OK si l’un des deux match', () => {
    const mw = authorizeSchool(['ADMIN', 'perm:MANAGE_FINANCE']);
    const req = makeReq({ role: 'STAFF', permissions: ['MANAGE_FINANCE'] });
    const res = makeRes();
    const next = mock(() => {});
    mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('refuse si permissions est undefined et perm requis', () => {
    const mw = authorizeSchool(['perm:MANAGE_FINANCE']);
    const req = makeReq({ role: 'STAFF' });
    const res = makeRes();
    const next = mock(() => {});
    mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.statusCode).toBe(403);
  });
});
