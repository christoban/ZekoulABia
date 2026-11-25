/**
 * Test — getEffectiveSchoolSettings, corrige un bug indépendant trouvé en retirant le cast
 * `(settings as any)?.bulletinTemplate` chez ses deux appelants (ReportCardController.ts et
 * adminActionCatalog.ts, action IA "generer_bulletins_classe") : ce champ n'a jamais existé
 * sur l'objet retourné par cette fonction (il vit sur SchoolConfig, jamais surfacé). Le
 * fallback 'FR_SECONDARY' était donc TOUJOURS utilisé, quelle que soit la configuration
 * réelle de l'établissement (ex. un établissement anglophone configuré en EN_SECONDARY
 * générait quand même des bulletins avec le template francophone).
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { getEffectiveSchoolSettings } from '../../../src/infrastructure/services/school-settings/SchoolSettingsService.ts';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

let schoolId: string;

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'bulletinTemplateSettings');
  schoolId = school.id;
  await prismaTest.schoolConfig.create({ data: { schoolId, bulletinTemplate: 'EN_SECONDARY' } });
});

afterAll(async () => {
  await prismaTest.schoolConfig.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('getEffectiveSchoolSettings — bulletinTemplate lu depuis SchoolConfig', () => {
  it("retourne le bulletinTemplate réellement configuré pour l'établissement, pas toujours FR_SECONDARY", async () => {
    const settings = await getEffectiveSchoolSettings(schoolId);
    expect(settings.bulletinTemplate).toBe('EN_SECONDARY');
  });

  it("retourne undefined (pas une erreur) si l'établissement n'a pas de SchoolConfig — l'appelant applique alors son propre fallback", async () => {
    const schoolSansConfig = await creerEcoleTest(prismaTest, 'bulletinTemplateSansConfig');
    const settings = await getEffectiveSchoolSettings(schoolSansConfig.id);
    expect(settings.bulletinTemplate).toBeUndefined();
    await nettoyerEcole(prismaTest, schoolSansConfig.id);
  });
});
