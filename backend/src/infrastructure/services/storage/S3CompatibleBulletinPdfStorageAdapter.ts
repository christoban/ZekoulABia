/**
 * INFRASTRUCTURE LAYER — Adaptateur stockage objet compatible S3 pour BulletinPdfStoragePort
 *
 * Activé en production via variables d'environnement (`BULLETIN_STORAGE_DRIVER=s3` +
 * `BULLETIN_S3_BUCKET`, `BULLETIN_S3_ACCESS_KEY_ID`, `BULLETIN_S3_SECRET_ACCESS_KEY`,
 * optionnellement `BULLETIN_S3_ENDPOINT`, `BULLETIN_S3_REGION`).
 */
import path from 'node:path';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type {
  BulletinPdfStorageKeyInput,
  BulletinPdfStoragePort,
} from '@domain/ports/services/BulletinPdfStoragePort';
import { LocalDiskBulletinPdfStorageAdapter } from './LocalDiskBulletinPdfStorageAdapter';

export interface S3BulletinStorageConfig {
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix?: string;
}

function readS3ConfigFromEnv(): S3BulletinStorageConfig {
  const bucket = process.env.BULLETIN_S3_BUCKET || process.env.R2_BUCKET_NAME || '';
  const accessKeyId = process.env.BULLETIN_S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.BULLETIN_S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint =
    process.env.BULLETIN_S3_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const region = process.env.BULLETIN_S3_REGION || 'auto';
  const keyPrefix = process.env.BULLETIN_S3_PREFIX || 'bulletins';

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Configuration stockage objet S3 incomplète : BULLETIN_S3_BUCKET, BULLETIN_S3_ACCESS_KEY_ID et BULLETIN_S3_SECRET_ACCESS_KEY requis.',
    );
  }
  return { bucket, endpoint, region, accessKeyId, secretAccessKey, keyPrefix };
}

export class S3CompatibleBulletinPdfStorageAdapter implements BulletinPdfStoragePort {
  readonly driverName = 's3-compatible';
  private readonly cfg: S3BulletinStorageConfig;
  private readonly s3: S3Client;

  constructor(config?: S3BulletinStorageConfig, s3Client?: S3Client) {
    this.cfg = config ?? readS3ConfigFromEnv();
    this.s3 =
      s3Client ??
      new S3Client({
        region: this.cfg.region,
        ...(this.cfg.endpoint ? { endpoint: this.cfg.endpoint } : {}),
        credentials: {
          accessKeyId: this.cfg.accessKeyId,
          secretAccessKey: this.cfg.secretAccessKey,
        },
      });
  }

  buildStorageKey(input: BulletinPdfStorageKeyInput): string {
    const prefix = (this.cfg.keyPrefix ?? 'bulletins').replace(/^\/+|\/+$/g, '');
    return path.posix.join(
      prefix,
      'schools',
      input.schoolId,
      'periods',
      input.academicPeriodId,
      `${input.bulletinId}-v${input.templateVersion}.pdf`,
    );
  }

  async storePdf(key: string, pdfBuffer: Buffer): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }),
    );
    return key;
  }

  async readPdf(key: string): Promise<Buffer | null> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
      );
      if (!response.Body) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}

export function createBulletinPdfStorageAdapter(): BulletinPdfStoragePort {
  const driver = (process.env.BULLETIN_STORAGE_DRIVER || '').trim().toLowerCase();
  const hasExplicitS3Bucket = Boolean(process.env.BULLETIN_S3_BUCKET?.trim());
  if (driver === 's3' || (driver === '' && hasExplicitS3Bucket)) {
    return new S3CompatibleBulletinPdfStorageAdapter();
  }
  return new LocalDiskBulletinPdfStorageAdapter();
}
