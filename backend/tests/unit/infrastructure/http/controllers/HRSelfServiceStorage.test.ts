import { describe, it, expect } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { HRSelfServiceController } from '@infrastructure/http/controllers/HRSelfServiceController';
import type { EmployeeFileRepository, EmployeeFileData } from '@domain/ports/repositories/EmployeeFileRepository';
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

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const noopNext: NextFunction = (err?: unknown) => {
  if (err) throw err;
};

describe('Phase S2.4 — HRSelfService FileStoragePort', () => {
  const schoolId = 'school_alpha';
  const userId = 'teacher-1';

  it('téléverse un document RH sous {schoolId}/hr-documents/{uuid}.jpg et permet son téléchargement authentifié', async () => {
    const storage = createMemoryStorage();
    let row: EmployeeFileData | null = null;
    const repo = {
      findByUser: async (uid: string) => (uid === userId ? row : null),
      upsertByUser: async (uid: string, sid: string, data: Partial<EmployeeFileData>) => {
        row = {
          id: 'ef-1',
          userId: uid,
          schoolId: sid,
          dateNaissance: null,
          gender: null,
          diplomes: null,
          numeroCNPS: null,
          typeContrat: null,
          dateEmbauche: null,
          echelonActuel: null,
          documentsUrls: data.documentsUrls ?? [],
          selfServiceCompletedAt: null,
          remindersSentCount: 0,
          lastReminderAt: null,
          escalatedAt: null,
        };
        return row;
      },
    } as unknown as EmployeeFileRepository;

    const ctrl = new HRSelfServiceController(repo, storage);

    // Signature binaire truquée => 400
    const badRes = makeRes();
    await ctrl.uploadMyDocument(
      {
        user: { userId, schoolId, role: 'TEACHER' },
        body: { type: 'PIECE_IDENTITE', label: 'CNI' },
        file: { originalname: 'cni.jpg', buffer: Buffer.from('not-jpeg'), size: 8, mimetype: 'image/jpeg' },
      } as unknown as Request,
      badRes as unknown as Response,
      noopNext,
    );
    expect(badRes.statusCode).toBe(400);
    expect(storage.store.size).toBe(0);

    // Upload JPEG valide
    const okRes = makeRes();
    await ctrl.uploadMyDocument(
      {
        user: { userId, schoolId, role: 'TEACHER' },
        body: { type: 'PIECE_IDENTITE', label: 'CNI recto' },
        file: { originalname: 'ma_cni_personnelle.jpg', buffer: VALID_JPEG, size: VALID_JPEG.length, mimetype: 'image/jpeg' },
      } as unknown as Request,
      okRes as unknown as Response,
      noopNext,
    );
    expect(okRes.statusCode).toBe(200);
    const docs = row!.documentsUrls as Array<{ url: string; type: string; label: string }>;
    expect(docs).toHaveLength(1);
    expect(docs[0]!.url).toMatch(/^school_alpha\/hr-documents\/[0-9a-f-]+\.jpg$/);
    expect(docs[0]!.url).not.toContain('ma_cni');

    // Download
    const dlRes = makeRes();
    await ctrl.downloadMyDocument(
      { user: { userId, schoolId, role: 'TEACHER' }, params: { index: '0' } } as unknown as Request,
      dlRes as unknown as Response,
      noopNext,
    );
    expect(dlRes.statusCode).toBe(200);
    expect(dlRes.headers['content-type']).toBe('image/jpeg');
    expect((dlRes.body as Buffer).equals(VALID_JPEG)).toBe(true);
  });

  it('renvoie 404 propre sur chemin hérité, objet manquant ou index hors bornes, et 403 sur clé cross-tenant', async () => {
    const storage = createMemoryStorage();
    const row: EmployeeFileData = {
      id: 'ef-1',
      userId,
      schoolId,
      dateNaissance: null,
      gender: null,
      diplomes: null,
      numeroCNPS: null,
      typeContrat: null,
      dateEmbauche: null,
      echelonActuel: null,
      documentsUrls: [
        { type: 'AUTRE', label: 'Ancien', url: '/app/storage/hr-documents/teacher-1/AUTRE-123.pdf', uploadedAt: new Date().toISOString() },
        { type: 'AUTRE', label: 'Absent', url: 'school_alpha/hr-documents/00000000-0000-0000-0000-000000000000.pdf', uploadedAt: new Date().toISOString() },
        { type: 'AUTRE', label: 'CrossTenant', url: 'school_beta/hr-documents/11111111-1111-1111-1111-111111111111.pdf', uploadedAt: new Date().toISOString() },
      ],
      selfServiceCompletedAt: null,
      remindersSentCount: 0,
      lastReminderAt: null,
      escalatedAt: null,
    };

    const repo = { findByUser: async () => row } as unknown as EmployeeFileRepository;
    const ctrl = new HRSelfServiceController(repo, storage);

    const rLegacy = makeRes();
    await ctrl.downloadMyDocument({ user: { userId, schoolId, role: 'TEACHER' }, params: { index: '0' } } as unknown as Request, rLegacy as unknown as Response, noopNext);
    expect(rLegacy.statusCode).toBe(404);

    const rMissing = makeRes();
    await ctrl.downloadMyDocument({ user: { userId, schoolId, role: 'TEACHER' }, params: { index: '1' } } as unknown as Request, rMissing as unknown as Response, noopNext);
    expect(rMissing.statusCode).toBe(404);

    const rForeign = makeRes();
    await ctrl.downloadMyDocument({ user: { userId, schoolId, role: 'TEACHER' }, params: { index: '2' } } as unknown as Request, rForeign as unknown as Response, noopNext);
    expect(rForeign.statusCode).toBe(403);

    const rOutOfBounds = makeRes();
    await ctrl.downloadMyDocument({ user: { userId, schoolId, role: 'TEACHER' }, params: { index: '99' } } as unknown as Request, rOutOfBounds as unknown as Response, noopNext);
    expect(rOutOfBounds.statusCode).toBe(404);
  });
});

