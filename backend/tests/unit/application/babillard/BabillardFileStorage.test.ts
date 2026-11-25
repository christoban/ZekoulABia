import { describe, it, expect } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { UploaderPieceJointeUseCase } from '@application/babillard/UploaderPieceJointeUseCase';
import { BabillardController } from '@infrastructure/http/controllers/BabillardController';
import type { FileStoragePort, FileStorageMetadata, FileStorageReadResult, StoredFileObject } from '@domain/ports/services/FileStoragePort';
import type { PublicationRepository } from '@domain/ports/repositories/PublicationRepository';
import type { BabillardContextRepository } from '@domain/ports/repositories/BabillardContextRepository';
import { Publication } from '@domain/entities/Publication';

function createMemoryStorage(): FileStoragePort & { store: Map<string, { buffer: Buffer; contentType: string; metadata?: FileStorageMetadata }> } {
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
    status(code: number) {
      r.statusCode = code;
      return r;
    },
    json(payload: unknown) {
      r.body = payload;
      return r;
    },
    send(payload: unknown) {
      r.body = payload;
      return r;
    },
    setHeader(name: string, value: string) {
      r.headers[name.toLowerCase()] = value;
    },
  };
  return r;
}

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);
const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const noopNext: NextFunction = (err?: unknown) => {
  if (err) throw err;
};

