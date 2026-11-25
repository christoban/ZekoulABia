/**
 * APPLICATION LAYER — Service unifié des photos d'élèves (FileStoragePort + rétrocompatibilité Data URI)
 *
 * Source unique de vérité pour :
 * - stocker les nouvelles photos d'élèves via FileStoragePort ({schoolId}/student-photos/{uuid}.{ext}) ;
 * - exposer une URL HTTP authentifiée (/api/v2/students/:id/photo) pour les clés stockées tout en
 *   conservant intacts les anciens Data URI `data:image/...` et les URL http(s) ;
 * - résoudre les octets binaires d'une photo (stockage OU Data URI hérité) pour les cartes scolaires,
 *   bulletins et documents PDF.
 */

import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import {
  assertKeyBelongsToSchool,
  buildScopedStorageKey,
  detectMimeTypeByMagicBytes,
  validateUploadedFileForDomain,
} from '@domain/services/storage/fileStorageValidation';

export interface ParsedDataUriImage {
  buffer: Buffer;
  declaredMime: string;
}

export function parseImageDataUri(raw: string | null | undefined): ParsedDataUriImage | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('data:image/')) return null;
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return null;
  const header = trimmed.slice(5, commaIdx);
  const semicolonIdx = header.indexOf(';');
  const declaredMime = (semicolonIdx === -1 ? header : header.slice(0, semicolonIdx)).trim().toLowerCase();
  const payload = trimmed.slice(commaIdx + 1).trim();
  if (!payload) return null;
  try {
    const buffer = Buffer.from(payload, 'base64');
    if (buffer.length === 0) return null;
    return { buffer, declaredMime };
  } catch {
    return null;
  }
}

export function isStudentPhotoStorageKey(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/api/')
  ) {
    return false;
  }
  return true;
}

export function toStudentPhotoApiUrl(
  photoUrl: string | null | undefined,
  studentUserId: string,
): string | null {
  if (!photoUrl || typeof photoUrl !== 'string') return null;
  const trimmed = photoUrl.trim();
  if (!trimmed) return null;
  if (!isStudentPhotoStorageKey(trimmed)) {
    return trimmed;
  }
  return `/api/v2/students/${encodeURIComponent(studentUserId)}/photo`;
}

export async function storeStudentPhoto(params: {
  schoolId: string;
  studentUserId: string;
  uploadedBy: string;
  fileStorage: FileStoragePort;
  buffer: Buffer;
  originalName?: string | null;
  declaredMime?: string | null;
}): Promise<{ storageKey: string; mimeType: string; size: number }> {
  const validated = validateUploadedFileForDomain({
    domain: 'student-photos',
    buffer: params.buffer,
    originalName: params.originalName ?? 'student-photo',
    declaredMime: params.declaredMime,
  });

  const storageKey = buildScopedStorageKey({
    schoolId: params.schoolId,
    domain: 'student-photos',
    extension: validated.extension,
  });

  await params.fileStorage.put(storageKey, params.buffer, validated.mimeType, {
    originalName: validated.originalName,
    studentUserId: params.studentUserId,
    uploadedBy: params.uploadedBy,
  });

  return {
    storageKey,
    mimeType: validated.mimeType,
    size: validated.size,
  };
}

export async function resolveStudentPhotoBuffer(params: {
  photoUrl: string | null | undefined;
  schoolId: string;
  fileStorage?: FileStoragePort;
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const raw = params.photoUrl?.trim();
  if (!raw) return null;

  // Rétrocompatibilité : Data URI Base64 existant en base
  if (raw.startsWith('data:image/')) {
    const parsed = parseImageDataUri(raw);
    if (!parsed) return null;
    const detected = detectMimeTypeByMagicBytes(parsed.buffer);
    return {
      buffer: parsed.buffer,
      mimeType: detected ?? parsed.declaredMime ?? 'image/jpeg',
    };
  }

  if (!isStudentPhotoStorageKey(raw) || !params.fileStorage) {
    return null;
  }

  let validKey: string;
  try {
    validKey = assertKeyBelongsToSchool(raw, params.schoolId);
  } catch {
    return null;
  }

  const stored = await params.fileStorage.get(validKey);
  if (!stored || stored.buffer.length === 0) {
    return null;
  }

  const mimeType =
    stored.contentType ??
    detectMimeTypeByMagicBytes(stored.buffer) ??
    'image/jpeg';

  return { buffer: stored.buffer, mimeType };
}
