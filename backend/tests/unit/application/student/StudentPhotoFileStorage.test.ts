import { describe, it, expect } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { StaffDirectoryQueriesController } from '@infrastructure/http/controllers/StaffDirectoryQueriesController';
import { StudentPortalQueriesController } from '@infrastructure/http/controllers/StudentPortalQueriesController';
import { StudentDocumentController } from '@infrastructure/http/controllers/StudentDocumentController';
import {
  getOrRegenerateSealedBulletinPdf,
  renderAndStoreBulletinIfSpecActive,
} from '@application/reportCard/bulletinPdfLifecycle';
import {
  assertLocalDatabaseUrl,
  migrateStudentPhotosBase64,
} from '@infrastructure/services/storage/studentPhotoMigration';
import type { StaffDirectoryQueryRepository } from '@domain/ports/repositories/StaffDirectoryQueryRepository';
import type { StudentPortalQueryRepository } from '@domain/ports/repositories/StudentPortalQueryRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { StudentProfileRepository } from '@domain/ports/repositories/StudentProfileRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { BulletinRepository, BulletinExportData } from '@domain/ports/repositories/BulletinRepository';
import type { StudentDocumentRepository } from '@domain/ports/repositories/StudentDocumentRepository';
import type { BulletinRendererPort, BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import type {
  FileStoragePort,
  FileStorageMetadata,
  FileStorageReadResult,
  StoredFileObject,
} from '@domain/ports/services/FileStoragePort';
import { GENERAL_GROUPED_V1 } from '@domain/templates/bulletinCatalog';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';

function createMemoryStorage(opts?: { corruptReadBack?: boolean }): FileStoragePort & {
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
      if (opts?.corruptReadBack) {
        return { buffer: Buffer.from('corrupted'), contentType: entry.contentType, metadata: entry.metadata };
      }
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

// PNG 1x1 valide (vérifié par octets magiques + décodable par PDFKit)
const VALID_PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);
const VALID_PNG_DATA_URI = `data:image/png;base64,${VALID_PNG_1X1.toString('base64')}`;

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status(code: number): MockRes;
  json(payload: unknown): MockRes;
  send(payload: unknown): MockRes;
  end(payload?: unknown): MockRes;
  set(map: Record<string, string | number>): MockRes;
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
    end(payload?: unknown) { r.body = payload; return r; },
    set(map: Record<string, string | number>) {
      for (const [k, v] of Object.entries(map)) r.headers[k.toLowerCase()] = String(v);
      return r;
    },
    setHeader(name: string, value: string) { r.headers[name.toLowerCase()] = value; },
  };
  return r;
}

const noopNext: NextFunction = (err?: unknown) => {
  if (err) throw err;
};

