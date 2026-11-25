import { describe, it, expect } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { GenererRapportSyntheseMinedubUseCase } from '@application/statisticalCampaignMinedub/GenererRapportSyntheseMinedubUseCase';
import { StatisticalCampaignMinedubController } from '@infrastructure/http/controllers/StatisticalCampaignMinedubController';
import { StatisticalCampaignController } from '@infrastructure/http/controllers/StatisticalCampaignController';
import type { StatisticalQueryPort } from '@domain/ports/repositories/StatisticalQueryPort';
import type { MinedubReportRepository, MinedubRapport } from '@domain/ports/repositories/MinedubReportRepository';
import type { StatisticalCampaignRepository, StatisticalSubmission } from '@domain/ports/repositories/StatisticalCampaignRepository';
import type {
  FileStoragePort,
  FileStorageMetadata,
  FileStorageReadResult,
  StoredFileObject,
} from '@domain/ports/services/FileStoragePort';

function createMemoryStorage(): FileStoragePort & {
  store: Map<string, { buffer: Buffer; contentType: string; metadata?: FileStorageMetadata }>;
} {
  const store = new Map<string, { buffer: Buffer; contentType: string; metadata?: FileStorageMetadata }>();
  return {
    driverName: 'local',
    store,
    async put(key: string, buffer: Buffer, contentType: string, metadata?: FileStorageMetadata): Promise<StoredFileObject> {
      store.set(key, { buffer: Buffer.from(buffer), contentType, metadata });
      return { key, size: buffer.length, contentType, metadata };
    },
    async get(key: string): Promise<FileStorageReadResult | null> {
      const entry = store.get(key);
      if (!entry) return null;
      return { buffer: Buffer.from(entry.buffer), contentType: entry.contentType, metadata: entry.metadata };
    },
    async exists(key: string): Promise<boolean> {
      return store.has(key);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status(code: number): MockRes;
  json(payload: unknown): MockRes;
  send(payload: unknown): MockRes;
  setHeader(name: string, value: string): void;
}

function makeRes(): MockRes {
  const r: MockRes = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code: number) { r.statusCode = code; return r; },
    json(payload: unknown) { r.body = payload; return r; },
    send(payload: unknown) { r.body = payload; return r; },
    setHeader(name: string, value: string) { r.headers[name.toLowerCase()] = value; },
  };
  return r;
}

const noopNext: NextFunction = (err?: unknown) => {
  if (err) throw err;
};

