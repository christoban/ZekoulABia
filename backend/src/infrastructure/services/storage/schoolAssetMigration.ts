/**
 * INFRASTRUCTURE LAYER — Moteur de migration idempotent des médias Data URI du kit d'identité
 * (`SchoolIdentityKit`) vers `FileStoragePort`.
 *
 * Garanties identiques à S3 (photos d'élèves) :
 * - exécutable uniquement sur la base locale (`assertLocalDatabaseUrl`) ;
 * - mode `--dry-run` par défaut ;
 * - validation stricte PNG/JPEG (octets magiques, <= 300 Ko, <= 1200×1200 px) ;
 * - clé déterministe SHA-256 (`{schoolId}/school-assets/{kind}-{sha256_12}.{png|jpg}`) -> idempotent ;
 * - relecture de vérification obligatoire (`fileStorage.get(key)` + SHA-256) avant toute mise à jour en base ;
 * - aucune suppression de fichier ni de colonne.
 */

import { createHash } from 'node:crypto';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import type { SchoolAssetKind } from '@domain/types/schoolAssets';
import {
  buildScopedStorageKey,
} from '@domain/services/storage/fileStorageValidation';
import { inspectSchoolAssetBuffer } from '@application/reportCard/bulletinStorageHelpers';
import { parseImageDataUri } from '@application/student/studentPhotoService';

export type SchoolIdentityAssetField =
  | 'logoAssetKey'
  | 'coatOfArmsAssetKey'
  | 'stampAssetKey'
  | 'principalSignatureAssetKey'
  | 'censorSignatureAssetKey';

export const SCHOOL_IDENTITY_ASSET_FIELDS: ReadonlyArray<{
  field: SchoolIdentityAssetField;
  kind: SchoolAssetKind;
}> = [
  { field: 'logoAssetKey', kind: 'logo' },
  { field: 'coatOfArmsAssetKey', kind: 'coatOfArms' },
  { field: 'stampAssetKey', kind: 'stamp' },
  { field: 'principalSignatureAssetKey', kind: 'principalSignature' },
  { field: 'censorSignatureAssetKey', kind: 'censorSignature' },
];

export interface SchoolIdentityKitMigrationCandidate {
  kitId: string;
  schoolId: string;
  logoAssetKey: string | null;
  coatOfArmsAssetKey: string | null;
  stampAssetKey: string | null;
  principalSignatureAssetKey: string | null;
  censorSignatureAssetKey: string | null;
}

export interface SchoolAssetMigrationLogEntry {
  kitId: string;
  schoolId: string;
  field: SchoolIdentityAssetField;
  kind: SchoolAssetKind;
  action: 'DRY_RUN_WOULD_MIGRATE' | 'MIGRATED' | 'COPIED_ONLY' | 'SKIPPED_ALREADY_MIGRATED' | 'SKIPPED_EMPTY' | 'FAILED';
  storageKey?: string;
  bytes?: number;
  width?: number;
  height?: number;
  sha256?: string;
  reason?: string;
}

export interface SchoolAssetMigrationSummary {
  dryRun: boolean;
  copyOnly: boolean;
  scannedSlots: number;
  eligible: number;
  migrated: number;
  copiedOnly: number;
  skippedEmpty: number;
  skippedAlreadyMigrated: number;
  failed: number;
  entries: SchoolAssetMigrationLogEntry[];
}

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function migrateSchoolAssetsBase64(params: {
  candidates: readonly SchoolIdentityKitMigrationCandidate[];
  fileStorage: FileStoragePort;
  updateKitAssetField: (kitId: string, field: SchoolIdentityAssetField, storageKey: string) => Promise<void>;
  dryRun?: boolean;
  copyOnly?: boolean;
  logger?: (entry: SchoolAssetMigrationLogEntry) => void;
}): Promise<SchoolAssetMigrationSummary> {
  const dryRun = params.dryRun ?? true;
  const copyOnly = params.copyOnly ?? false;
  const summary: SchoolAssetMigrationSummary = {
    dryRun,
    copyOnly,
    scannedSlots: 0,
    eligible: 0,
    migrated: 0,
    copiedOnly: 0,
    skippedEmpty: 0,
    skippedAlreadyMigrated: 0,
    failed: 0,
    entries: [],
  };

  const record = (entry: SchoolAssetMigrationLogEntry) => {
    summary.entries.push(entry);
    params.logger?.(entry);
  };

  for (const kit of params.candidates) {
    for (const { field, kind } of SCHOOL_IDENTITY_ASSET_FIELDS) {
      summary.scannedSlots++;
      const raw = kit[field]?.trim() ?? '';

      if (!raw) {
        summary.skippedEmpty++;
        record({ kitId: kit.kitId, schoolId: kit.schoolId, field, kind, action: 'SKIPPED_EMPTY' });
        continue;
      }

      if (!raw.startsWith('data:image/')) {
        summary.skippedAlreadyMigrated++;
        record({
          kitId: kit.kitId,
          schoolId: kit.schoolId,
          field,
          kind,
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

        // Validation stricte PNG/JPEG (octets magiques, <= 300 Ko, <= 1200×1200 px)
        const info = inspectSchoolAssetBuffer(parsed.buffer);
        const hash = sha256Hex(parsed.buffer);
        const ext = info.mimeType === 'image/png' ? '.png' : '.jpg';
        const storageKey = buildScopedStorageKey({
          schoolId: kit.schoolId,
          domain: 'school-assets',
          fileId: `${kind}-${hash.slice(0, 12)}`,
          extension: ext,
        });

        if (dryRun) {
          record({
            kitId: kit.kitId,
            schoolId: kit.schoolId,
            field,
            kind,
            action: 'DRY_RUN_WOULD_MIGRATE',
            storageKey,
            bytes: parsed.buffer.length,
            width: info.width,
            height: info.height,
            sha256: hash,
          });
          continue;
        }

        const alreadyStored = await params.fileStorage.exists(storageKey);
        if (!alreadyStored) {
          await params.fileStorage.put(storageKey, parsed.buffer, info.mimeType, {
            schoolId: kit.schoolId,
            kind,
            width: String(info.width),
            height: String(info.height),
            migratedFrom: 'base64-db',
            sha256: hash,
          });
        }

        // Relecture de vérification obligatoire avant toute modification de la colonne en base
        const readBack = await params.fileStorage.get(storageKey);
        if (!readBack || !readBack.buffer.equals(parsed.buffer) || sha256Hex(readBack.buffer) !== hash) {
          throw new Error(
            `Échec de la relecture de vérification pour ${storageKey} : valeur d'origine conservée intacte en base.`,
          );
        }

        if (copyOnly) {
          summary.copiedOnly++;
          record({
            kitId: kit.kitId,
            schoolId: kit.schoolId,
            field,
            kind,
            action: 'COPIED_ONLY',
            storageKey,
            bytes: parsed.buffer.length,
            width: info.width,
            height: info.height,
            sha256: hash,
          });
          continue;
        }

        await params.updateKitAssetField(kit.kitId, field, storageKey);
        summary.migrated++;
        record({
          kitId: kit.kitId,
          schoolId: kit.schoolId,
          field,
          kind,
          action: 'MIGRATED',
          storageKey,
          bytes: parsed.buffer.length,
          width: info.width,
          height: info.height,
          sha256: hash,
        });
      } catch (err) {
        summary.failed++;
        record({
          kitId: kit.kitId,
          schoolId: kit.schoolId,
          field,
          kind,
          action: 'FAILED',
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return summary;
}