describe('Phase S3 — Photos d’élèves via FileStoragePort, rétrocompatibilité data:, PDFs & migration', () => {
  const schoolId = 'school_alpha';
  const studentUserId = 'stu-user-1';

  it('téléverse une photo officielle en Data URI dans FileStoragePort (sans Base64 en DB) et la sert avec RBAC + rétrocompatibilité data:', async () => {
    const storage = createMemoryStorage();
    let dbPhotoUrl: string | null = null;

    const repo = {
      findStudentForOfficialPhoto: async (id: string, sid: string) =>
        id === studentUserId && sid === schoolId
          ? { id: studentUserId, firstName: 'Jean', lastName: 'Mbarga', studentProfile: { id: 'sp-1', photoUrl: dbPhotoUrl, matricule: 'MAT-01' } }
          : null,
      updateStudentOfficialPhoto: async (_spId: string, photoUrl: string | null) => {
        dbPhotoUrl = photoUrl;
        return { id: 'sp-1', photoUrl: dbPhotoUrl, matricule: 'MAT-01' };
      },
      logOfficialPhotoUpdate: async () => {},
    } as unknown as StaffDirectoryQueryRepository;

    const parentRepo = {
      aAccesEleve: async (parentId: string, stuId: string) => parentId === 'parent-ok' && stuId === studentUserId,
    } as unknown as ParentRepository;

    const ctrl = new StaffDirectoryQueriesController(repo, storage, parentRepo);

    // 1. Upload officiel en Data URI -> stocké dans FileStoragePort, clé seule en DB
    const upRes = makeRes();
    await ctrl.updateStudentOfficialPhoto(
      { user: { schoolId, userId: 'staff-1', role: 'STAFF' }, params: { id: studentUserId }, body: { photoUrl: VALID_PNG_DATA_URI } } as unknown as Request,
      upRes as unknown as Response,
      noopNext,
    );
    expect(upRes.statusCode).toBe(200);
    expect(dbPhotoUrl).toMatch(/^school_alpha\/student-photos\/[0-9a-f-]+\.png$/);
    expect(dbPhotoUrl?.startsWith('data:')).toBe(false);
    expect(storage.store.has(dbPhotoUrl!)).toBe(true);
    const upBody = upRes.body as { data: { photoUrl: string } };
    expect(upBody.data.photoUrl).toContain(`/api/v2/students/${studentUserId}/photo`);

    // 2. Lecture par STAFF, STUDENT (soi-même), PARENT autorisé -> 200 avec octets PNG exacts
    for (const caller of [
      { schoolId, userId: 'staff-1', role: 'STAFF' },
      { schoolId, userId: studentUserId, role: 'STUDENT' },
      { schoolId, userId: 'parent-ok', role: 'PARENT' },
    ]) {
      const dlRes = makeRes();
      await ctrl.getStudentPhoto(
        { user: caller, params: { id: studentUserId } } as unknown as Request,
        dlRes as unknown as Response,
        noopNext,
      );
      expect(dlRes.statusCode).toBe(200);
      expect(dlRes.headers['content-type']).toBe('image/png');
      expect((dlRes.body as Buffer).equals(VALID_PNG_1X1)).toBe(true);
    }

    // 3. RBAC : autre élève -> 403, parent tiers -> 403
    const otherStuRes = makeRes();
    await ctrl.getStudentPhoto(
      { user: { schoolId, userId: 'other-stu', role: 'STUDENT' }, params: { id: studentUserId } } as unknown as Request,
      otherStuRes as unknown as Response,
      noopNext,
    );
    expect(otherStuRes.statusCode).toBe(403);

    const otherParentRes = makeRes();
    await ctrl.getStudentPhoto(
      { user: { schoolId, userId: 'parent-intruder', role: 'PARENT' }, params: { id: studentUserId } } as unknown as Request,
      otherParentRes as unknown as Response,
      noopNext,
    );
    expect(otherParentRes.statusCode).toBe(403);

    // 4. Rétrocompatibilité : une photo encore stockée en data:image/png;base64,... en DB est servie telle quelle
    dbPhotoUrl = VALID_PNG_DATA_URI;
    const legacyRes = makeRes();
    await ctrl.getStudentPhoto(
      { user: { schoolId, userId: 'staff-1', role: 'STAFF' }, params: { id: studentUserId } } as unknown as Request,
      legacyRes as unknown as Response,
      noopNext,
    );
    expect(legacyRes.statusCode).toBe(200);
    expect(legacyRes.headers['content-type']).toBe('image/png');
    expect((legacyRes.body as Buffer).equals(VALID_PNG_1X1)).toBe(true);

    // 5. Clé stockée manquante -> 404 propre (jamais 500) ; clé cross-tenant -> 403
    dbPhotoUrl = 'school_alpha/student-photos/00000000-0000-0000-0000-000000000000.png';
    const missingRes = makeRes();
    await ctrl.getStudentPhoto(
      { user: { schoolId, userId: 'staff-1', role: 'STAFF' }, params: { id: studentUserId } } as unknown as Request,
      missingRes as unknown as Response,
      noopNext,
    );
    expect(missingRes.statusCode).toBe(404);

    dbPhotoUrl = 'school_beta/student-photos/11111111-1111-1111-1111-111111111111.png';
    const foreignRes = makeRes();
    await ctrl.getStudentPhoto(
      { user: { schoolId, userId: 'staff-1', role: 'STAFF' }, params: { id: studentUserId } } as unknown as Request,
      foreignRes as unknown as Response,
      noopNext,
    );
    expect(foreignRes.statusCode).toBe(403);
  });

  it('StudentPortalQueriesController ne détruit pas la clé de stockage quand l’UI renvoie /api/v2/students/:id/photo', async () => {
    const storage = createMemoryStorage();
    let capturedPatch: Record<string, unknown> = {};
    const repo = {
      findStudentCycleContextByUserId: async () => ({
        id: 'sp-1',
        activeClass: { name: 'Tle C', level: 'Tle' },
      }),
      updateStudentContactAndProfile: async (args: { profileData: Record<string, unknown> }) => {
        capturedPatch = args.profileData;
      },
    } as unknown as StudentPortalQueryRepository;

    const ctrl = new StudentPortalQueriesController(repo, storage);
    const res = makeRes();
    await ctrl.updateMyProfile(
      {
        user: { schoolId, userId: studentUserId, role: 'STUDENT' },
        body: { photoUrl: `/api/v2/students/${studentUserId}/photo`, gender: 'M' },
      } as unknown as Request,
      res as unknown as Response,
      noopNext,
    );
    expect(res.statusCode).toBe(200);
    expect('photoUrl' in capturedPatch).toBe(false);
    expect(capturedPatch.gender).toBe('M');
  });

  it('Carte scolaire PDF et Bulletins PDF résolvent la photo via FileStoragePort (et restent rétrocompatibles Base64)', async () => {
    const storage = createMemoryStorage();
    const photoKey = 'school_alpha/student-photos/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';
    await storage.put(photoKey, VALID_PNG_1X1, 'image/png');

    // A. Carte scolaire via StudentDocumentController.getCarte
    const docCtrl = new StudentDocumentController(
      {
        findForDocument: async () => ({
          id: 'sp-1',
          matricule: 'MAT-2026',
          studentStatus: 'ACTIVE',
          dateOfBirth: new Date('2010-05-01'),
          gender: 'F',
          photoUrl: photoKey,
          user: { firstName: 'Amina', lastName: 'Bello', phone: '+237690000000' },
          enrollmentsYearScoped: [{ class: { name: '3e A', section: { code: 'FR' } } }],
          parents: [],
        }),
      } as unknown as StudentProfileRepository,
      { findById: async () => ({ name: 'Lycée Alpha', subsystem: 'FRANCOPHONE' }) } as unknown as SchoolRepository,
      { findCourante: async () => ({ name: '2025-2026' }) } as unknown as AnneeAcademiqueRepository,
      {} as BulletinRepository,
      { create: async () => ({ id: 'doc-card-1' }) } as unknown as StudentDocumentRepository,
      undefined,
      storage,
    );

    const cardRes = makeRes();
    await docCtrl.getCarte(
      { user: { schoolId, userId: 'admin-1', role: 'ADMIN' }, params: { id: studentUserId } } as unknown as Request,
      cardRes as unknown as Response,
      noopNext,
    );
    expect(cardRes.statusCode).toBe(200);
    expect(Buffer.isBuffer(cardRes.body)).toBe(true);
    expect((cardRes.body as Buffer).subarray(0, 4).toString('ascii')).toBe('%PDF');

    // B. Bulletin PDF via renderAndStoreBulletinIfSpecActive & getOrRegenerateSealedBulletinPdf
    const capturedBuffers: Array<Buffer | null | undefined> = [];
    const fakeRenderer: BulletinRendererPort = {
      engineName: 'fake-test',
      render: async (_snapshot, _spec, options: BulletinRenderOptions) => {
        capturedBuffers.push(options.studentPhotoBuffer);
        return Buffer.from('%PDF-1.4\n%%EOF');
      },
    };
    const minimalSnapshot = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      schoolId,
      studentId: studentUserId,
      generalAverage: 14.5,
      student: { id: studentUserId, firstName: 'Amina', lastName: 'Bello', photoUrl: photoKey },
      subjectLines: [],
    } as unknown as StudentBulletinSnapshot;

    await renderAndStoreBulletinIfSpecActive({
      bulletinId: 'bul-1',
      schoolId,
      academicPeriodId: 'per-1',
      snapshot: minimalSnapshot,
      spec: GENERAL_GROUPED_V1,
      school: { name: 'Lycée Alpha' },
      className: '3e A',
      periodName: 'Trimestre 1',
      yearName: '2025-2026',
      mention: 'Bien',
      language: 'fr',
      verifyUrl: 'https://example.test/verify/1',
      verifyToken: 'tok-123456',
      studentPhotoUrl: photoKey,
      bulletinRenderer: fakeRenderer,
      fileStorage: storage,
    });
    expect(capturedBuffers[0]?.equals(VALID_PNG_1X1)).toBe(true);

    const fakeReportCard = {
      id: 'bul-2',
      schoolId,
      academicPeriodId: 'per-1',
      template: 'FR_SECONDARY',
      templateSpecId: GENERAL_GROUPED_V1.id,
      templateVersion: GENERAL_GROUPED_V1.version,
      snapshotData: minimalSnapshot,
      school: { name: 'Lycée Alpha', schoolConfig: { useMeasuredBulletinRenderer: true } },
      student: { firstName: 'Amina', lastName: 'Bello', studentProfile: { photoUrl: photoKey, enrollmentsYearScoped: [] } },
    } as unknown as BulletinExportData;

    await getOrRegenerateSealedBulletinPdf({
      reportCard: fakeReportCard,
      role: 'ADMIN',
      language: 'fr',
      verifyBaseUrl: 'https://example.test',
      bulletinRenderer: fakeRenderer,
      fileStorage: storage,
    });
    expect(capturedBuffers[1]?.equals(VALID_PNG_1X1)).toBe(true);
  });

  it('script de migration Base64 : refuse une base distante, dry-run par défaut, idempotent et vérifie la relecture avant MAJ DB', async () => {
    // 1. Garde base locale uniquement
    expect(() => assertLocalDatabaseUrl('postgresql://user:pass@ep-cool.eu-central-1.aws.neon.tech/neondb')).toThrow();
    expect(() => assertLocalDatabaseUrl('postgresql://user:pass@containers-us-west.railway.app:5432/railway')).toThrow();
    expect(() => assertLocalDatabaseUrl(undefined)).toThrow();
    expect(assertLocalDatabaseUrl('postgresql://postgres:postgres@localhost:5432/zekoulabia').host).toBe('localhost');
    expect(assertLocalDatabaseUrl('postgresql://postgres:postgres@127.0.0.1:5432/zekoulabia').host).toBe('127.0.0.1');

    // 2. Dry-run par défaut : zéro écriture stockage, zéro MAJ DB
    const storage = createMemoryStorage();
    const dbRows = [
      { studentProfileId: 'sp-1', studentUserId: 'u-1', schoolId, photoUrl: VALID_PNG_DATA_URI },
      { studentProfileId: 'sp-2', studentUserId: 'u-2', schoolId, photoUrl: 'school_alpha/student-photos/already.png' },
      { studentProfileId: 'sp-3', studentUserId: 'u-3', schoolId, photoUrl: null },
    ];
    let dbUpdates = 0;

    const drySummary = await migrateStudentPhotosBase64({
      candidates: dbRows,
      fileStorage: storage,
      updateStudentPhotoUrl: async () => { dbUpdates++; },
    });
    expect(drySummary.dryRun).toBe(true);
    expect(drySummary.eligible).toBe(1);
    expect(drySummary.migrated).toBe(0);
    expect(drySummary.skippedAlreadyMigrated).toBe(1);
    expect(drySummary.skippedEmpty).toBe(1);
    expect(storage.store.size).toBe(0);
    expect(dbUpdates).toBe(0);

    // 3. Relecture corrompue -> aucune MAJ DB (valeur d'origine préservée)
    const brokenStorage = createMemoryStorage({ corruptReadBack: true });
    const failedSummary = await migrateStudentPhotosBase64({
      candidates: [dbRows[0]!],
      fileStorage: brokenStorage,
      dryRun: false,
      updateStudentPhotoUrl: async () => { dbUpdates++; },
    });
    expect(failedSummary.failed).toBe(1);
    expect(failedSummary.migrated).toBe(0);
    expect(dbUpdates).toBe(0);

    // 4. --apply avec stockage sain -> stocke, relit & vérifie SHA-256, met à jour DB ; 2e passe idempotente
    const applySummary = await migrateStudentPhotosBase64({
      candidates: dbRows,
      fileStorage: storage,
      dryRun: false,
      updateStudentPhotoUrl: async (id, key) => {
        dbUpdates++;
        const row = dbRows.find((r) => r.studentProfileId === id);
        if (row) row.photoUrl = key;
      },
    });
    expect(applySummary.migrated).toBe(1);
    expect(applySummary.failed).toBe(0);
    expect(dbUpdates).toBe(1);
    expect(dbRows[0]!.photoUrl).toMatch(/^school_alpha\/student-photos\/[0-9a-f]{32}\.png$/);

    const secondPass = await migrateStudentPhotosBase64({
      candidates: dbRows,
      fileStorage: storage,
      dryRun: false,
      updateStudentPhotoUrl: async () => { dbUpdates++; },
    });
    expect(secondPass.eligible).toBe(0);
    expect(secondPass.migrated).toBe(0);
    expect(secondPass.skippedAlreadyMigrated).toBe(2);
    expect(dbUpdates).toBe(1);
  });
});
