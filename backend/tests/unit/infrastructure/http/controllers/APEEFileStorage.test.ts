import { describe, it, expect } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { APEEController } from '@infrastructure/http/controllers/APEEController';
import type { ApeeRepository, ApeeTransactionData } from '@domain/ports/repositories/ApeeRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
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

const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const noopNext: NextFunction = (err?: unknown) => {
  if (err) throw err;
};

describe('Phase S2.3 — APEE FileStoragePort', () => {
  const schoolId = 'school_alpha';
  const auditStub = { journaliser: () => {} } as unknown as AIActionAuditPort;
  const schoolRepoStub = {} as SchoolRepository;

  it('téléverse un justificatif PDF sous {schoolId}/apee-justificatifs/{uuid}.pdf et autorise son téléchargement selon le rôle', async () => {
    const storage = createMemoryStorage();
    const tx: ApeeTransactionData = {
      id: 'tx-1',
      schoolId,
      type: 'DEPENSE',
      montant: 50000,
      categorie: 'MATERIEL',
      description: 'Craies',
      date: new Date(),
      justificatifUrl: null,
      valide: false,
      creeParId: 'admin-1',
      valideParId: null,
      valideAt: null,
      createdAt: new Date(),
    };

    const apeeRepo = {
      trouverParId: async (id: string, sid: string) => (id === tx.id && sid === schoolId ? tx : null),
      attacherJustificatif: async (_id: string, url: string) => {
        tx.justificatifUrl = url;
        return { ...tx };
      },
    } as unknown as ApeeRepository;

    const ctrl = new APEEController(apeeRepo, schoolRepoStub, auditStub, storage);

    // 1. Rejet signature truquée (400)
    const badRes = makeRes();
    await ctrl.uploadJustificatif(
      {
        user: { schoolId, userId: 'admin-1', role: 'ADMIN' },
        params: { id: 'tx-1' },
        file: { originalname: 'recu.pdf', buffer: Buffer.from('not-pdf'), size: 7, mimetype: 'application/pdf' },
      } as unknown as Request,
      badRes as unknown as Response,
      noopNext,
    );
    expect(badRes.statusCode).toBe(400);
    expect(storage.store.size).toBe(0);

    // 2. Upload valide
    const okRes = makeRes();
    await ctrl.uploadJustificatif(
      {
        user: { schoolId, userId: 'admin-1', role: 'ADMIN' },
        params: { id: 'tx-1' },
        file: { originalname: 'facture_craies.pdf', buffer: VALID_PDF, size: VALID_PDF.length, mimetype: 'application/pdf' },
      } as unknown as Request,
      okRes as unknown as Response,
      noopNext,
    );
    expect(okRes.statusCode).toBe(200);
    expect(tx.justificatifUrl).toMatch(/^school_alpha\/apee-justificatifs\/[0-9a-f-]+\.pdf$/);
    expect(tx.justificatifUrl).not.toContain('facture_craies');

    // 3. Parent refusé tant que dépense non validée (403)
    const parentDenied = makeRes();
    await ctrl.downloadJustificatif(
      { user: { schoolId, userId: 'parent-1', role: 'PARENT' }, params: { id: 'tx-1' } } as unknown as Request,
      parentDenied as unknown as Response,
      noopNext,
    );
    expect(parentDenied.statusCode).toBe(403);

    // 4. Staff autorisé sur dépense non validée (200)
    const staffOk = makeRes();
    await ctrl.downloadJustificatif(
      { user: { schoolId, userId: 'staff-1', role: 'STAFF' }, params: { id: 'tx-1' } } as unknown as Request,
      staffOk as unknown as Response,
      noopNext,
    );
    expect(staffOk.statusCode).toBe(200);
    expect((staffOk.body as Buffer).equals(VALID_PDF)).toBe(true);

    // 5. Une fois validée, Parent autorisé (200)
    tx.valide = true;
    const parentOk = makeRes();
    await ctrl.downloadJustificatif(
      { user: { schoolId, userId: 'parent-1', role: 'PARENT' }, params: { id: 'tx-1' } } as unknown as Request,
      parentOk as unknown as Response,
      noopNext,
    );
    expect(parentOk.statusCode).toBe(200);
    expect((parentOk.body as Buffer).equals(VALID_PDF)).toBe(true);
  });

  it('renvoie 404 propre sur chemin hérité ou fichier absent et 403 sur clé cross-tenant', async () => {
    const storage = createMemoryStorage();
    const txs: Record<string, ApeeTransactionData> = {
      legacy: { id: 'legacy', schoolId, type: 'DEPENSE', montant: 1000, categorie: null, description: null, date: new Date(), justificatifUrl: '/app/storage/apee-justificatifs/school_alpha/tx.pdf', valide: true, creeParId: 'a', valideParId: 'b', valideAt: new Date(), createdAt: new Date() },
      missing: { id: 'missing', schoolId, type: 'DEPENSE', montant: 1000, categorie: null, description: null, date: new Date(), justificatifUrl: 'school_alpha/apee-justificatifs/00000000-0000-0000-0000-000000000000.pdf', valide: true, creeParId: 'a', valideParId: 'b', valideAt: new Date(), createdAt: new Date() },
      foreign: { id: 'foreign', schoolId, type: 'DEPENSE', montant: 1000, categorie: null, description: null, date: new Date(), justificatifUrl: 'school_beta/apee-justificatifs/11111111-1111-1111-1111-111111111111.pdf', valide: true, creeParId: 'a', valideParId: 'b', valideAt: new Date(), createdAt: new Date() },
    };

    const apeeRepo = {
      trouverParId: async (id: string, sid: string) => (sid === schoolId ? txs[id] ?? null : null),
    } as unknown as ApeeRepository;

    const ctrl = new APEEController(apeeRepo, schoolRepoStub, auditStub, storage);

    const rLegacy = makeRes();
    await ctrl.downloadJustificatif({ user: { schoolId, userId: 'a', role: 'ADMIN' }, params: { id: 'legacy' } } as unknown as Request, rLegacy as unknown as Response, noopNext);
    expect(rLegacy.statusCode).toBe(404);

    const rMissing = makeRes();
    await ctrl.downloadJustificatif({ user: { schoolId, userId: 'a', role: 'ADMIN' }, params: { id: 'missing' } } as unknown as Request, rMissing as unknown as Response, noopNext);
    expect(rMissing.statusCode).toBe(404);

    const rForeign = makeRes();
    await ctrl.downloadJustificatif({ user: { schoolId, userId: 'a', role: 'ADMIN' }, params: { id: 'foreign' } } as unknown as Request, rForeign as unknown as Response, noopNext);
    expect(rForeign.statusCode).toBe(403);
  });
});
