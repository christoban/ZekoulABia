/**
 * DOMAIN LAYER — Validation des fichiers, octets magiques et conventions de clés multi-tenant
 *
 * Source unique de vérité pour :
 * - la prévention du path traversal et l'isolation stricte par `schoolId` ;
 * - la génération de clés sûres `{schoolId}/{domaine}/{uuid}.{ext}` (jamais le nom utilisateur) ;
 * - la liste blanche d'extensions et types MIME vérifiés par signature binaire (magic bytes) ;
 * - les limites de taille et dimensions d'image par domaine métier.
 */

import { FileStorageValidationError } from '@domain/errors/FileStorageValidationError';

export type FileStorageDomain =
  | 'babillard'
  | 'enrollment-pieces'
  | 'apee-justificatifs'
  | 'hr-documents'
  | 'student-photos'
  | 'school-assets'
  | 'bulletins'
  | 'statistical-submissions'
  | 'minedub-reports'
  | 'school-backups';

export type AllowedMimeType =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/json';

export interface FileDomainPolicy {
  readonly maxBytes: number;
  readonly allowedMimes: readonly AllowedMimeType[];
  readonly allowedExtensions: readonly string[];
  readonly maxImageDimension?: number;
}

export const FILE_DOMAIN_POLICIES: Readonly<Record<FileStorageDomain, FileDomainPolicy>> = Object.freeze({
  babillard: {
    maxBytes: 10 * 1024 * 1024,
    allowedMimes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
  },
  'enrollment-pieces': {
    maxBytes: 5 * 1024 * 1024,
    allowedMimes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
  },
  'apee-justificatifs': {
    maxBytes: 8 * 1024 * 1024,
    allowedMimes: ['application/pdf', 'image/png', 'image/jpeg'],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg'],
  },
  'hr-documents': {
    maxBytes: 8 * 1024 * 1024,
    allowedMimes: ['application/pdf', 'image/png', 'image/jpeg'],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg'],
  },
  'student-photos': {
    maxBytes: 3 * 1024 * 1024,
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
  },
  'school-assets': {
    maxBytes: 300 * 1024,
    allowedMimes: ['image/png', 'image/jpeg'],
    allowedExtensions: ['.png', '.jpg', '.jpeg'],
    maxImageDimension: 1200,
  },
  bulletins: {
    maxBytes: 15 * 1024 * 1024,
    allowedMimes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
  },
  'statistical-submissions': {
    maxBytes: 25 * 1024 * 1024,
    allowedMimes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    allowedExtensions: ['.xls', '.xlsx'],
  },
  'minedub-reports': {
    maxBytes: 10 * 1024 * 1024,
    allowedMimes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
  },
  'school-backups': {
    maxBytes: 50 * 1024 * 1024,
    allowedMimes: ['application/json'],
    allowedExtensions: ['.json'],
  },
});

const MIME_TO_CANONICAL_EXT: Readonly<Record<AllowedMimeType, string>> = Object.freeze({
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/json': '.json',
});

const MIME_TO_COMPATIBLE_EXTS: Readonly<Record<AllowedMimeType, readonly string[]>> = Object.freeze({
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/json': ['.json'],
});

const SAFE_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_SCHOOL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function assertValidStorageKey(rawKey: string): string {
  if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
    throw new FileStorageValidationError('INVALID_STORAGE_KEY', 'Clé de stockage vide.');
  }
  const key = rawKey.trim();
  if (
    key.includes('\0') ||
    key.includes('\\') ||
    key.startsWith('/') ||
    key.endsWith('/') ||
    /^[a-zA-Z]+:/.test(key) ||
    key.includes('..') ||
    /[\x00-\x1f\x7f]/.test(key)
  ) {
    throw new FileStorageValidationError(
      'PATH_TRAVERSAL',
      `Clé de stockage invalide ou tentative de traversée de chemin : "${rawKey}"`,
    );
  }

  const segments = key.split('/');
  if (segments.length < 3) {
    throw new FileStorageValidationError(
      'INVALID_STORAGE_KEY',
      'La clé de stockage doit respecter le format "{schoolId}/{domaine}/{fichier}".',
    );
  }

  if (!SAFE_SCHOOL_ID_RE.test(segments[0]!)) {
    throw new FileStorageValidationError(
      'PATH_TRAVERSAL',
      `Identifiant établissement invalide dans la clé de stockage : "${segments[0]}"`,
    );
  }

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]!;
    if (!seg || seg === '.' || seg === '..' || !SAFE_SEGMENT_RE.test(seg)) {
      throw new FileStorageValidationError(
        'PATH_TRAVERSAL',
        `Segment de clé de stockage invalide : "${seg}"`,
      );
    }
  }

  return key;
}

export function extractSchoolIdFromStorageKey(key: string): string {
  const valid = assertValidStorageKey(key);
  return valid.split('/')[0]!;
}

export function assertKeyBelongsToSchool(key: string, expectedSchoolId: string): string {
  const valid = assertValidStorageKey(key);
  const cleanSchoolId = expectedSchoolId.trim();
  if (!SAFE_SCHOOL_ID_RE.test(cleanSchoolId)) {
    throw new FileStorageValidationError('TENANT_ISOLATION_VIOLATION', 'schoolId attendu invalide.');
  }
  const ownerSchoolId = valid.split('/')[0]!;
  if (ownerSchoolId !== cleanSchoolId) {
    throw new FileStorageValidationError(
      'TENANT_ISOLATION_VIOLATION',
      'Accès refusé : la clé de stockage appartient à un autre établissement.',
    );
  }
  return valid;
}

