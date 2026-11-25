import { describe, it, expect, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import { FileStorageValidationError } from '@domain/errors/FileStorageValidationError';
import {
  assertKeyBelongsToSchool,
  assertValidStorageKey,
  buildScopedStorageKey,
  detectMimeTypeByMagicBytes,
  validateUploadedFileForDomain,
} from '@domain/services/storage/fileStorageValidation';
import { LocalDiskFileStorage } from '@infrastructure/services/storage/LocalDiskFileStorage';
import { S3CompatibleFileStorage } from '@infrastructure/services/storage/S3CompatibleFileStorage';
import { createFileStorageAdapter } from '@infrastructure/services/storage/createFileStorageAdapter';

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

interface MockS3Entry {
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

function createInMemoryS3Client(): S3Client {
  const store = new Map<string, MockS3Entry>();

  const makeNotFound = () => {
    const err = new Error('NoSuchKey') as Error & { name: string; $metadata: { httpStatusCode: number } };
    err.name = 'NoSuchKey';
    err.$metadata = { httpStatusCode: 404 };
    return err;
  };

  const mock = {
    async send(command: unknown): Promise<unknown> {
      if (command instanceof PutObjectCommand) {
        const key = `${command.input.Bucket}/${command.input.Key}`;
        const raw = command.input.Body;
        const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
        store.set(key, {
          body,
          contentType: command.input.ContentType,
          metadata: command.input.Metadata ? { ...command.input.Metadata } : undefined,
        });
        return {};
      }
      if (command instanceof GetObjectCommand) {
        const key = `${command.input.Bucket}/${command.input.Key}`;
        const found = store.get(key);
        if (!found) throw makeNotFound();
        return {
          Body: {
            async transformToByteArray(): Promise<Uint8Array> {
              return new Uint8Array(found.body);
            },
          },
          ContentType: found.contentType,
          Metadata: found.metadata,
        };
      }
      if (command instanceof HeadObjectCommand) {
        const key = `${command.input.Bucket}/${command.input.Key}`;
        if (!store.has(key)) throw makeNotFound();
        return {};
      }
      if (command instanceof DeleteObjectCommand) {
        const key = `${command.input.Bucket}/${command.input.Key}`;
        store.delete(key);
        return {};
      }
      throw new Error('Commande S3 non supportée dans le mock');
    },
  };

  return mock as unknown as S3Client;
}

function makeFakePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(32);
  // Signature PNG
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // Chunk IHDR
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

const VALID_PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF', 'utf8');
const VALID_PNG = makeFakePng(400, 300);
const OVERSIZED_DIM_PNG = makeFakePng(1600, 900);
const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const VALID_WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from('VP8 ')]);
const FAKE_EXE = Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'binary');

