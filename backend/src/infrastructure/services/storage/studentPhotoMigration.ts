/**
 * INFRASTRUCTURE LAYER — Moteur de migration idempotent des photos élèves Base64 → FileStoragePort
 *
 * Garanties de sécurité :
 * - exécutable uniquement sur une base PostgreSQL locale (`localhost` / `127.0.0.1` / `::1`) ;
 * - mode `--dry-run` activé par défaut (aucune écriture tant que `--apply` n'est pas explicite) ;
 * - idempotent : ignore les photos déjà migrées (ne commençant pas par `data:image/`) et utilise
 *   une clé déterministe dérivée du SHA-256 pour éviter tout doublon en stockage ;
 * - vérification par relecture obligatoire (`fileStorage.get(key)` + comparaison SHA-256 octet par octet)
 *   avant toute mise à jour de `StudentProfile.photoUrl` ;
 * - aucune suppression de fichier ni de colonne.
 */

import { createHash } from 'node:crypto';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import {
  buildScopedStorageKey,
  validateUploadedFileForDomain,
} from '@domain/services/storage/fileStorageValidation';
import { parseImageDataUri } from '@application/student/studentPhotoService';

export interface StudentPhotoMigrationCandidate {
  studentProfileId: string;
  studentUserId: string;
  schoolId: string;
  photoUrl: string | null;
}

export interface StudentPhotoMigrationLogEntry {
  studentProfileId: string;
  schoolId: string;
  action: 'DRY_RUN_WOULD_MIGRATE' | 'MIGRATED' | 'COPIED_ONLY' | 'SKIPPED_ALREADY_MIGRATED' | 'SKIPPED_EMPTY' | 'FAILED';
  storageKey?: string;
  bytes?: number;
  sha256?: string;
  reason?: string;
}

export interface StudentPhotoMigrationSummary {
  dryRun: boolean;
  copyOnly: boolean;
  scanned: number;
  eligible: number;
  migrated: number;
  copiedOnly: number;
  skippedEmpty: number;
  skippedAlreadyMigrated: number;
  failed: number;
  entries: StudentPhotoMigrationLogEntry[];
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function assertLocalDatabaseUrl(databaseUrl: string | undefined): { host: string; database: string } {
  if (!databaseUrl || !databaseUrl.trim()) {
    throw new Error('DATABASE_URL est absente — exécution refusée par sécurité.');
  }
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl.trim());
  } catch {
    throw new Error('DATABASE_URL invalide — impossible de vérifier la localité de la base.');
  }
  const host = parsed.hostname.toLowerCase();
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refus de sécurité : ce script est exécutable uniquement sur la base locale (localhost / 127.0.0.1 / ::1), hôte détecté : "${host}".`,
    );
  }
  const database = parsed.pathname.replace(/^\/+/, '') || '(défaut)';
  return { host, database };
}

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function migrateStudentPhotosBase64(params: {
  candidates: readonly StudentPhotoMigrationCandidate[];
  fileStorage: FileStoragePort;
  updateStudentPhotoUrl: (studentProfileId: string, storageKey: string) => Promise<void>;
  dryRun?: boolean;
  copyOnly?: boolean;
  logger?: (entry: StudentPhotoMigrationLogEntry) => void;
}): Promise<StudentPhotoMigrationSummary> {
  const dryRun = params.dryRun ?? true;
  const copyOnly = params.copyOnly ?? false;
  const summary: StudentPhotoMigrationSummary = {
    dryRun,
    copyOnly,
    scanned: 0,
    eligible: 0,
    migrated: 0,
    copiedOnly: 0,
    skippedEmpty: 0,
    skippedAlreadyMigrated: 0,
    failed: 0,
    entries: [],
  };

  const record = (entry: StudentPhotoMigrationLogEntry) => {
    summary.entries.push(entry);
    params.logger?.(entry);
  };

  for (const row of params.candidates) {
    summary.scanned++;
    const raw = row.photoUrl?.trim() ?? '';

    if (!raw) {
      summary.skippedEmpty++;
      record({ studentProfileId: row.studentProfileId, schoolId: row.schoolId, action: 'SKIPPED_EMPTY' });
      continue;
    }

    if (!raw.startsWith('data:image/')) {
      summary.skippedAlreadyMigrated++;
      record({
        studentProfileId: row.studentProfileId,
        schoolId: row.schoolId,
        action: 'SKIPPED_ALREADY_MIGRATED',
        storageKey: raw,
      });
      continue;
    }

    summary.eligible++;

    try {
      const parsed = parseImageDataUri(raw);
      if (!parsed) {
        throw new Error('Data URI Base64 illisible ou vide.');
      }

      const validated = validateUploadedFileForDomain({
        domain: 'student-photos',
        buffer: parsed.buffer,
        originalName: 'student-photo',
        declaredMime: parsed.declaredMime,
      });

      const hash = sha256Hex(parsed.buffer);
      const storageKey = buildScopedStorageKey({
        schoolId: row.schoolId,
        domain: 'student-photos',
        extension: validated.extension,
        fileId: hash.slice(0, 32),
      });

      if (dryRun) {
        record({
          studentProfileId: row.studentProfileId,
          schoolId: row.schoolId,
          action: 'DRY_RUN_WOULD_MIGRATE',
          storageKey,
          bytes: validated.size,
          sha256: hash,
        });
        continue;
      }

      // Idempotence stockage : ne réécrit pas si déjà présent et valide
      const alreadyStored = await params.fileStorage.exists(storageKey);
      if (!alreadyStored) {
        await params.fileStorage.put(storageKey, parsed.buffer, validated.mimeType, {
          studentProfileId: row.studentProfileId,
          studentUserId: row.studentUserId,
          migratedFrom: 'base64-db',
          sha256: hash,
        });
      }

      // Relecture de vérification obligatoire avant toute modification de la valeur en base
      const readBack = await params.fileStorage.get(storageKey);
      if (!readBack || !readBack.buffer.equals(parsed.buffer) || sha256Hex(readBack.buffer) !== hash) {
        throw new Error(
          `Échec de la relecture de vérification pour ${storageKey} : valeur d'origine conservée intacte en base.`,
        );
      }

      if (copyOnly) {
        summary.copiedOnly++;
        record({
          studentProfileId: row.studentProfileId,
          schoolId: row.schoolId,
          action: 'COPIED_ONLY',
          storageKey,
          bytes: validated.size,
          sha256: hash,
        });
        continue;
      }

      await params.updateStudentPhotoUrl(row.studentProfileId, storageKey);
      summary.migrated++;
      record({
        studentProfileId: row.studentProfileId,
        schoolId: row.schoolId,
        action: 'MIGRATED',
        storageKey,
        bytes: validated.size,
        sha256: hash,
      });
    } catch (err) {
      summary.failed++;
      record({
        studentProfileId: row.studentProfileId,
        schoolId: row.schoolId,
        action: 'FAILED',
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}

