/**
 * Script one-shot (LECTURE SEULE) — Audit des matières LV2 génériques héritées.
 *
 * Contexte : avant la réconciliation LV2, le curriculum créait une matière générique
 * "LV2" (au lieu de matières-langues réelles Allemand/Espagnol/… taggées isLV2=true).
 * Ce script identifie les établissements qui ont encore une "LV2" générique non résolue
 * et loggue un avertissement — il NE SUPPRIME et NE MODIFIE rien.
 *
 * Usage : bun scripts/migrate-lv2-subjects.ts
 *
 * Aucune suppression automatique : la résolution se fait manuellement (ré-onboarding,
 * ou affectation des langues depuis le dashboard). Ce script est purement informatif.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Noms génériques considérés comme "LV2 non résolue" (cf. curriculum premier-cycle.ts)
const GENERIC_LV2_NAMES = ['LV2', 'Langue Vivante 2', 'Langue vivante 2', 'Langue Vivante II'];

async function main() {
  console.log('🔎 Audit des matières LV2 génériques (lecture seule)…\n');

  const genericSubjects = await prisma.subject.findMany({
    where: { name: { in: GENERIC_LV2_NAMES } },
    select: { id: true, name: true, schoolId: true },
  });

  if (genericSubjects.length === 0) {
    console.log('✅ Aucune matière LV2 générique trouvée — rien à signaler.');
    return;
  }

  // Regrouper par école
  const bySchool = new Map<string, { name: string }[]>();
  for (const s of genericSubjects) {
    if (!bySchool.has(s.schoolId)) bySchool.set(s.schoolId, []);
    bySchool.get(s.schoolId)!.push({ name: s.name });
  }

  console.log(`⚠️  ${genericSubjects.length} matière(s) générique(s) répartie(s) sur ${bySchool.size} établissement(s).\n`);

  let resolus = 0;
  let nonResolus = 0;

  for (const [schoolId, generics] of bySchool) {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    const schoolName = school?.name ?? `(école ${schoolId})`;

    // Des matières-langues réelles existent-elles déjà pour cette école ?
    const realLv2Count = await prisma.subject.count({
      where: { schoolId, isLV2: true },
    });

    const genericLabels = generics.map((g) => g.name).join(', ');

    if (realLv2Count > 0) {
      resolus++;
      console.log(
        `ℹ️  École "${schoolName}" : ${realLv2Count} matière(s) de langue LV2 réelle(s) présente(s), ` +
        `mais l'entrée générique subsiste encore (${genericLabels}). Vérification manuelle recommandée.`,
      );
    } else {
      nonResolus++;
      console.warn(
        `⚠️  École "${schoolName}" a une LV2 générique non résolue (${genericLabels}) — configurer manuellement ` +
        `(déclarer les langues LV2 puis réexécuter la configuration, ou affecter les langues depuis le dashboard).`,
      );
    }
  }

  console.log('\n──────────── Résumé ────────────');
  console.log(`  Établissements avec langues LV2 réelles déjà présentes : ${resolus}`);
  console.log(`  Établissements avec LV2 générique NON résolue          : ${nonResolus}`);
  console.log('\n✅ Audit terminé — aucune donnée modifiée (lecture seule).');
}

main()
  .catch((e) => {
    console.error('❌ Erreur pendant l\'audit :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