function runContractSuite(label: string, createAdapter: () => FileStoragePort): void {
  describe(`Contrat FileStoragePort — ${label}`, () => {
    it('put / get / exists / delete fonctionnent avec métadonnées accentuées et suppression idempotente', async () => {
      const storage = createAdapter();
      const key = buildScopedStorageKey({
        schoolId: 'school-alpha',
        domain: 'babillard',
        extension: '.pdf',
      });

      expect(await storage.exists(key)).toBe(false);
      expect(await storage.get(key)).toBeNull();

      const stored = await storage.put(key, VALID_PDF, 'application/pdf', {
        originalName: "Circulaire d'été 2026.pdf",
      });
      expect(stored.key).toBe(key);
      expect(stored.size).toBe(VALID_PDF.length);
      expect(stored.contentType).toBe('application/pdf');

      expect(await storage.exists(key)).toBe(true);
      const loaded = await storage.get(key);
      expect(loaded).not.toBeNull();
      expect(loaded!.buffer.equals(VALID_PDF)).toBe(true);
      expect(loaded!.contentType).toBe('application/pdf');
      expect(loaded!.metadata?.originalname ?? loaded!.metadata?.originalName).toBe("Circulaire d'été 2026.pdf");

      await storage.delete(key);
      expect(await storage.exists(key)).toBe(false);
      expect(await storage.get(key)).toBeNull();

      // Delete sur clé inexistante : idempotent (aucune erreur)
      await storage.delete(key);
    });

    it('renvoie null pour une clé inexistante valide sans jamais lever d’erreur 500', async () => {
      const storage = createAdapter();
      const missingKey = buildScopedStorageKey({
        schoolId: 'school-missing',
        domain: 'hr-documents',
        extension: '.pdf',
      });
      expect(await storage.exists(missingKey)).toBe(false);
      expect(await storage.get(missingKey)).toBeNull();
    });

    it('rejette toute tentative de path traversal ou clé malformée sur put/get/exists/delete', async () => {
      const storage = createAdapter();
      const badKeys = [
        '../etc/passwd',
        'school-a/../school-b/babillard/file.pdf',
        'school-a/babillard/../../secret.env',
        '/etc/passwd',
        'school-a\\babillard\\file.pdf',
        'school-a/babillard/file\0.pdf',
        'only-two-segments/file.pdf',
        'data:image/png;base64,AAAA',
        '.metadata/school-a/file.json',
      ];

      for (const bad of badKeys) {
        await expect(storage.put(bad, VALID_PDF, 'application/pdf')).rejects.toThrow(FileStorageValidationError);
        await expect(storage.get(bad)).rejects.toThrow(FileStorageValidationError);
        await expect(storage.exists(bad)).rejects.toThrow(FileStorageValidationError);
        await expect(storage.delete(bad)).rejects.toThrow(FileStorageValidationError);
      }
    });

    it('garantit l’isolation stricte entre deux schoolId (A et B)', async () => {
      const storage = createAdapter();
      const keyA = buildScopedStorageKey({
        schoolId: 'school-a',
        domain: 'apee-justificatifs',
        extension: '.pdf',
      });
      const keyB = buildScopedStorageKey({
        schoolId: 'school-b',
        domain: 'apee-justificatifs',
        extension: '.pdf',
      });

      const payloadA = Buffer.from('%PDF-1.7\nSCHOOL-A', 'utf8');
      const payloadB = Buffer.from('%PDF-1.7\nSCHOOL-B', 'utf8');
      await storage.put(keyA, payloadA, 'application/pdf');
      await storage.put(keyB, payloadB, 'application/pdf');

      // Vérification d'appartenance multi-tenant
      expect(assertKeyBelongsToSchool(keyA, 'school-a')).toBe(keyA);
      expect(() => assertKeyBelongsToSchool(keyA, 'school-b')).toThrow(FileStorageValidationError);
      expect(() => assertKeyBelongsToSchool(keyB, 'school-a')).toThrow(FileStorageValidationError);

      // Supprimer le fichier de school-a n'affecte jamais school-b
      await storage.delete(keyA);
      expect(await storage.exists(keyA)).toBe(false);
      expect(await storage.exists(keyB)).toBe(true);
      const readB = await storage.get(keyB);
      expect(readB?.buffer.equals(payloadB)).toBe(true);
    });
  });
}

runContractSuite('LocalDiskFileStorage', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'zekoul-fs-contract-'));
  tempDirs.push(dir);
  return new LocalDiskFileStorage(dir);
});

runContractSuite('S3CompatibleFileStorage (S3 simulé)', () => {
  return new S3CompatibleFileStorage(
    {
      bucket: 'zekoul-test-bucket',
      endpoint: 'https://s3.example.test',
      region: 'auto',
      accessKeyId: 'test-ak',
      secretAccessKey: 'test-sk',
      keyPrefix: 'env-test',
    },
    createInMemoryS3Client(),
  );
});

