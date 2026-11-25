import { describe, it, expect } from 'bun:test';
import { Bulletin } from '@domain/entities/Bulletin';
import { SchoolAssetValidationError } from '@domain/errors/SchoolAssetValidationError';
import {
  getOrRegenerateSealedBulletinPdf,
  renderAndStoreBulletinIfSpecActive,
} from '@application/reportCard/bulletinPdfLifecycle';
import {
  buildBulletinPdfStorageKey,
  readSchoolAssetBuffer,
  validateAndStoreSchoolAsset,
} from '@application/reportCard/bulletinStorageHelpers';
import { migrateSchoolAssetsBase64 } from '@infrastructure/services/storage/schoolAssetMigration';
import type { BulletinExportData } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinRendererPort } from '@domain/ports/services/BulletinRendererPort';
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

const VALID_PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);
const VALID_PNG_DATA_URI = `data:image/png;base64,${VALID_PNG_1X1.toString('base64')}`;

describe('Phase S4 — Absorption de BulletinPdfStoragePort & SchoolAssetStoragePort dans FileStoragePort', () => {
  const schoolId = 'school_alpha';

  it('stocke le PDF scellé dans FileStoragePort, régénère depuis snapshotData + spec figée si absent puis re-stocke', async () => {
    const storage = createMemoryStorage();
    let renderCalls = 0;
    const seenSnapshotAverages: number[] = [];

    const renderer: BulletinRendererPort = {
      engineName: 'spy-s4',
      render: async (snapshot) => {
        renderCalls++;
        seenSnapshotAverages.push(snapshot.generalAverage);
        return Buffer.from(`%PDF-1.4\n%avg=${snapshot.generalAverage}\n%%EOF`);
      },
    };

    const sealedSnapshot = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      schoolId,
      studentId: 'stu-1',
      generalAverage: 15.75,
      subjectLines: [],
    } as unknown as StudentBulletinSnapshot;

    // 1. Génération initiale -> stocke dans FileStoragePort et renvoie la vraie clé (jamais une chaîne fictive)
    const key = await renderAndStoreBulletinIfSpecActive({
      bulletinId: 'bul-s4',
      schoolId,
      academicPeriodId: 'per-1',
      snapshot: sealedSnapshot,
      spec: GENERAL_GROUPED_V1,
      school: { name: 'Lycée Alpha' },
      className: '3e A',
      periodName: 'Trimestre 1',
      yearName: '2025-2026',
      mention: 'Bien',
      language: 'fr',
      verifyUrl: 'https://verify.test/tok',
      verifyToken: 'tok-s4-0001',
      bulletinRenderer: renderer,
      fileStorage: storage,
    });
    expect(key).toBe(
      buildBulletinPdfStorageKey({
        schoolId,
        academicPeriodId: 'per-1',
        bulletinId: 'bul-s4',
        templateVersion: GENERAL_GROUPED_V1.version,
      }),
    );
    expect(storage.store.has(key!)).toBe(true);
    expect(renderCalls).toBe(1);

    // 2. Sans fileStorage -> renvoie null (plus de chaîne fictive bulletins/{schoolId}/{id}.pdf)
    const noStorageKey = await renderAndStoreBulletinIfSpecActive({
      bulletinId: 'bul-s4-nostore',
      schoolId,
      academicPeriodId: 'per-1',
      snapshot: sealedSnapshot,
      spec: GENERAL_GROUPED_V1,
      school: { name: 'Lycée Alpha' },
      className: '3e A',
      periodName: 'Trimestre 1',
      yearName: '2025-2026',
      mention: 'Bien',
      language: 'fr',
      verifyUrl: 'https://verify.test/tok',
      verifyToken: 'tok-s4-0002',
      bulletinRenderer: renderer,
    });
    expect(noStorageKey).toBeNull();

    // Bulletin.marquerGenere(null) autorise pdfUrl absent (pas de chaîne fictive)
    const b = Bulletin.create({
      schoolId,
      studentId: 'stu-1',
      academicYearId: 'yr-1',
      academicPeriodId: 'per-1',
      template: 'FR_SECONDARY',
    });
    b.definirLignesMatiere([{ id: 'l1', subjectId: 'math', subjectName: 'Maths', coefficient: 4, subjectAverage: 15.75, weightedScore: 63 }]);
    b.definirResultats({ generalAverage: 15.75, rank: 1, totalStudents: 20, mention: 'Bien', absenceCount: 0 });
    b.marquerGenere(null);
    expect(b.toObject().pdfUrl).toBeUndefined();

    // 3. Suppression du PDF du stockage + modification des données vivantes (generalAverage=2.0) ->
    //    régénération stricte depuis snapshotData (15.75) + spec figée puis re-stockage automatique !
    await storage.delete(key!);
    expect(storage.store.has(key!)).toBe(false);

    const exportRow = {
      id: 'bul-s4',
      schoolId,
      academicPeriodId: 'per-1',
      template: 'FR_SECONDARY',
      templateSpecId: GENERAL_GROUPED_V1.id,
      templateVersion: GENERAL_GROUPED_V1.version,
      pdfUrl: key,
      generalAverage: 2.0, // donnée vivante modifiée — doit être ignorée au profit du snapshot (15.75)
      snapshotData: sealedSnapshot,
      school: { name: 'Lycée Alpha', schoolConfig: { useMeasuredBulletinRenderer: true } },
      student: { firstName: 'Amina', lastName: 'Bello', studentProfile: { enrollmentsYearScoped: [] } },
    } as unknown as BulletinExportData;

    const regenerated = await getOrRegenerateSealedBulletinPdf({
      reportCard: exportRow,
      role: 'ADMIN',
      language: 'fr',
      verifyBaseUrl: 'https://verify.test',
      bulletinRenderer: renderer,
      fileStorage: storage,
    });

    expect(regenerated?.toString('utf8')).toContain('%avg=15.75');
    expect(seenSnapshotAverages[seenSnapshotAverages.length - 1]).toBe(15.75);
    expect(storage.store.has(key!)).toBe(true); // re-stocké !

    // 4. Lecture suivante : servi depuis le stockage sans re-rendre
    const callsBefore = renderCalls;
    const fromCache = await getOrRegenerateSealedBulletinPdf({
      reportCard: exportRow,
      role: 'ADMIN',
      language: 'fr',
      verifyBaseUrl: 'https://verify.test',
      bulletinRenderer: renderer,
      fileStorage: storage,
    });
    expect(renderCalls).toBe(callsBefore);
    expect(fromCache?.equals(regenerated!)).toBe(true);
  });

  it('kit d’identité via FileStoragePort : conserve validation PNG/JPEG <= 300 Ko / 1200 px, rétrocompatibilité data:, et script de migration idempotent', async () => {
    const storage = createMemoryStorage();

    // 1. Stockage + relecture via FileStoragePort
    const stored = await validateAndStoreSchoolAsset({
      fileStorage: storage,
      schoolId,
      kind: 'logo',
      data: VALID_PNG_DATA_URI,
    });
    expect(stored.assetKey).toMatch(/^school_alpha\/school-assets\/logo-[0-9a-f]{12}\.png$/);
    const loaded = await readSchoolAssetBuffer({ fileStorage: storage, schoolId, assetKey: stored.assetKey });
    expect(loaded?.equals(VALID_PNG_1X1)).toBe(true);

    // Rétrocompatibilité Data URI direct
    const legacyLoaded = await readSchoolAssetBuffer({ fileStorage: storage, schoolId, assetKey: VALID_PNG_DATA_URI });
    expect(legacyLoaded?.equals(VALID_PNG_1X1)).toBe(true);

    // Rejet WebP (seuls PNG et JPEG acceptés pour school-assets)
    const webpBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    await expect(
      validateAndStoreSchoolAsset({ fileStorage: storage, schoolId, kind: 'stamp', data: webpBuf }),
    ).rejects.toThrow(SchoolAssetValidationError);

    // 2. Script de migration kit d’identité : dry-run par défaut, relecture obligatoire, idempotent
    const migStorage = createMemoryStorage();
    const kitRow = {
      kitId: 'kit-1',
      schoolId,
      logoAssetKey: VALID_PNG_DATA_URI,
      coatOfArmsAssetKey: null,
      stampAssetKey: 'school_alpha/school-assets/stamp-aaaaaaaaaaaa.png',
      principalSignatureAssetKey: null,
      censorSignatureAssetKey: null,
    };
    let dbWrites = 0;

    const dry = await migrateSchoolAssetsBase64({
      candidates: [kitRow],
      fileStorage: migStorage,
      updateKitAssetField: async () => { dbWrites++; },
    });
    expect(dry.dryRun).toBe(true);
    expect(dry.eligible).toBe(1);
    expect(dry.migrated).toBe(0);
    expect(dry.skippedAlreadyMigrated).toBe(1);
    expect(dry.skippedEmpty).toBe(3);
    expect(migStorage.store.size).toBe(0);
    expect(dbWrites).toBe(0);

    // Relecture corrompue => n'écrase jamais la DB
    const broken = createMemoryStorage({ corruptReadBack: true });
    const failSummary = await migrateSchoolAssetsBase64({
      candidates: [kitRow],
      fileStorage: broken,
      dryRun: false,
      updateKitAssetField: async () => { dbWrites++; },
    });
    expect(failSummary.failed).toBe(1);
    expect(dbWrites).toBe(0);

    // --apply sain => stocke, relit & vérifie SHA-256, met à jour DB ; 2e passe idempotente
    const applySummary = await migrateSchoolAssetsBase64({
      candidates: [kitRow],
      fileStorage: migStorage,
      dryRun: false,
      updateKitAssetField: async (_id, field, key) => {
        dbWrites++;
        kitRow[field] = key;
      },
    });
    expect(applySummary.migrated).toBe(1);
    expect(applySummary.failed).toBe(0);
    expect(dbWrites).toBe(1);
    expect(kitRow.logoAssetKey).toMatch(/^school_alpha\/school-assets\/logo-[0-9a-f]{12}\.png$/);

    const secondPass = await migrateSchoolAssetsBase64({
      candidates: [kitRow],
      fileStorage: migStorage,
      dryRun: false,
      updateKitAssetField: async () => { dbWrites++; },
    });
    expect(secondPass.eligible).toBe(0);
    expect(secondPass.migrated).toBe(0);
    expect(secondPass.skippedAlreadyMigrated).toBe(2);
    expect(dbWrites).toBe(1);
  });
});

