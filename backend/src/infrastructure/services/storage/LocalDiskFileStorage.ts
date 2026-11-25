/**
 * INFRASTRUCTURE LAYER — Adaptateur disque local pour FileStoragePort
 *
 * Utilisé en développement, tests et sur VPS disposant d'un volume disque persistant.
 * Protégé contre le path traversal par validation stricte de clé (`assertValidStorageKey`)
 * et vérification du confinement dans `baseDir`.
 */

import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  FileStorageMetadata,
  FileStoragePort,
  FileStorageReadResult,
  StoredFileObject,
} from '@domain/ports/services/FileStoragePort';
import { FileStorageValidationError } from '@domain/errors/FileStorageValidationError';
import { assertValidStorageKey } from '@domain/services/storage/fileStorageValidation';

interface LocalFileSidecarMeta {
  contentType: string;
  metadata?: Record<string, string>;
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}

export class LocalDiskFileStorage implements FileStoragePort {
  readonly driverName = 'local' as const;
  readonly baseDir: string;
  private readonly metaDir: string;

  constructor(baseDir?: string) {
    const configured = baseDir ?? process.env.FILE_STORAGE_LOCAL_DIR;
    this.baseDir = path.resolve(configured || path.resolve(process.cwd(), 'storage', 'files'));
    this.metaDir = path.join(this.baseDir, '.metadata');
  }

  private resolveSafeDataPath(key: string): { validKey: string; filePath: string; metaPath: string } {
    const validKey = assertValidStorageKey(key);
    const segments = validKey.split('/');
    const filePath = path.resolve(this.baseDir, ...segments);
    const metaPath = path.resolve(this.metaDir, ...segments) + '.json';

    const basePrefix = this.baseDir.endsWith(path.sep) ? this.baseDir : `${this.baseDir}${path.sep}`;
    const metaPrefix = this.metaDir.endsWith(path.sep) ? this.metaDir : `${this.metaDir}${path.sep}`;
    if (!filePath.startsWith(basePrefix) || !metaPath.startsWith(metaPrefix)) {
      throw new FileStorageValidationError(
        'PATH_TRAVERSAL',
        `Chemin résolu hors du répertoire de stockage autorisé pour la clé "${key}".`,
      );
    }

    return { validKey, filePath, metaPath };
  }

  async put(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: FileStorageMetadata,
  ): Promise<StoredFileObject> {
    const { validKey, filePath, metaPath } = this.resolveSafeDataPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);

    const sidecar: LocalFileSidecarMeta = {
      contentType,
      ...(metadata ? { metadata: { ...metadata } } : {}),
    };
    await mkdir(path.dirname(metaPath), { recursive: true });
    await writeFile(metaPath, JSON.stringify(sidecar), 'utf8');

    return {
      key: validKey,
      size: buffer.length,
      contentType,
      metadata,
    };
  }

  async get(key: string): Promise<FileStorageReadResult | null> {
    const { filePath, metaPath } = this.resolveSafeDataPath(key);
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch (err) {
      if (isEnoent(err)) return null;
      throw err;
    }

    let contentType: string | undefined;
    let metadata: FileStorageMetadata | undefined;
    try {
      const rawMeta = await readFile(metaPath, 'utf8');
      const parsed = JSON.parse(rawMeta) as Partial<LocalFileSidecarMeta>;
      if (typeof parsed.contentType === 'string') contentType = parsed.contentType;
      if (parsed.metadata && typeof parsed.metadata === 'object') {
        metadata = parsed.metadata;
      }
    } catch {
      // Métadonnées absentes (ex. fichier préexistant) : lecture binaire conservée
    }

    return { buffer, contentType, metadata };
  }

  async exists(key: string): Promise<boolean> {
    const { filePath } = this.resolveSafeDataPath(key);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const { filePath, metaPath } = this.resolveSafeDataPath(key);
    await Promise.all([
      unlink(filePath).catch((err) => {
        if (!isEnoent(err)) throw err;
      }),
      unlink(metaPath).catch((err) => {
        if (!isEnoent(err)) throw err;
      }),
    ]);
  }
}
