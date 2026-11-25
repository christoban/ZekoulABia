/**
 * SCRIPT CLI — Migration des photos d'élèves Base64 (StudentProfile.photoUrl) vers FileStoragePort
 *
 * Usage :
 *   bun run src/scripts/migrateStudentPhotosToStorage.ts               # --dry-run (par défaut, aucune écriture)
 *   bun run src/scripts/migrateStudentPhotosToStorage.ts --apply       # écrit dans FileStoragePort, vérifie par relecture, puis met à jour photoUrl
 *   bun run src/scripts/migrateStudentPhotosToStorage.ts --apply --copy-only # copie & vérifie dans FileStoragePort sans toucher photoUrl en base
 *
 * Sécurité :
 * - refuse catégoriquement de s'exécuter si DATABASE_URL ne pointe pas vers la base locale (localhost/127.0.0.1/::1).
 */

import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { createFileStorageAdapter } from '@infrastructure/services/storage/createFileStorageAdapter';
import {
  assertLocalDatabaseUrl,
  migrateStudentPhotosBase64,
} from '@infrastructure/services/storage/studentPhotoMigration';

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply') && !args.has('--dry-run');
  const copyOnly = args.has('--copy-only');

  const dbInfo = assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const fileStorage = createFileStorageAdapter();

  console.info(
    `[migrateStudentPhotos] Démarrage (mode=${apply ? (copyOnly ? 'APPLY_COPY_ONLY' : 'APPLY') : 'DRY_RUN'}, db=${dbInfo.host}/${dbInfo.database}, driver=${fileStorage.driverName})`,
  );

  try {
    const profiles = await prisma.studentProfile.findMany({
      where: { photoUrl: { not: null } },
      select: {
        id: true,
        userId: true,
        photoUrl: true,
        user: { select: { schoolId: true } },
      },
    });

    const candidates = profiles
      .filter((p) => Boolean(p.user?.schoolId))
      .map((p) => ({
        studentProfileId: p.id,
        studentUserId: p.userId,
        schoolId: p.user.schoolId,
        photoUrl: p.photoUrl,
      }));

    const summary = await migrateStudentPhotosBase64({
      candidates,
      fileStorage,
      dryRun: !apply,
      copyOnly,
      updateStudentPhotoUrl: async (studentProfileId, storageKey) => {
        await prisma.studentProfile.update({
          where: { id: studentProfileId },
          data: { photoUrl: storageKey },
        });
      },
      logger: (entry) => {
        console.info(`[migrateStudentPhotos] ${JSON.stringify(entry)}`);
      },
    });

    console.info(
      `[migrateStudentPhotos] Résumé : ${JSON.stringify({
        dryRun: summary.dryRun,
        copyOnly: summary.copyOnly,
        scanned: summary.scanned,
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
  console.error(`[migrateStudentPhotos] ERREUR FATALE : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

