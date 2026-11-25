/**
 * SCRIPT D'ADMINISTRATION : Activation et peuplement des établissements existants
 * 
 * Cible : Écoles ayant un `onboardingConfig` mais dont les données
 * (classes, matières, année académique) n'ont pas encore été peuplées.
 * 
 * Usage : bun scripts/activate-unpopulated-schools.ts [--dry-run]
 */

import { prisma } from '../src/infrastructure/persistence/prisma/prisma.client';
import { PrismaSchoolActivationRepository } from '../src/infrastructure/persistence/prisma/PrismaSchoolActivationRepository';
import { ActiverEtablissementUseCase } from '../src/application/school/ActiverEtablissementUseCase';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`\n🔍 Recherche des établissements non peuplés... ${isDryRun ? '(MODE SIMULATION DRY-RUN)' : ''}`);

  const schools = await prisma.school.findMany({
    where: {
      onboardingConfig: { not: null as any },
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      status: true,
      templateCode: true,
      onboardingConfig: true,
      _count: {
        select: {
          classes: true,
          subjects: true,
          academicYears: true,
        },
      },
    },
  });

  const unpopulated = schools.filter(
    (s) => s._count.classes === 0 && s._count.academicYears === 0,
  );

  if (unpopulated.length === 0) {
    console.log('✅ Aucun établissement en attente de peuplement trouvé.');
    return;
  }

  console.log(`📌 ${unpopulated.length} établissement(s) trouvé(s) sans données initiales :\n`);
  for (const school of unpopulated) {
    console.log(` - [${school.subdomain}] "${school.name}" (Statut: ${school.status}, Template: ${school.templateCode})`);
  }

  if (isDryRun) {
    console.log('\n[Dry-run] Fin de la simulation. Aucune modification effectuée.');
    return;
  }

  const schoolActivationRepo = new PrismaSchoolActivationRepository(prisma);
  const activerUseCase = new ActiverEtablissementUseCase(schoolActivationRepo);

  console.log('\n🚀 Début du peuplement...');

  for (const school of unpopulated) {
    console.log(`\n⚙️ Traitement de "${school.name}" (${school.id})...`);
    try {
      // ActiverEtablissementUseCase exige status === 'APPROVED'
      if (school.status !== 'APPROVED') {
        await prisma.school.update({
          where: { id: school.id },
          data: { status: 'APPROVED' },
        });
        console.log(`  ↳ Statut temporairement positionné sur 'APPROVED'`);
      }

      const res = await activerUseCase.execute({ schoolId: school.id });
      console.log(`  ✅ Succès :`);
      console.log(`     - Année académique : ${res.academicYear}`);
      console.log(`     - Classes créées    : ${res.classCount}`);
      console.log(`     - Matières créées   : ${res.subjectCount}`);
      console.log(`     - Statut final      : ACTIVE`);
    } catch (err) {
      console.error(`  ❌ Erreur lors de l'activation de "${school.name}":`, err);
    }
  }

  console.log('\n🎉 Opération terminée !\n');
}

main()
  .catch((err) => {
    console.error('Erreur fatale :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
