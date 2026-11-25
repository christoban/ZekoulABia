import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prismaTest } from '../../helpers/prismaTestClient.ts';

describe('Migration 20261125175500_official_progression_import_fields (base locale de test)', () => {
  it('convertit filiere NULL en "", marque toutes les lignes existantes manuallyEdited = true, et applique la nouvelle contrainte unique', async () => {
    const schema = `migration_test_2a_${Date.now()}`;
    const migrationPath = join(
      import.meta.dir,
      '../../../prisma/migrations/20261125175500_official_progression_import_fields/migration.sql',
    );
    const migrationSql = readFileSync(migrationPath, 'utf8');

    try {
      await prismaTest.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
      await prismaTest.$executeRawUnsafe(`CREATE SCHEMA "${schema}";`);

      await prismaTest.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}";`);

        // 1. Schéma AVANT migration
        await tx.$executeRawUnsafe(`
          CREATE TABLE "SchoolTemplate" (
            "code" TEXT NOT NULL PRIMARY KEY
          );
        `);
        await tx.$executeRawUnsafe(`INSERT INTO "SchoolTemplate" ("code") VALUES ('__ALL__'), ('LYCEE_FR');`);

        await tx.$executeRawUnsafe(`
          CREATE TABLE "OfficialProgrammeProgression" (
            "id" TEXT NOT NULL,
            "templateCode" TEXT NOT NULL,
            "level" TEXT NOT NULL,
            "filiere" TEXT,
            "subjectName" TEXT NOT NULL,
            "titre" TEXT NOT NULL,
            "chapitres" JSONB NOT NULL,
            "active" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "OfficialProgrammeProgression_pkey" PRIMARY KEY ("id")
          );
        `);
        await tx.$executeRawUnsafe(`
          CREATE UNIQUE INDEX "OfficialProgrammeProgression_templateCode_level_subjectName_key"
          ON "OfficialProgrammeProgression"("templateCode", "level", "subjectName");
        `);
        await tx.$executeRawUnsafe(`
          ALTER TABLE "OfficialProgrammeProgression"
          ADD CONSTRAINT "OfficialProgrammeProgression_templateCode_fkey"
          FOREIGN KEY ("templateCode") REFERENCES "SchoolTemplate"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
        `);

        // Lignes préexistantes : une avec filiere NULL, une avec filiere 'FR_GENERAL'
        await tx.$executeRawUnsafe(`
          INSERT INTO "OfficialProgrammeProgression"
            ("id", "templateCode", "level", "filiere", "subjectName", "titre", "chapitres")
          VALUES
            ('pre_null', 'LYCEE_FR', '6e', NULL, 'Mathématiques', 'Maths 6e legacy', '[{"ordre":1,"titre":"Ch1","volumeHeuresPrevu":4}]'::jsonb),
            ('pre_fil',  '__ALL__',  '6e', 'FR_GENERAL', 'Français', 'Français 6e legacy', '[{"ordre":1,"titre":"Ch1","volumeHeuresPrevu":6}]'::jsonb);
        `);

        // 2. Exécution réelle de migration.sql
        const statements = migrationSql
          .split(';')
          .map((s) => s.replace(/--.*$/gm, '').trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          await tx.$executeRawUnsafe(stmt);
        }

        // 3. Vérifications Point 6(a)
        const rows = await tx.$queryRawUnsafe<
          Array<{
            id: string;
            filiere: string;
            manuallyEdited: boolean;
            source: string | null;
            importChecksum: string | null;
          }>
        >(`
          SELECT "id", "filiere", "manuallyEdited", "source", "importChecksum"
          FROM "OfficialProgrammeProgression"
          ORDER BY "id" ASC;
        `);

        const rowNull = rows.find((r) => r.id === 'pre_null');
        const rowFil = rows.find((r) => r.id === 'pre_fil');

        expect(rowNull).toEqual({
          id: 'pre_null',
          filiere: '',
          manuallyEdited: true,
          source: null,
          importChecksum: null,
        });
        expect(rowFil).toEqual({
          id: 'pre_fil',
          filiere: 'FR_GENERAL',
          manuallyEdited: true,
          source: null,
          importChecksum: null,
        });

        // 4. Nouvelle insertion : autorise une autre filière pour la même matière, manuallyEdited = false par défaut
        await tx.$executeRawUnsafe(`
          INSERT INTO "OfficialProgrammeProgression"
            ("id", "templateCode", "level", "filiere", "subjectName", "titre", "chapitres", "source")
          VALUES
            ('new_pebs', '__ALL__', '6e', 'FR_PEBS', 'Français', 'Français 6e PEBS', '[]'::jsonb, 'minesec-distance-learning');
        `);

        const inserted = await tx.$queryRawUnsafe<Array<{ manuallyEdited: boolean }>>(
          `SELECT "manuallyEdited" FROM "OfficialProgrammeProgression" WHERE "id" = 'new_pebs';`,
        );
        expect(inserted[0]?.manuallyEdited).toBe(false);

        // Doublon exact sur (templateCode, level, filiere, subjectName) rejeté par la contrainte unique
        let duplicateFailed = false;
        try {
          await tx.$executeRawUnsafe(`SAVEPOINT dup_check;`);
          await tx.$executeRawUnsafe(`
            INSERT INTO "OfficialProgrammeProgression"
              ("id", "templateCode", "level", "filiere", "subjectName", "titre", "chapitres")
            VALUES
              ('dup_row', '__ALL__', '6e', 'FR_PEBS', 'Français', 'Doublon', '[]'::jsonb);
          `);
        } catch {
          duplicateFailed = true;
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT dup_check;`);
        }
        expect(duplicateFailed).toBe(true);

        // 5. Vérification syntaxique et fonctionnelle du SQL d'annulation (Point 7) sur le schéma isolé
        await tx.$executeRawUnsafe(`DELETE FROM "OfficialProgrammeProgression" WHERE "id" = 'new_pebs';`);
        const rollbackStatements = [
          `DROP INDEX "OfficialProgrammeProgression_templateCode_level_filiere_sub_key"`,
          `ALTER TABLE "OfficialProgrammeProgression" ALTER COLUMN "filiere" DROP DEFAULT, ALTER COLUMN "filiere" DROP NOT NULL, DROP COLUMN "source", DROP COLUMN "manuallyEdited", DROP COLUMN "importChecksum"`,
          `UPDATE "OfficialProgrammeProgression" SET "filiere" = NULL WHERE "filiere" = ''`,
          `CREATE UNIQUE INDEX "OfficialProgrammeProgression_templateCode_level_subjectName_key" ON "OfficialProgrammeProgression"("templateCode", "level", "subjectName")`,
        ];
        for (const stmt of rollbackStatements) {
          await tx.$executeRawUnsafe(stmt);
        }
      });
    } finally {
      await prismaTest.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`).catch(() => {});
    }
  });
});

