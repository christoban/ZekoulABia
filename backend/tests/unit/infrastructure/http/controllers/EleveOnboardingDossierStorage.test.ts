import { describe, it, expect } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { GererPiecesDossierUseCase } from '@application/eleveOnboarding/GererPiecesDossierUseCase';
import { EleveOnboardingDossierController } from '@infrastructure/http/controllers/EleveOnboardingDossierController';
import type {
  EleveOnboardingRepository,
  OnboardingRecord,
  DocumentRequirementRecord,
  DocumentRecord,
} from '@domain/ports/repositories/EleveOnboardingRepository';
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

describe('Phase S2.2 — EleveOnboardingDossier FileStoragePort', () => {
  const schoolId = 'school_alpha';
  const onboardingId = 'ob-1';
  const baseOnboarding: OnboardingRecord = {
    id: onboardingId,
    schoolId,
    nomProvisoire: 'Amina Bello',
    classId: 'class-6e',
    recipientType: 'ELEVE',
    sourceType: 'AUTOSERVICE',
    status: 'DRAFT',
    token: 'tok-abc',
    tokenExpiresAt: new Date(Date.now() + 86400000),
    contactEmail: null,
    contactTelephone: '+237699000000',
    parentContactEmail: null,
    parentContactTelephone: null,
    examCandidateId: null,
    eleveADispositif: false,
    eleveDispositifOS: null,
    parentADispositif: true,
    parentDispositifOS: 'ANDROID',
    tokenUsedAt: null,
    matchScore: null,
    matchedStudentId: null,
    submittedData: null,
  };

  const requirements: DocumentRequirementRecord[] = [
    { id: 'req-1', schoolId, code: 'ACTE_NAISSANCE', libelle: 'Acte de naissance', obligatoire: true, applicableCase: 'TOUS' },
  ];

  it('téléverse une pièce valide sous {schoolId}/enrollment-pieces/{uuid}.pdf et la sert en téléchargement', async () => {
    const storage = createMemoryStorage();
    const docs: DocumentRecord[] = [
      { id: 'doc-1', onboardingId, requirementId: 'req-1', code: 'ACTE_NAISSANCE', libelle: 'Acte de naissance', received: false, receivedAt: null, receivedById: null, fileKey: null, note: null },
    ];
    const repo: Partial<EleveOnboardingRepository> = {
      findOnboardingById: async (id, sid) => (id === onboardingId && sid === schoolId ? baseOnboarding : null),
      listDocumentRequirements: async () => requirements,
      listDocuments: async () => docs,
      marquerDocumentRecu: async (_id, code, data) => {
        const d = docs.find((x) => x.code === code)!;
        d.received = data.received;
        d.fileKey = data.fileKey ?? null;
        return d;
      },
      updateCompletenessScore: async () => {},
    };
    const useCase = new GererPiecesDossierUseCase(repo as EleveOnboardingRepository);
    const ctrl = new EleveOnboardingDossierController(useCase, {} as never, {} as never, {} as never, storage);

    const upRes = makeRes();
    await ctrl.uploadPiece(
      {
        user: { schoolId, userId: 'staff-1', role: 'STAFF' },
        params: { id: onboardingId, code: 'ACTE_NAISSANCE' },
        file: { originalname: 'acte_naissance.pdf', buffer: VALID_PDF, size: VALID_PDF.length, mimetype: 'application/pdf' },
      } as unknown as Request,
      upRes as unknown as Response,
      noopNext,
    );

    expect(upRes.statusCode).toBe(200);
    const savedKey = docs[0]!.fileKey!;
    expect(savedKey).toMatch(/^school_alpha\/enrollment-pieces\/[0-9a-f-]+\.pdf$/);
    expect(savedKey).not.toContain('acte_naissance');

    const dlRes = makeRes();
    await ctrl.telechargerPiece(
      { user: { schoolId, userId: 'staff-1', role: 'STAFF' }, params: { id: onboardingId, code: 'ACTE_NAISSANCE' } } as unknown as Request,
      dlRes as unknown as Response,
      noopNext,
    );
    expect(dlRes.statusCode).toBe(200);
    expect(dlRes.headers['content-type']).toBe('application/pdf');
    expect((dlRes.body as Buffer).equals(VALID_PDF)).toBe(true);
  });

  it('renvoie 404 propre sur chemin hérité ou fichier absent, et 403 sur clé cross-tenant', async () => {
    const storage = createMemoryStorage();
    const docs: DocumentRecord[] = [
      { id: 'doc-legacy', onboardingId, requirementId: 'req-1', code: 'LEGACY', libelle: 'Legacy', received: true, receivedAt: new Date(), receivedById: 'u1', fileKey: '/app/storage/enrollment-pieces/school_alpha/ob-1/old.pdf', note: null },
      { id: 'doc-missing', onboardingId, requirementId: 'req-1', code: 'MISSING', libelle: 'Missing', received: true, receivedAt: new Date(), receivedById: 'u1', fileKey: 'school_alpha/enrollment-pieces/00000000-0000-0000-0000-000000000000.pdf', note: null },
      { id: 'doc-foreign', onboardingId, requirementId: 'req-1', code: 'FOREIGN', libelle: 'Foreign', received: true, receivedAt: new Date(), receivedById: 'u1', fileKey: 'school_beta/enrollment-pieces/11111111-1111-1111-1111-111111111111.pdf', note: null },
    ];
    const repo: Partial<EleveOnboardingRepository> = {
      findOnboardingById: async (id, sid) => (id === onboardingId && sid === schoolId ? baseOnboarding : null),
      listDocumentRequirements: async () => requirements,
      listDocuments: async () => docs,
    };
    const useCase = new GererPiecesDossierUseCase(repo as EleveOnboardingRepository);
    const ctrl = new EleveOnboardingDossierController(useCase, {} as never, {} as never, {} as never, storage);

    const legacyRes = makeRes();
    await ctrl.telechargerPiece(
      { user: { schoolId, userId: 'staff-1', role: 'STAFF' }, params: { id: onboardingId, code: 'LEGACY' } } as unknown as Request,
      legacyRes as unknown as Response,
      noopNext,
    );
    expect(legacyRes.statusCode).toBe(404);

    const missingRes = makeRes();
    await ctrl.telechargerPiece(
      { user: { schoolId, userId: 'staff-1', role: 'STAFF' }, params: { id: onboardingId, code: 'MISSING' } } as unknown as Request,
      missingRes as unknown as Response,
      noopNext,
    );
    expect(missingRes.statusCode).toBe(404);

    const foreignRes = makeRes();
    await ctrl.telechargerPiece(
      { user: { schoolId, userId: 'staff-1', role: 'STAFF' }, params: { id: onboardingId, code: 'FOREIGN' } } as unknown as Request,
      foreignRes as unknown as Response,
      noopNext,
    );
    expect(foreignRes.statusCode).toBe(403);
  });
});