export function buildScopedStorageKey(params: {
  schoolId: string;
  domain: FileStorageDomain;
  extension: string;
  subSegments?: readonly string[];
  fileId?: string;
}): string {
  const cleanSchool = params.schoolId.trim();
  if (!SAFE_SCHOOL_ID_RE.test(cleanSchool)) {
    throw new FileStorageValidationError('PATH_TRAVERSAL', 'schoolId invalide pour la génération de clé.');
  }
  const cleanExt = params.extension.startsWith('.')
    ? params.extension.toLowerCase()
    : `.${params.extension.toLowerCase()}`;
  if (!/^\.[a-z0-9]{1,8}$/.test(cleanExt)) {
    throw new FileStorageValidationError('UNSUPPORTED_EXTENSION', `Extension invalide : "${params.extension}"`);
  }
  const id = params.fileId?.trim() || crypto.randomUUID();
  const segments = [cleanSchool, params.domain, ...(params.subSegments ?? []), `${id}${cleanExt}`];
  return assertValidStorageKey(segments.join('/'));
}

export function sanitizeOriginalFileName(rawName?: string | null): string {
  if (!rawName) return 'fichier';
  const base = rawName.split(/[\\/]/).pop() ?? 'fichier';
  const cleaned = base.replace(/[\x00-\x1f\x7f"]/g, '').trim();
  return cleaned.slice(0, 180) || 'fichier';
}

export function detectMimeTypeByMagicBytes(buffer: Buffer, allowJson = false): AllowedMimeType | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // PDF : %PDF-
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG : FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP : RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // XLS (OLE2 Compound Binary) : D0 CF 11 E0 A1 B1 1A E1
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 && buffer[5] === 0xb1 && buffer[6] === 0x1a && buffer[7] === 0xe1
  ) {
    return 'application/vnd.ms-excel';
  }

  // XLSX (ZIP OOXML) : PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  if (allowJson) {
    const trimmed = buffer.toString('utf8').trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'application/json';
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function extractPngOrJpegDimensions(
  buffer: Buffer,
  mime: 'image/png' | 'image/jpeg',
): { width: number; height: number } | null {
  if (mime === 'image/png') {
    if (buffer.length < 24) return null;
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segLen = buffer.readUInt16BE(offset + 2);
    if (segLen < 2 || offset + 2 + segLen > buffer.length) return null;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && offset + 9 <= buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segLen;
  }
  return null;
}

export interface ValidatedFileUpload {
  mimeType: AllowedMimeType;
  extension: string;
  size: number;
  originalName: string;
  width?: number;
  height?: number;
}

export function validateUploadedFileForDomain(params: {
  domain: FileStorageDomain;
  buffer: Buffer;
  originalName?: string | null;
  declaredMime?: string | null;
}): ValidatedFileUpload {
  const policy = FILE_DOMAIN_POLICIES[params.domain];
  if (!params.buffer || params.buffer.length === 0) {
    throw new FileStorageValidationError('EMPTY_FILE', 'Le fichier fourni est vide.');
  }
  if (params.buffer.length > policy.maxBytes) {
    const maxKb = Math.round(policy.maxBytes / 1024);
    throw new FileStorageValidationError(
      'FILE_TOO_LARGE',
      `Fichier trop volumineux (${Math.round(params.buffer.length / 1024)} Ko > plafond autorisé ${maxKb} Ko pour ${params.domain}).`,
    );
  }

  const allowJson = policy.allowedMimes.includes('application/json');
  const detectedMime = detectMimeTypeByMagicBytes(params.buffer, allowJson);
  if (!detectedMime || !policy.allowedMimes.includes(detectedMime)) {
    throw new FileStorageValidationError(
      'INVALID_FILE_SIGNATURE',
      `Signature binaire non autorisée pour le domaine ${params.domain}.`,
    );
  }

  const originalName = sanitizeOriginalFileName(params.originalName);
  const dotIdx = originalName.lastIndexOf('.');
  if (dotIdx > 0 && dotIdx < originalName.length - 1) {
    const declaredExt = originalName.slice(dotIdx).toLowerCase();
    if (!policy.allowedExtensions.includes(declaredExt)) {
      throw new FileStorageValidationError(
        'UNSUPPORTED_EXTENSION',
        `Extension "${declaredExt}" non autorisée pour le domaine ${params.domain}.`,
      );
    }
    const compatibleExts = MIME_TO_COMPATIBLE_EXTS[detectedMime];
    if (!compatibleExts.includes(declaredExt)) {
      throw new FileStorageValidationError(
        'INVALID_FILE_SIGNATURE',
        `Extension "${declaredExt}" incohérente avec le contenu binaire détecté (${detectedMime}).`,
      );
    }
  }

  let width: number | undefined;
  let height: number | undefined;
  if (policy.maxImageDimension && (detectedMime === 'image/png' || detectedMime === 'image/jpeg')) {
    const dims = extractPngOrJpegDimensions(params.buffer, detectedMime);
    if (!dims || dims.width < 1 || dims.height < 1) {
      throw new FileStorageValidationError('INVALID_FILE_SIGNATURE', 'Impossible de lire les dimensions de l’image.');
    }
    if (dims.width > policy.maxImageDimension || dims.height > policy.maxImageDimension) {
      throw new FileStorageValidationError(
        'IMAGE_DIMENSIONS_EXCEEDED',
        `Dimensions d'image excessives (${dims.width}×${dims.height}px > max ${policy.maxImageDimension}×${policy.maxImageDimension}px).`,
      );
    }
    width = dims.width;
    height = dims.height;
  }

  return {
    mimeType: detectedMime,
    extension: MIME_TO_CANONICAL_EXT[detectedMime],
    size: params.buffer.length,
    originalName,
    width,
    height,
  };
}

