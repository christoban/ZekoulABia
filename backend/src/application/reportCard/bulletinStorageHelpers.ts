/**
 * APPLICATION LAYER — Helpers unifiés de stockage pour les bulletins PDF scellés et le kit d'identité
 *
 * Remplace les anciens ports temporaires `BulletinPdfStoragePort` et `SchoolAssetStoragePort` :
 * toutes les lectures/écritures passent exclusivement par le port unique `FileStoragePort`.
 */

import { createHash } from 'node:crypto';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import { FileStorageValidationError } from '@domain/errors/FileStorageValidationError';
import { SchoolAssetValidationError } from '@domain/errors/SchoolAssetValidationError';
import {
  assertKeyBelongsToSchool,
  assertValidStorageKey,
  buildScopedStorageKey,
  validateUploadedFileForDomain,
} from '@domain/services/storage/fileStorageValidation';
import {
  MAX_SCHOOL_ASSET_BYTES,
  MAX_SCHOOL_ASSET_DIMENSION,
  type SchoolAssetKind,
  type ValidatedSchoolAsset,
} from '@domain/types/schoolAssets';

export function buildBulletinPdfStorageKey(params: {
  schoolId: string;
  academicPeriodId: string;
  bulletinId: string;
  templateVersion?: number;
}): string {
  const safePeriod = params.academicPeriodId.replace(/[^A-Za-z0-9._-]/g, '_');
  const safeBulletin = params.bulletinId.replace(/[^A-Za-z0-9._-]/g, '_');
  const version = params.templateVersion ?? 1;
  return buildScopedStorageKey({
    schoolId: params.schoolId,
    domain: 'bulletins',
    subSegments: [safePeriod],
    fileId: `${safeBulletin}_v${version}`,
    extension: '.pdf',
  });
}

export async function readSealedBulletinPdf(params: {
  fileStorage?: FileStoragePort;
  pdfUrl?: string | null;
  schoolId: string;
}): Promise<Buffer | null> {
  if (!params.fileStorage || !params.pdfUrl) return null;
  let validKey: string;
  try {
    validKey = assertKeyBelongsToSchool(params.pdfUrl, params.schoolId);
  } catch {
    // Ancienne clé factice ("bulletins/{schoolId}/{id}.pdf") ou format hérité => re-génération depuis snapshotData
    return null;
  }
  const stored = await params.fileStorage.get(validKey);
  if (!stored || stored.buffer.length === 0) return null;
  return stored.buffer;
}

export async function storeSealedBulletinPdf(params: {
  fileStorage: FileStoragePort;
  schoolId: string;
  academicPeriodId: string;
  bulletinId: string;
  templateVersion?: number;
  existingKey?: string | null;
  pdfBuffer: Buffer;
}): Promise<string> {
  let targetKey: string | null = null;
  if (params.existingKey) {
    try {
      targetKey = assertKeyBelongsToSchool(params.existingKey, params.schoolId);
    } catch {
      targetKey = null;
    }
  }
  const key =
    targetKey ??
    buildBulletinPdfStorageKey({
      schoolId: params.schoolId,
      academicPeriodId: params.academicPeriodId,
      bulletinId: params.bulletinId,
      templateVersion: params.templateVersion,
    });

  await params.fileStorage.put(key, params.pdfBuffer, 'application/pdf', {
    schoolId: params.schoolId,
    academicPeriodId: params.academicPeriodId,
    bulletinId: params.bulletinId,
    templateVersion: String(params.templateVersion ?? 1),
  });
  return key;
}

