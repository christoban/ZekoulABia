/**
 * Test d'intégration — PrismaSchoolSettingsRepository, touché par le retrait de 8 casts
 * `as any` sur des champs (logRetentionDays, schoolLanguageMode, passMark, councilPassMark,
 * attendanceLateAsAbsence, bulletinBlockOnUnpaidFees) qui existaient déjà tels quels sur les
 * modèles Prisma SchoolSettings/SchoolConfig — les casts étaient de la pure friction, jamais
 * exercés par un test concret de l'implémentation Prisma (seul un test avec un repository
 * factice/en mémoire existait jusqu'ici). Vérifie sur la vraie base le round-trip complet
 * sauvegarder() → getParametresEffectifs().
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { PrismaSchoolSettingsRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaSchoolSettingsRepository.ts';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';

let schoolId: string;

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'schoolSettingsRepo');
  schoolId = school.id;
});

afterAll(async () => {
  await prismaTest.schoolConfig.deleteMany({ where: { schoolId } });
  await prismaTest.schoolSettings.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('PrismaSchoolSettingsRepository — round-trip sauvegarder()/getParametresEffectifs() sans cast any', () => {
  it('applique les valeurs par défaut quand rien n\'a encore été sauvegardé', async () => {
    const repo = new PrismaSchoolSettingsRepository(prismaTest);
    const settings = await repo.getParametresEffectifs(schoolId);
    expect(settings.logRetentionDays).toBe(90);
    expect(settings.schoolLanguageMode).toBe('francophone');
    expect(settings.passMark).toBe(10);
    expect(settings.councilPassMark).toBe(10);
    expect(settings.attendanceLateAsAbsence).toBe(true);
    expect(settings.bulletinBlockOnUnpaidFees).toBe(false);
  });

  it('sauvegarde puis relit les valeurs réellement configurées (pas les défauts)', async () => {
    const repo = new PrismaSchoolSettingsRepository(prismaTest);
    await repo.sauvegarder(schoolId, {
      logRetentionDays: 30,
      schoolLanguageMode: 'anglophone',
      passMark: 40,
      councilPassMark: 12,
      attendanceLateAsAbsence: true,
      bulletinBlockOnUnpaidFees: true,
    });

    const settings = await repo.getParametresEffectifs(schoolId);
    expect(settings.logRetentionDays).toBe(30);
    expect(settings.schoolLanguageMode).toBe('anglophone');
    expect(settings.passMark).toBe(40);
    expect(settings.councilPassMark).toBe(12);
    expect(settings.attendanceLateAsAbsence).toBe(true);
    expect(settings.bulletinBlockOnUnpaidFees).toBe(true);

    // Confirme aussi que ces valeurs sont bien sur les tables Prisma attendues.
    const rawSettings = await prismaTest.schoolSettings.findUnique({ where: { schoolId } });
    expect(rawSettings?.logRetentionDays).toBe(30);
    const rawConfig = await prismaTest.schoolConfig.findUnique({ where: { schoolId } });
    expect(rawConfig?.schoolLanguageMode).toBe('anglophone');
    expect(rawConfig?.passMark).toBe(40);
  });
});
