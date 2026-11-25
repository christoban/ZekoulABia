/**
 * INFRASTRUCTURE LAYER — Helpers HTTP partagés pour FileStoragePort
 *
 * Centralise :
 * - la conversion des FileStorageValidationError en réponses HTTP 400/403 ;
 * - la validation multi-tenant des clés stockées avec 404 propre sur les chemins
 *   hérités du disque éphémère (avant migration FileStoragePort) ;
 * - l'envoi sécurisé d'un Buffer avec en-têtes Content-Type, Content-Disposition et nosniff.
 */

import type { Response } from 'express';
import { FileStorageValidationError } from '@domain/errors/FileStorageValidationError';
import { assertKeyBelongsToSchool } from '@domain/services/storage/fileStorageValidation';

export function isLegacyDiskPath(rawKey: string, schoolId: string): boolean {
  const trimmed = rawKey.trim();
  if (trimmed.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return true;
  }
  if (trimmed.startsWith(`schools/${schoolId}/`) || trimmed.startsWith(`schools\\${schoolId}\\`)) {
    return true;
  }
  if (trimmed.startsWith('storage/') || trimmed.startsWith('storage\\') || trimmed.startsWith('uploads/') || trimmed.startsWith('uploads\\')) {
    return true;
  }
  return false;
}

export function resolveScopedStorageKeyOrRespond(
  res: Response,
  rawKey: string,
  schoolId: string,
  legacyMessage = 'Fichier indisponible (pièce antérieure expirée ou non conservée).',
): string | null {
  if (isLegacyDiskPath(rawKey, schoolId)) {
    res.status(404).json({ success: false, message: legacyMessage });
    return null;
  }
  try {
    return assertKeyBelongsToSchool(rawKey, schoolId);
  } catch (err) {
    if (err instanceof FileStorageValidationError && err.code === 'TENANT_ISOLATION_VIOLATION') {
      res.status(403).json({ success: false, message: 'Accès refusé : ressource appartenant à un autre établissement.' });
      return null;
    }
    res.status(404).json({ success: false, message: legacyMessage });
    return null;
  }
}

export function respondFileStorageValidationError(
  res: Response,
  err: unknown,
  overrides?: { invalidFormatMessage?: string; tooLargeMessage?: string },
): boolean {
  if (!(err instanceof FileStorageValidationError)) {
    return false;
  }
  if (err.code === 'TENANT_ISOLATION_VIOLATION') {
    res.status(403).json({ success: false, message: err.message });
    return true;
  }
  if (err.code === 'FILE_TOO_LARGE' && overrides?.tooLargeMessage) {
    res.status(400).json({ success: false, message: overrides.tooLargeMessage });
    return true;
  }
  if ((err.code === 'INVALID_FILE_SIGNATURE' || err.code === 'UNSUPPORTED_EXTENSION') && overrides?.invalidFormatMessage) {
    res.status(400).json({ success: false, message: overrides.invalidFormatMessage });
    return true;
  }
  res.status(400).json({ success: false, message: err.message });
  return true;
}

export function sendStoredFileResponse(
  res: Response,
  opts: {
    buffer: Buffer;
    contentType: string;
    filename: string;
    disposition?: 'inline' | 'attachment';
  },
): void {
  const disposition = opts.disposition ?? 'inline';
  res.setHeader('Content-Type', opts.contentType);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(opts.filename)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(opts.buffer);
}