function decodeSchoolAssetInput(data: Buffer | string): Buffer {
  if (Buffer.isBuffer(data)) return data;
  const trimmed = data.trim();
  const m = /^data:(image\/png|image\/jpeg|image\/jpg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (!m) {
    throw new SchoolAssetValidationError(
      'Source image invalide : fournir un Buffer PNG/JPEG ou un data-URI base64 PNG/JPEG.',
    );
  }
  return Buffer.from(m[2]!.replace(/\s+/g, ''), 'base64');
}

export function inspectSchoolAssetBuffer(buf: Buffer): {
  mimeType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
} {
  try {
    const validated = validateUploadedFileForDomain({
      domain: 'school-assets',
      buffer: buf,
      originalName: 'school-asset',
    });
    if (validated.mimeType !== 'image/png' && validated.mimeType !== 'image/jpeg') {
      throw new SchoolAssetValidationError('Format image non autorisé : seuls PNG et JPEG valides sont acceptés.');
    }
    if (!validated.width || !validated.height) {
      throw new SchoolAssetValidationError('Impossible de lire les dimensions de l’image.');
    }
    return {
      mimeType: validated.mimeType,
      width: validated.width,
      height: validated.height,
    };
  } catch (err) {
    if (err instanceof SchoolAssetValidationError) throw err;
    if (err instanceof FileStorageValidationError) {
      if (err.code === 'EMPTY_FILE') {
        throw new SchoolAssetValidationError('Fichier image vide.');
      }
      if (err.code === 'FILE_TOO_LARGE') {
        throw new SchoolAssetValidationError(
          `Taille d'image (${Math.ceil(buf.length / 1024)} Ko) supérieure au plafond autorisé de ${Math.round(MAX_SCHOOL_ASSET_BYTES / 1024)} Ko.`,
        );
      }
      if (err.code === 'IMAGE_DIMENSIONS_EXCEEDED') {
        throw new SchoolAssetValidationError(
          `Dimensions image invalides : maximum autorisé ${MAX_SCHOOL_ASSET_DIMENSION}×${MAX_SCHOOL_ASSET_DIMENSION} px.`,
        );
      }
      throw new SchoolAssetValidationError(
        'Format image non autorisé : seuls PNG et JPEG valides sont acceptés.',
      );
    }
    throw err;
  }
}

export async function validateAndStoreSchoolAsset(params: {
  fileStorage: FileStoragePort;
  schoolId: string;
  kind: SchoolAssetKind;
  data: Buffer | string;
}): Promise<ValidatedSchoolAsset> {
  const buf = decodeSchoolAssetInput(params.data);
  const info = inspectSchoolAssetBuffer(buf);
  const ext = info.mimeType === 'image/png' ? '.png' : '.jpg';
  const digest = createHash('sha256').update(buf).digest('hex').slice(0, 12);

  let assetKey: string;
  try {
    assetKey = buildScopedStorageKey({
      schoolId: params.schoolId,
      domain: 'school-assets',
      fileId: `${params.kind}-${digest}`,
      extension: ext,
    });
  } catch {
    throw new SchoolAssetValidationError('schoolId invalide.');
  }

  await params.fileStorage.put(assetKey, buf, info.mimeType, {
    schoolId: params.schoolId,
    kind: params.kind,
    width: String(info.width),
    height: String(info.height),
  });

  return {
    assetKey,
    mimeType: info.mimeType,
    byteSize: buf.length,
    width: info.width,
    height: info.height,
  };
}

export async function readSchoolAssetBuffer(params: {
  fileStorage?: FileStoragePort;
  schoolId?: string;
  assetKey: string | null | undefined;
}): Promise<Buffer | null> {
  const trimmed = params.assetKey?.trim();
  if (!trimmed) return null;

  // Rétrocompatibilité : média encore stocké en Data URI PNG/JPEG en base
  if (trimmed.startsWith('data:image/')) {
    try {
      const buf = decodeSchoolAssetInput(trimmed);
      inspectSchoolAssetBuffer(buf);
      return buf;
    } catch {
      return null;
    }
  }

  if (!params.fileStorage) return null;

  let validKey: string;
  try {
    validKey = params.schoolId
      ? assertKeyBelongsToSchool(trimmed, params.schoolId)
      : assertValidStorageKey(trimmed);
  } catch {
    return null;
  }

  const stored = await params.fileStorage.get(validKey);
  if (!stored || stored.buffer.length === 0) return null;
  return stored.buffer;
}