describe('Validation fichiers, magic bytes, limites par domaine & factory de démarrage', () => {
  it('détecte les octets magiques et rejette les extensions falsifiées ou non autorisées', () => {
    expect(detectMimeTypeByMagicBytes(VALID_PDF)).toBe('application/pdf');
    expect(detectMimeTypeByMagicBytes(VALID_PNG)).toBe('image/png');
    expect(detectMimeTypeByMagicBytes(VALID_JPEG)).toBe('image/jpeg');
    expect(detectMimeTypeByMagicBytes(VALID_WEBP)).toBe('image/webp');
    expect(detectMimeTypeByMagicBytes(FAKE_EXE)).toBeNull();

    // Fichier légitime
    const ok = validateUploadedFileForDomain({
      domain: 'babillard',
      buffer: VALID_PDF,
      originalName: '../../Mon Document Officiel.pdf',
    });
    expect(ok.mimeType).toBe('application/pdf');
    expect(ok.extension).toBe('.pdf');
    expect(ok.originalName).toBe('Mon Document Officiel.pdf');

    // Nom utilisateur jamais présent dans la clé générée
    const generatedKey = buildScopedStorageKey({
      schoolId: 'sc-1',
      domain: 'babillard',
      extension: ok.extension,
    });
    expect(generatedKey).toMatch(/^sc-1\/babillard\/[0-9a-f-]{36}\.pdf$/);
    expect(generatedKey).not.toContain('Mon Document');
    expect(assertValidStorageKey(generatedKey)).toBe(generatedKey);

    // Exécutable renommé .pdf -> rejeté par magic bytes
    expect(() =>
      validateUploadedFileForDomain({
        domain: 'babillard',
        buffer: FAKE_EXE,
        originalName: 'virus.pdf',
      }),
    ).toThrow(FileStorageValidationError);

    // PDF renommé .png -> incohérence extension / magic bytes rejetée
    expect(() =>
      validateUploadedFileForDomain({
        domain: 'babillard',
        buffer: VALID_PDF,
        originalName: 'faux.png',
      }),
    ).toThrow(FileStorageValidationError);

    // WEBP interdit dans apee-justificatifs (PDF/PNG/JPEG uniquement)
    expect(() =>
      validateUploadedFileForDomain({
        domain: 'apee-justificatifs',
        buffer: VALID_WEBP,
        originalName: 'recu.webp',
      }),
    ).toThrow(FileStorageValidationError);
  });

  it('applique les limites de taille et de dimensions par domaine (ex. school-assets <= 300 Ko, <= 1200x1200)', () => {
    const okAsset = validateUploadedFileForDomain({
      domain: 'school-assets',
      buffer: VALID_PNG,
      originalName: 'logo.png',
    });
    expect(okAsset.width).toBe(400);
    expect(okAsset.height).toBe(300);

    // Dimensions > 1200 px rejetées
    expect(() =>
      validateUploadedFileForDomain({
        domain: 'school-assets',
        buffer: OVERSIZED_DIM_PNG,
        originalName: 'trop-grand.png',
      }),
    ).toThrow(FileStorageValidationError);

    // Poids > 300 Ko rejeté sur school-assets
    const bigPng = Buffer.concat([VALID_PNG, Buffer.alloc(310 * 1024)]);
    expect(() =>
      validateUploadedFileForDomain({
        domain: 'school-assets',
        buffer: bigPng,
        originalName: 'lourd.png',
      }),
    ).toThrow(FileStorageValidationError);

    // Fichier vide rejeté
    expect(() =>
      validateUploadedFileForDomain({
        domain: 'enrollment-pieces',
        buffer: Buffer.alloc(0),
        originalName: 'vide.pdf',
      }),
    ).toThrow(FileStorageValidationError);
  });

  it('factory journalise le driver actif et avertit en production si driver=local sans volume persistant', () => {
    const infos: string[] = [];
    const warns: string[] = [];
    const logger = {
      info: (m: string) => infos.push(m),
      warn: (m: string) => warns.push(m),
    };

    const dir = mkdtempSync(path.join(tmpdir(), 'zekoul-fs-factory-'));
    tempDirs.push(dir);

    // 1. Production + local SANS FILE_STORAGE_PERSISTENT_VOLUME -> avertissement obligatoire
    const prodEphemeral = createFileStorageAdapter({
      env: { NODE_ENV: 'production', FILE_STORAGE_DRIVER: 'local', FILE_STORAGE_LOCAL_DIR: dir },
      logger,
    });
    expect(prodEphemeral.driverName).toBe('local');
    expect(infos.some((m) => m.includes('Driver actif : local'))).toBe(true);
    expect(warns.some((m) => m.includes('FILE_STORAGE_PERSISTENT_VOLUME=true'))).toBe(true);

    // 2. Production + local AVEC FILE_STORAGE_PERSISTENT_VOLUME=true -> aucun avertissement
    infos.length = 0;
    warns.length = 0;
    const prodPersistent = createFileStorageAdapter({
      env: {
        NODE_ENV: 'production',
        FILE_STORAGE_DRIVER: 'local',
        FILE_STORAGE_LOCAL_DIR: dir,
        FILE_STORAGE_PERSISTENT_VOLUME: 'true',
      },
      logger,
    });
    expect(prodPersistent.driverName).toBe('local');
    expect(warns).toEqual([]);

    // 3. Driver s3 configuré
    infos.length = 0;
    warns.length = 0;
    const s3Adapter = createFileStorageAdapter({
      env: {
        NODE_ENV: 'production',
        FILE_STORAGE_DRIVER: 's3',
        FILE_STORAGE_S3_BUCKET: 'prod-bucket',
        FILE_STORAGE_S3_ENDPOINT: 'https://s3.vps.local',
        FILE_STORAGE_S3_ACCESS_KEY_ID: 'ak',
        FILE_STORAGE_S3_SECRET_ACCESS_KEY: 'sk',
      },
      logger,
    });
    expect(s3Adapter.driverName).toBe('s3');
    expect(infos.some((m) => m.includes('Driver actif : s3'))).toBe(true);
    expect(warns).toEqual([]);

    // 4. Driver invalide -> fail-fast
    expect(() =>
      createFileStorageAdapter({
        env: { FILE_STORAGE_DRIVER: 'ftp' },
        logger,
      }),
    ).toThrow(/FILE_STORAGE_DRIVER invalide/);
  });
});

