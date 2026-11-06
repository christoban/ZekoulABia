/**
 * Phase 1B — garanties DB de l'identité globale élève.
 *
 * Ces tests doivent tourner sur une base migrée (clone Phase 1B), pas sur la base
 * pré-migration : DATABASE_URL doit cibler un clone de test Phase 1B.
 */
import { describe, expect, it } from 'bun:test';
import { PrismaMatriculeImportRepository } from '../../../src/infrastructure/persistence/prisma/PrismaMatriculeImportRepository.ts';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

const repository = new PrismaMatriculeImportRepository(prismaTest);
const MIGRATION_FILE = 'prisma/migrations/20261105120000_add_student_identity/migration.sql';

async function creerProfil(schoolId: string, suffix: string) {
  const user = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix });
  const profile = await prismaTest.studentProfile.create({ data: { userId: user.id, schoolId } });
  return { user, profile };
}

function databaseUrl(dbName: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${dbName}`;
  url.search = '';
  return url.toString();
}

async function psql(url: string, args: string[]) {
  const proc = Bun.spawn(['psql', url, '-v', 'ON_ERROR_STOP=1', ...args], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

describe('StudentIdentity — contraintes DB', () => {
  it('crée une seule identité sous écritures concurrentes', async () => {
    const schoolA = await creerEcoleTest(prismaTest, 'identity-concurrent-a');
    const schoolB = await creerEcoleTest(prismaTest, 'identity-concurrent-b');
    const a = await creerProfil(schoolA.id, 'concurrent-a');
    const b = await creerProfil(schoolB.id, 'concurrent-b');
    const matricule = 'CONCURRENT250001';

    try {
      await Promise.all([
        repository.mettreAJourMatricule(a.profile.id, { matricule, matriculeSource: 'EXCEL_IMPORT', matriculeMatchType: 'EXACT' }),
        repository.mettreAJourMatricule(b.profile.id, { matricule, matriculeSource: 'EXCEL_IMPORT', matriculeMatchType: 'EXACT' }),
      ]);

      const identities = await prismaTest.studentIdentity.findMany({ where: { nationalId: matricule } });
      expect(identities).toHaveLength(1);

      const profiles = await prismaTest.studentProfile.findMany({
        where: { id: { in: [a.profile.id, b.profile.id] } },
      });
      expect(profiles.every((profile) => profile.identityId === identities[0].id)).toBe(true);
    } finally {
      await prismaTest.studentIdentity.deleteMany({ where: { nationalId: matricule } });
      await nettoyerEcole(prismaTest, schoolA.id);
      await nettoyerEcole(prismaTest, schoolB.id);
    }
  }, 15000);

  it('rejette deux profils de la même école liés à la même identité', async () => {
    const school = await creerEcoleTest(prismaTest, 'identity-same-school');
    const a = await creerProfil(school.id, 'same-school-a');
    const b = await creerProfil(school.id, 'same-school-b');
    const identity = await prismaTest.studentIdentity.create({ data: { nationalId: 'DEDUP250001' } });

    try {
      await prismaTest.studentProfile.update({ where: { id: a.profile.id }, data: { identityId: identity.id } });

      let code: string | undefined;
      try {
        await prismaTest.studentProfile.update({ where: { id: b.profile.id }, data: { identityId: identity.id } });
      } catch (err) {
        code = (err as { code?: string }).code;
      }
      expect(code).toBe('P2002');
    } finally {
      await prismaTest.studentIdentity.deleteMany({ where: { nationalId: 'DEDUP250001' } });
      await nettoyerEcole(prismaTest, school.id);
    }
  });

  it('backfill est idempotent', async () => {
    const school = await creerEcoleTest(prismaTest, 'identity-backfill');
    const { profile } = await creerProfil(school.id, 'backfill');
    const matricule = 'BACKFILL250001';
    await prismaTest.studentProfile.update({ where: { id: profile.id }, data: { matricule } });

    const runBackfill = async () => {
      const proc = Bun.spawn(['bun', 'scripts/backfill_student_identities.ts'], {
        cwd: process.cwd(),
        env: { ...process.env },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;
      expect(stderr).toBe('');
      expect(exitCode).toBe(0);
      return JSON.parse(stdout) as { scannedProfiles: number; linkedProfiles: number };
    };

    try {
      await runBackfill();
      const identityAfterFirstRun = await prismaTest.studentIdentity.findUnique({ where: { nationalId: matricule } });
      expect(identityAfterFirstRun).not.toBeNull();

      const linkedProfile = await prismaTest.studentProfile.findUnique({ where: { id: profile.id } });
      expect(linkedProfile?.identityId).toBe(identityAfterFirstRun!.id);

      await runBackfill();
      const identitiesAfterSecondRun = await prismaTest.studentIdentity.findMany({ where: { nationalId: matricule } });
      expect(identitiesAfterSecondRun).toHaveLength(1);
      const profileAfterSecondRun = await prismaTest.studentProfile.findUnique({ where: { id: profile.id } });
      expect(profileAfterSecondRun?.identityId).toBe(identityAfterFirstRun!.id);
    } finally {
      await prismaTest.studentIdentity.deleteMany({ where: { nationalId: matricule } });
      await nettoyerEcole(prismaTest, school.id);
    }
  }, 30000);

  it('ignore les codes dossier D6 sans modifier le tiret ni créer d’identité', async () => {
    const [identityTable] = await prismaTest.$queryRaw<Array<{ table_name: string | null }>>`
      SELECT to_regclass('public."StudentIdentity"')::text AS table_name
    `;
    if (!identityTable?.table_name) return;

    const matricules = ['D6-ELEVE001', 'D6-ELEVE002', 'D6-ELEVE003', 'D6-ELEVE004'];
    const profiles = await prismaTest.studentProfile.findMany({
      where: { matricule: { in: matricules } },
      select: { id: true, matricule: true, identityId: true },
      orderBy: { matricule: 'asc' },
    });
    expect(profiles.map((profile) => profile.matricule)).toEqual(matricules);
    const originalIdentityIds = profiles.map((profile) => profile.identityId);
    const originalIdentityCount = await prismaTest.studentIdentity.count({
      where: { nationalId: { in: matricules } },
    });
    await prismaTest.studentProfile.updateMany({
      where: { id: { in: profiles.map((profile) => profile.id) } },
      data: { identityId: null },
    });

    const proc = Bun.spawn(['bun', 'scripts/backfill_student_identities.ts'], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    try {
      expect(stderr).toBe('');
      expect(exitCode).toBe(0);
      const report = JSON.parse(stdout) as {
        skippedProfiles: Array<{ profileId: string; matricule: string; reason: string }>;
      };
      expect(report.skippedProfiles).toEqual(matricules.map((matricule, index) => ({
        profileId: profiles[index]!.id,
        matricule,
        reason: 'CODE_DOSSIER_D6_NON_ELIGIBLE',
      })));

      const after = await prismaTest.studentProfile.findMany({
        where: { id: { in: profiles.map((profile) => profile.id) } },
        select: { id: true, matricule: true, identityId: true },
        orderBy: { matricule: 'asc' },
      });
      expect(after.map((profile) => profile.matricule)).toEqual(matricules);
      expect(after.every((profile) => profile.identityId === null)).toBe(true);
      expect(await prismaTest.studentIdentity.count({ where: { nationalId: { in: matricules } } })).toBe(originalIdentityCount);
    } finally {
      await Promise.all(profiles.map((profile, index) =>
        prismaTest.studentProfile.update({
          where: { id: profile.id },
          data: { identityId: originalIdentityIds[index] },
        }),
      ));
    }
  }, 30000);

  it(
    'la migration échoue explicitement sur un profil que le backfill ne peut pas rattacher',
    async () => {
      // ponytail: suppose que zekoulabia_test est encore au schéma pré-Phase-1B ; basculer
      // le template sur un dump figé si cette base est migrée un jour.
      const throwaway = 'zekoulabia_test_phase1b_migration_fail';
      const template = 'zekoulabia_test';
      const throwawayUrl = databaseUrl(throwaway);

      await psql(databaseUrl('postgres'), ['-c', `DROP DATABASE IF EXISTS "${throwaway}" WITH (FORCE)`]);
      const create = await psql(databaseUrl('postgres'), ['-c', `CREATE DATABASE "${throwaway}" TEMPLATE "${template}"`]);
      expect(create.exitCode).toBe(0);

      try {
        const seed = await psql(throwawayUrl, ['-c', `
          INSERT INTO "School" ("id", "name", "subdomain", "updatedAt")
          VALUES ('migration-fail-school', 'Migration fail', 'migration-fail-school', NOW());
          INSERT INTO "User" ("id", "schoolId", "role", "firstName", "lastName", "updatedAt")
          VALUES ('migration-fail-user', 'migration-fail-school', 'STUDENT', 'Test', 'Orphelin', NOW());
          INSERT INTO "StudentProfile" ("id", "userId")
          VALUES ('migration-fail-profile', 'migration-fail-user');
          ALTER TABLE "StudentProfile" DROP CONSTRAINT "StudentProfile_userId_fkey";
          DELETE FROM "User" WHERE "id" = 'migration-fail-user';
        `]);
        expect(seed.exitCode).toBe(0);

        const migration = await psql(throwawayUrl, ['-f', MIGRATION_FILE]);
        expect(migration.exitCode).not.toBe(0);
        expect(migration.stderr).toContain('StudentProfile.schoolId backfill incomplete');
      } finally {
        await psql(databaseUrl('postgres'), ['-c', `DROP DATABASE IF EXISTS "${throwaway}" WITH (FORCE)`]);
      }
    },
    30000,
  );
});
