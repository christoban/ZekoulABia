/**
 * DOMAIN LAYER — Erreur métier de validation / sécurité du stockage de fichiers
 */

export type FileStorageErrorCode =
  | 'INVALID_STORAGE_KEY'
  | 'PATH_TRAVERSAL'
  | 'TENANT_ISOLATION_VIOLATION'
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_SIGNATURE'
  | 'UNSUPPORTED_EXTENSION'
  | 'IMAGE_DIMENSIONS_EXCEEDED';

export class FileStorageValidationError extends Error {
  readonly code: FileStorageErrorCode;

  constructor(code: FileStorageErrorCode, message: string) {
    super(message);
    this.name = 'FileStorageValidationError';
    this.code = code;
  }
}