describe('Phase S2.1 — Babillard FileStoragePort', () => {
  it('stocke une pièce jointe sous {schoolId}/babillard/{uuid}.{ext} sans nom utilisateur dans la clé', async () => {
    const storage = createMemoryStorage();
    const useCase = new UploaderPieceJointeUseCase(storage);

    const pj = await useCase.execute({
      user: {
        userId: 'admin-1',
        schoolId: 'school_alpha',
        role: 'ADMIN',
        permissions: [],
      },
      originalname: '../secret-note.png',
      buffer: VALID_PNG,
      size: VALID_PNG.length,
      mimetype: 'image/png',
    });

    expect(pj.cleStockage).toMatch(/^school_alpha\/babillard\/[0-9a-f-]+\.png$/);
    expect(pj.cleStockage).not.toContain('secret-note');
    expect(pj.nomOriginal).toBe('secret-note.png');
    expect(storage.store.has(pj.cleStockage)).toBe(true);
    expect(storage.store.get(pj.cleStockage)?.metadata?.originalName).toBe('secret-note.png');
  });

  it('rejette un fichier à signature binaire truquée avec HTTP 400', async () => {
    const storage = createMemoryStorage();
    const useCase = new UploaderPieceJointeUseCase(storage);
    const ctxRepo = {
      chargerUtilisateurContexte: async (u: { userId: string; schoolId: string; role: string }) => ({
        ...u,
        permissions: [],
        enfantClassIds: [],
        enfantNiveauIds: [],
        classeEnseigneeIds: [],
        niveauEnseigneIds: [],
      }),
    } as unknown as BabillardContextRepository;

    const ctrl = new BabillardController(
      {} as PublicationRepository,
      ctxRepo,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      useCase,
      storage,
    );

    const req = {
      user: { userId: 'admin-1', schoolId: 'school_alpha', role: 'ADMIN', permissions: [] },
      file: { originalname: 'fake.pdf', buffer: Buffer.from('not-a-pdf'), size: 9, mimetype: 'application/pdf' },
      body: {},
    } as unknown as Request;
    const res = makeRes();

    await ctrl.uploadPieceJointe(req, res as unknown as Response, noopNext);
    expect(res.statusCode).toBe(400);
    expect(storage.store.size).toBe(0);
  });

  it('sert un fichier temporaire (preview) et un fichier publié, renvoie 404 propre sur clé absente ou héritée, et 403 cross-tenant', async () => {
    const storage = createMemoryStorage();
    const useCase = new UploaderPieceJointeUseCase(storage);

    const adminCtx = {
      userId: 'admin-1',
      schoolId: 'school_alpha',
      role: 'ADMIN',
      permissions: [],
    };
    const pj = await useCase.execute({
      user: adminCtx,
      originalname: 'circulaire.pdf',
      buffer: VALID_PDF,
      size: VALID_PDF.length,
      mimetype: 'application/pdf',
    });

    const pub = new Publication({
      id: 'pub-1',
      tenantId: 'school_alpha',
      type: 'ANNONCE',
      auteurId: 'admin-1',
      auteurRole: 'ADMIN',
      titre: 'Circulaire',
      corps: '<p>Bonjour</p>',
      corpsFormat: 'HTML_SAFE',
      categorie: 'ADMINISTRATIF',
      priorite: 'NORMALE',
      statut: 'PUBLIEE',
      epinglee: false,
      audience: { roles: ['PARENT', 'ADMIN'], niveauIds: [], classeIds: [] },
      piecesJointes: [
        pj,
        { id: 'pj-legacy', nomOriginal: 'old.pdf', mime: 'application/pdf', taille: 10, cleStockage: 'schools/school_alpha/babillard/temp/old.pdf', nbPages: 1, ordre: 1, texteAlternatif: null },
        { id: 'pj-missing', nomOriginal: 'gone.pdf', mime: 'application/pdf', taille: 10, cleStockage: 'school_alpha/babillard/00000000-0000-0000-0000-000000000000.pdf', nbPages: 1, ordre: 2, texteAlternatif: null },
        { id: 'pj-foreign', nomOriginal: 'other.pdf', mime: 'application/pdf', taille: 10, cleStockage: 'school_beta/babillard/11111111-1111-1111-1111-111111111111.pdf', nbPages: 1, ordre: 3, texteAlternatif: null },
      ],
      publieeLe: new Date(),
      programmeeLe: null,
      dureeVisibilite: 'PERMANENT',
      expireLe: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const repoStub = {
      trouverParId: async (id: string, schoolId: string) => (id === 'pub-1' && schoolId === 'school_alpha' ? pub : null),
    } as unknown as PublicationRepository;

    const ctxRepo = {
      chargerUtilisateurContexte: async (u: { userId: string; schoolId: string; role: string }) => ({
        ...u,
        permissions: [],
        enfantClassIds: [],
        enfantNiveauIds: [],
        classeEnseigneeIds: [],
        niveauEnseigneIds: [],
      }),
    } as unknown as BabillardContextRepository;

    const ctrl = new BabillardController(
      repoStub,
      ctxRepo,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      useCase,
      storage,
    );

    // 1. Téléchargement preview temp par auteur habilité
    const tempRes = makeRes();
    await ctrl.telechargerPieceJointe(
      { user: adminCtx, params: { id: 'temp', pjId: pj.id } } as unknown as Request,
      tempRes as unknown as Response,
      noopNext,
    );
    expect(tempRes.statusCode).toBe(200);
    expect(Buffer.isBuffer(tempRes.body)).toBe(true);
    expect((tempRes.body as Buffer).equals(VALID_PDF)).toBe(true);

    // 2. Téléchargement publié par parent de l'école
    const pubRes = makeRes();
    await ctrl.telechargerPieceJointe(
      { user: { userId: 'parent-1', schoolId: 'school_alpha', role: 'PARENT', permissions: [] }, params: { id: 'pub-1', pjId: pj.id } } as unknown as Request,
      pubRes as unknown as Response,
      noopNext,
    );
    expect(pubRes.statusCode).toBe(200);
    expect((pubRes.body as Buffer).equals(VALID_PDF)).toBe(true);

    // 3. Clé héritée du disque local => 404 propre (jamais 500)
    const legacyRes = makeRes();
    await ctrl.telechargerPieceJointe(
      { user: adminCtx, params: { id: 'pub-1', pjId: 'pj-legacy' } } as unknown as Request,
      legacyRes as unknown as Response,
      noopNext,
    );
    expect(legacyRes.statusCode).toBe(404);

    // 4. Objet manquant sur le stockage => 404 propre
    const missingRes = makeRes();
    await ctrl.telechargerPieceJointe(
      { user: adminCtx, params: { id: 'pub-1', pjId: 'pj-missing' } } as unknown as Request,
      missingRes as unknown as Response,
      noopNext,
    );
    expect(missingRes.statusCode).toBe(404);

    // 5. Clé appartenant à un autre établissement => 403
    const foreignRes = makeRes();
    await ctrl.telechargerPieceJointe(
      { user: adminCtx, params: { id: 'pub-1', pjId: 'pj-foreign' } } as unknown as Request,
      foreignRes as unknown as Response,
      noopNext,
    );
    expect(foreignRes.statusCode).toBe(403);
  });
});
