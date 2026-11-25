/**
 * DOMAIN LAYER — Port unique de stockage de fichiers multi-tenant (FileStoragePort)
 *
 * Aucune URL publique n'est exposée par ce port : tout accès aux fichiers transite
 * obligatoirement par un endpoint applicatif authentifié qui vérifie le JWT,
 * le schoolId et les permissions RBAC.
 *
 * Convention de clé obligatoire :
 *   {schoolId}/{domaine}/{uuid}.{ext}
 * (ou sous-segments validés sous {schoolId}/{domaine}/... pour les clés déterministes).
 * Le nom de fichier fourni par l'utilisateur n'apparaît jamais dans la clé ; il est
 * conservé uniquement dans `metadata.originalName`.
 */

export type FileStorageDriverName = 'local' | 's3';

export type FileStorageMetadata = Readonly<Record<string, string>>;

export interface StoredFileObject {
  key: string;
  size: number;
  contentType: string;
  metadata?: FileStorageMetadata;
}

export interface FileStorageReadResult {
  buffer: Buffer;
  contentType?: string;
  metadata?: FileStorageMetadata;
}

export interface FileStoragePort {
  readonly driverName: FileStorageDriverName;

  put(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: FileStorageMetadata,
  ): Promise<StoredFileObject>;

  get(key: string): Promise<FileStorageReadResult | null>;

  exists(key: string): Promise<boolean>;

  delete(key: string): Promise<void>;
}

