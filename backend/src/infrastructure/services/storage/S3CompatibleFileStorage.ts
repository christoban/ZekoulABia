/**
 * INFRASTRUCTURE LAYER — Adaptateur S3-compatible pour FileStoragePort
 *
 * Compatible tout stockage objet S3 (Cloudflare R2, MinIO sur VPS, AWS S3, Scaleway, B2)
 * via `@aws-sdk/client-s3`. Aucun fournisseur n'est codé en dur.
 *
 * Variables d'environnement :
 *   FILE_STORAGE_DRIVER=s3
 *   FILE_STORAGE_S3_BUCKET (repli BULLETIN_S3_BUCKET / R2_BUCKET_NAME)
 *   FILE_STORAGE_S3_ENDPOINT (optionnel ; repli BULLETIN_S3_ENDPOINT ou R2_ACCOUNT_ID)
 *   FILE_STORAGE_S3_REGION (défaut "auto")
 *   FILE_STORAGE_S3_ACCESS_KEY_ID (repli BULLETIN_S3_ACCESS_KEY_ID / R2_ACCESS_KEY_ID)
 *   FILE_STORAGE_S3_SECRET_ACCESS_KEY (repli BULLETIN_S3_SECRET_ACCESS_KEY / R2_SECRET_ACCESS_KEY)
 *   FILE_STORAGE_S3_PREFIX (optionnel)
 *   FILE_STORAGE_S3_FORCE_PATH_STYLE ("true" utile pour MinIO auto-hébergé)
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type {
  FileStorageMetadata,
  FileStoragePort,
  FileStorageReadResult,
  StoredFileObject,
} from '@domain/ports/services/FileStoragePort';
import { assertValidStorageKey } from '@domain/services/storage/fileStorageValidation';

export interface S3FileStorageConfig {
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix?: string;
  forcePathStyle?: boolean;
}

export function loadS3FileStorageConfigFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): S3FileStorageConfig {
  const bucket = (
    env.FILE_STORAGE_S3_BUCKET ||
    env.BULLETIN_S3_BUCKET ||
    env.R2_BUCKET_NAME ||
    ''
  ).trim();
  const accessKeyId = (
    env.FILE_STORAGE_S3_ACCESS_KEY_ID ||
    env.BULLETIN_S3_ACCESS_KEY_ID ||
    env.R2_ACCESS_KEY_ID ||
    ''
  ).trim();
  const secretAccessKey = (
    env.FILE_STORAGE_S3_SECRET_ACCESS_KEY ||
    env.BULLETIN_S3_SECRET_ACCESS_KEY ||
    env.R2_SECRET_ACCESS_KEY ||
    ''
  ).trim();
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const endpoint = (
    env.FILE_STORAGE_S3_ENDPOINT ||
    env.BULLETIN_S3_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
  ).trim() || undefined;
  const region = (env.FILE_STORAGE_S3_REGION || env.BULLETIN_S3_REGION || 'auto').trim();
  const keyPrefix = env.FILE_STORAGE_S3_PREFIX?.trim().replace(/^\/+|\/+$/g, '') || undefined;
  const forcePathStyle = (env.FILE_STORAGE_S3_FORCE_PATH_STYLE || '').trim().toLowerCase() === 'true';

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Configuration S3 incomplète : FILE_STORAGE_S3_BUCKET, FILE_STORAGE_S3_ACCESS_KEY_ID et FILE_STORAGE_S3_SECRET_ACCESS_KEY sont requis lorsque FILE_STORAGE_DRIVER=s3.',
    );
  }

  return { bucket, endpoint, region, accessKeyId, secretAccessKey, keyPrefix, forcePathStyle };
}

function isS3NotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e.name === 'NoSuchKey' ||
    e.name === 'NotFound' ||
    e.Code === 'NoSuchKey' ||
    e.Code === 'NotFound' ||
    e.$metadata?.httpStatusCode === 404
  );
}

function encodeS3Metadata(metadata?: FileStorageMetadata): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata)) {
    const cleanKey = k.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanKey && typeof v === 'string') {
      out[cleanKey] = encodeURIComponent(v);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function decodeS3Metadata(raw?: Record<string, string>): FileStorageMetadata | undefined {
  if (!raw || Object.keys(raw).length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

async function bodyToBuffer(body: unknown): Promise<Buffer | null> {
  if (!body) return null;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  if (Symbol.asyncIterator in (body as object)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return null;
}

export class S3CompatibleFileStorage implements FileStoragePort {
  readonly driverName = 's3' as const;
  private readonly cfg: S3FileStorageConfig;
  private readonly s3: S3Client;

  constructor(config?: S3FileStorageConfig, s3Client?: S3Client) {
    this.cfg = config ?? loadS3FileStorageConfigFromEnv();
    this.s3 =
      s3Client ??
      new S3Client({
        region: this.cfg.region,
        ...(this.cfg.endpoint ? { endpoint: this.cfg.endpoint } : {}),
        ...(this.cfg.forcePathStyle ? { forcePathStyle: true } : {}),
        credentials: {
          accessKeyId: this.cfg.accessKeyId,
          secretAccessKey: this.cfg.secretAccessKey,
        },
      });
  }

  private resolveObjectKey(key: string): { validKey: string; s3Key: string } {
    const validKey = assertValidStorageKey(key);
    const s3Key = this.cfg.keyPrefix ? `${this.cfg.keyPrefix}/${validKey}` : validKey;
    return { validKey, s3Key };
  }

  async put(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: FileStorageMetadata,
  ): Promise<StoredFileObject> {
    const { validKey, s3Key } = this.resolveObjectKey(key);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        Metadata: encodeS3Metadata(metadata),
      }),
    );
    return {
      key: validKey,
      size: buffer.length,
      contentType,
      metadata,
    };
  }

  async get(key: string): Promise<FileStorageReadResult | null> {
    const { s3Key } = this.resolveObjectKey(key);
    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.cfg.bucket,
          Key: s3Key,
        }),
      );
      const buffer = await bodyToBuffer(response.Body);
      if (!buffer) return null;
      return {
        buffer,
        contentType: response.ContentType,
        metadata: decodeS3Metadata(response.Metadata),
      };
    } catch (err) {
      if (isS3NotFoundError(err)) return null;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const { s3Key } = this.resolveObjectKey(key);
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.cfg.bucket,
          Key: s3Key,
        }),
      );
      return true;
    } catch (err) {
      if (isS3NotFoundError(err)) return false;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const { s3Key } = this.resolveObjectKey(key);
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.cfg.bucket,
          Key: s3Key,
        }),
      );
    } catch (err) {
      if (isS3NotFoundError(err)) return;
      throw err;
    }
  }
}

