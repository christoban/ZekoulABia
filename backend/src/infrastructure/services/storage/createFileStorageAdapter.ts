/**
 * INFRASTRUCTURE LAYER — Factory unique du stockage de fichiers (FileStoragePort)
 *
 * Sélectionne l'adaptateur actif via `FILE_STORAGE_DRIVER=local|s3`, journalise
 * le driver actif au démarrage et émet un avertissement explicite si `local` est
 * utilisé en production sans volume persistant déclaré (`FILE_STORAGE_PERSISTENT_VOLUME=true`).
 */

import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import { LocalDiskFileStorage } from './LocalDiskFileStorage';
import { S3CompatibleFileStorage, loadS3FileStorageConfigFromEnv } from './S3CompatibleFileStorage';

export interface FileStorageLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface CreateFileStorageOptions {
  env?: Readonly<Record<string, string | undefined>>;
  logger?: FileStorageLogger;
}

export function createFileStorageAdapter(options: CreateFileStorageOptions = {}): FileStoragePort {
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;
  const rawDriver = (env.FILE_STORAGE_DRIVER || 'local').trim().toLowerCase();

  if (rawDriver === 's3') {
    const cfg = loadS3FileStorageConfigFromEnv(env);
    logger.info(
      `[FileStorage] Driver actif : s3 (bucket=${cfg.bucket}, region=${cfg.region}${cfg.endpoint ? `, endpoint=${cfg.endpoint}` : ''})`,
    );
    return new S3CompatibleFileStorage(cfg);
  }

  if (rawDriver !== 'local') {
    throw new Error(
      `Valeur FILE_STORAGE_DRIVER invalide : "${rawDriver}". Valeurs attendues : "local" ou "s3".`,
    );
  }

  const adapter = new LocalDiskFileStorage(env.FILE_STORAGE_LOCAL_DIR);
  const isProd = (env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const hasPersistentVolume = (env.FILE_STORAGE_PERSISTENT_VOLUME || '').trim().toLowerCase() === 'true';

  logger.info(
    `[FileStorage] Driver actif : local (dir=${adapter.baseDir}, volumePersistant=${hasPersistentVolume})`,
  );

  if (isProd && !hasPersistentVolume) {
    logger.warn(
      '[FileStorage] ATTENTION : FILE_STORAGE_DRIVER=local actif en production sans FILE_STORAGE_PERSISTENT_VOLUME=true. Sur un conteneur éphémère (Railway), tous les fichiers seront perdus au prochain redéploiement. Configurez FILE_STORAGE_DRIVER=s3 ou montez un volume persistant avec FILE_STORAGE_PERSISTENT_VOLUME=true.',
    );
  }

  return adapter;
}

