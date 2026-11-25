/**
 * SCRIPT CLI — Migration des images Data URI du kit d'identité (`SchoolIdentityKit`) vers `FileStoragePort`
 *
 * Usage :
 *   bun run src/scripts/migrateSchoolAssetsToStorage.ts               # --dry-run (par défaut, aucune écriture)
 *   bun run src/scripts/migrateSchoolAssetsToStorage.ts --apply       # écrit dans FileStoragePort, vérifie par relecture, puis met à jour le kit
 *   bun run src/scripts/migrateSchoolAssetsToStorage.ts --apply --copy-only # copie & vérifie sans modifier les colonnes en base
 *
 * Sécurité :
 * - refuse catégoriquement de s'exécuter si DATABASE_URL ne pointe pas vers la base locale (localhost/127.0.0.1/::1).
 */

import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { createFileStorageAdapter } from '@infrastructure/services/storage/createFileStorageAdapter';
import { assertLocalDatabaseUrl } from '@infrastructure/services/storage/studentPhotoMigration';
import {
  migrateSchoolAssetsBase64,
  type SchoolIdentityAssetField,
} from '@infrastructure/services/storage/schoolAssetMigration';

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply') && !args.has('--dry-run');
  const copyOnly = args.has('--copy-only');

  const dbInfo = assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const fileStorage = createFileStorageAdapter();

  console.info(
    `[migrateSchoolAssets] Démarrage (mode=${apply ? (copyOnly ? 'APPLY_COPY_ONLY' : 'APPLY') : 'DRY_RUN'}, db=${dbInfo.host}/${dbInfo.database}, driver=${fileStorage.driverName})`,
  );

  try {
    const kits = await prisma.schoolIdentityKit.findMany({
      select: {
        id: true,
        schoolId: true,
        logoAssetKey: true,
        coatOfArmsAssetKey: true,
        stampAssetKey: true,
        principalSignatureAssetKey: true,
        censorSignatureAssetKey: true,
      },
    });

    const summary = await migrateSchoolAssetsBase64({
      candidates: kits.map((k) => ({
        kitId: k.id,
        schoolId: k.schoolId,
        logoAssetKey: k.logoAssetKey,
        coatOfArmsAssetKey: k.coatOfArmsAssetKey,
        stampAssetKey: k.stampAssetKey,
        principalSignatureAssetKey: k.principalSignatureAssetKey,
        censorSignatureAssetKey: k.censorSignatureAssetKey,
      })),
      fileStorage,
      dryRun: !apply,
      copyOnly,
      updateKitAssetField: async (kitId: string, field: SchoolIdentityAssetField, storageKey: string) => {
        await prisma.schoolIdentityKit.update({
          where: { id: kitId },
          data: { [field]: storageKey },
        });
      },
      logger: (entry) => {
        console.info(`[migrateSchoolAssets] ${JSON.stringify(entry)}`);
      },
    });

    console.info(
      `[migrateSchoolAssets] Résumé : ${JSON.stringify({
        dryRun: summary.dryRun,
        copyOnly: summary.copyOnly,
        scannedSlots: summary.scannedSlots,
        eligible: summary.eligible,
        migrated: summary.migrated,
        copiedOnly: summary.copiedOnly,
        skippedEmpty: summary.skippedEmpty,
        skippedAlreadyMigrated: summary.skippedAlreadyMigrated,
        failed: summary.failed,
      })}`,
    );

    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err) => {
  console.error(`[migrateSchoolAssets] ERREUR FATALE : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