describe('Phase S2.5 — Campagnes statistiques MINESEC & MINEDUB via FileStoragePort', () => {
  const schoolId = 'school_alpha';

  it('génère un rapport PDF MINEDUB dans FileStoragePort et le télécharge avec isolation multi-tenant et 404 propre', async () => {
    const storage = createMemoryStorage();
    const reports = new Map<string, MinedubRapport>();

    const queryStub = {
      trouverEcole: async () => ({
        id: schoolId,
        name: 'École Primaire Test',
        subdomain: 'ep-test',
        city: 'Yaoundé',
        region: 'Centre',
        subsystem: 'FRANCOPHONE',
      }),
      listerElevesPrimaire: async () => [],
      listerPersonnel: async () => [],
    } as unknown as StatisticalQueryPort;

    const repoStub = {
      trouverSupplementPrimaire: async () => null,
      creerRapport: async (data: { schoolId: string; generatedBy: string; filePath: string }) => {
        const id = 'rep-1';
        reports.set(id, { id, schoolId: data.schoolId, filePath: data.filePath, generatedAt: new Date() });
        return { id };
      },
      trouverRapportParId: async (id: string) => reports.get(id) ?? null,
    } as unknown as MinedubReportRepository;

    const useCase = new GenererRapportSyntheseMinedubUseCase(queryStub, repoStub, storage);
    const res = await useCase.execute({ schoolId, generatedByUserId: 'admin-1' });

    expect(res.filePath).toMatch(/^school_alpha\/minedub-reports\/[0-9a-f-]+\.pdf$/);
    expect(storage.store.has(res.filePath)).toBe(true);
    const pdfBuf = storage.store.get(res.filePath)!.buffer;
    expect(pdfBuf.subarray(0, 4).toString('ascii')).toBe('%PDF');

    const ctrl = new StatisticalCampaignMinedubController(useCase, repoStub, storage);

    const dlOk = makeRes();
    await ctrl.downloadReport(
      { user: { schoolId, userId: 'admin-1', role: 'ADMIN' }, params: { id: 'rep-1' } } as unknown as Request,
      dlOk as unknown as Response,
      noopNext,
    );
    expect(dlOk.statusCode).toBe(200);
    expect(dlOk.headers['content-type']).toBe('application/pdf');
    expect((dlOk.body as Buffer).equals(pdfBuf)).toBe(true);

    // Chemin hérité du disque => 404 propre
    reports.set('rep-legacy', { id: 'rep-legacy', schoolId, filePath: '/app/storage/minedub-reports/school_alpha/old.pdf', generatedAt: new Date() });
    const dlLegacy = makeRes();
    await ctrl.downloadReport(
      { user: { schoolId, userId: 'admin-1', role: 'ADMIN' }, params: { id: 'rep-legacy' } } as unknown as Request,
      dlLegacy as unknown as Response,
      noopNext,
    );
    expect(dlLegacy.statusCode).toBe(404);

    // Clé d'un autre établissement => 403
    reports.set('rep-foreign', { id: 'rep-foreign', schoolId, filePath: 'school_beta/minedub-reports/11111111-1111-1111-1111-111111111111.pdf', generatedAt: new Date() });
    const dlForeign = makeRes();
    await ctrl.downloadReport(
      { user: { schoolId, userId: 'admin-1', role: 'ADMIN' }, params: { id: 'rep-foreign' } } as unknown as Request,
      dlForeign as unknown as Response,
      noopNext,
    );
    expect(dlForeign.statusCode).toBe(403);
  });

  it('télécharge une déclaration MINESEC depuis FileStoragePort, renvoie 404 sur chemin hérité/absent et 403 cross-tenant', async () => {
    const storage = createMemoryStorage();
    const validXlsKey = 'school_alpha/statistical-submissions/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.xls';
    const xlsPayload = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await storage.put(validXlsKey, xlsPayload, 'application/vnd.ms-excel', { originalName: 'minesec-lycee.xls' });

    const submissions: Record<string, StatisticalSubmission> = {
      ok: { id: 'ok', schoolId, filePath: validXlsKey, generatedAt: new Date() },
      legacy: { id: 'legacy', schoolId, filePath: '/app/storage/statistical-submissions/school_alpha/old.xls', generatedAt: new Date() },
      missing: { id: 'missing', schoolId, filePath: 'school_alpha/statistical-submissions/00000000-0000-0000-0000-000000000000.xls', generatedAt: new Date() },
      foreign: { id: 'foreign', schoolId, filePath: 'school_beta/statistical-submissions/11111111-1111-1111-1111-111111111111.xls', generatedAt: new Date() },
    };

    const repoStub = {
      trouverSubmissionParId: async (id: string) => submissions[id] ?? null,
    } as unknown as StatisticalCampaignRepository;

    const ctrl = new StatisticalCampaignController({} as never, {} as never, repoStub, storage);

    const rOk = makeRes();
    await ctrl.downloadSubmission({ user: { schoolId, userId: 'a', role: 'ADMIN' }, params: { id: 'ok' } } as unknown as Request, rOk as unknown as Response, noopNext);
    expect(rOk.statusCode).toBe(200);
    expect(rOk.headers['content-type']).toBe('application/vnd.ms-excel');
    expect((rOk.body as Buffer).equals(xlsPayload)).toBe(true);

    const rLegacy = makeRes();
    await ctrl.downloadSubmission({ user: { schoolId, userId: 'a', role: 'ADMIN' }, params: { id: 'legacy' } } as unknown as Request, rLegacy as unknown as Response, noopNext);
    expect(rLegacy.statusCode).toBe(404);

    const rMissing = makeRes();
    await ctrl.downloadSubmission({ user: { schoolId, userId: 'a', role: 'ADMIN' }, params: { id: 'missing' } } as unknown as Request, rMissing as unknown as Response, noopNext);
    expect(rMissing.statusCode).toBe(404);

    const rForeign = makeRes();
    await ctrl.downloadSubmission({ user: { schoolId, userId: 'a', role: 'ADMIN' }, params: { id: 'foreign' } } as unknown as Request, rForeign as unknown as Response, noopNext);
    expect(rForeign.statusCode).toBe(403);
  });
});
