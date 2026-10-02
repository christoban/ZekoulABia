import { PrismaClient } from '@prisma/client';

/**
 * Synchronise les élèves, parents, inscriptions et liens parents-élèves
 * du Lycée de Bafia de la base locale vers la base Azure.
 *
 * L'URL de destination est lue dans AZURE_DATABASE_URL — jamais codée en dur,
 * le mot de passe de production n'a rien à faire dans le dépôt.
 * Exemple : AZURE_DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require'
 *
 * ATTENTION : ce script écrit en production. À n'exécuter que sur ordre explicite.
 */
async function main() {
  const azureUrl = process.env.AZURE_DATABASE_URL;
  if (!azureUrl) {
    throw new Error(
      'AZURE_DATABASE_URL est absent. Définissez-la dans l’environnement avant de lancer ce script.',
    );
  }

  const localPrisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:2005@localhost:5432/zekoulabia_dev?schema=public' } },
  });
  const azurePrisma = new PrismaClient({
    datasources: {
      db: {
        url: azureUrl,
      },
    },
  });

  const schoolId = '19f9d4de-715c-4e8a-8672-cefd84ce806d';

  console.log('--- 1. Récupération des données locales pour le Lycée de Bafia ---');

  const studentUsers = await localPrisma.user.findMany({
    where: { schoolId, role: 'STUDENT' },
  });
  const parentUsers = await localPrisma.user.findMany({
    where: { schoolId, role: 'PARENT' },
  });
  const studentProfiles = await localPrisma.studentProfile.findMany({
    where: { user: { schoolId } },
  });
  const parentProfiles = await localPrisma.parentProfile.findMany({
    where: { user: { schoolId } },
  });
  const enrollments = await localPrisma.enrollment.findMany({
    where: { class: { schoolId } },
  });
  const parentStudents = await localPrisma.parentStudent.findMany({
    where: { studentProfile: { user: { schoolId } } },
  });

  console.log(`Données locales : ${studentUsers.length} élèves, ${parentUsers.length} parents, ${studentProfiles.length} profils élèves, ${parentProfiles.length} profils parents, ${enrollments.length} inscriptions, ${parentStudents.length} liens.`);

  console.log('--- 2. Insertion sur Azure (idempotente) ---');

  // A. Utilisateurs élèves et parents
  for (const u of [...studentUsers, ...parentUsers]) {
    await azurePrisma.user.upsert({
      where: { id: u.id },
      create: { ...u },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
      },
    });
  }
  console.log('✅ Utilisateurs (élèves + parents) synchronisés sur Azure.');

  // B. Profils élèves
  for (const sp of studentProfiles) {
    await azurePrisma.studentProfile.upsert({
      where: { id: sp.id },
      create: { ...sp },
      update: {
        dateOfBirth: sp.dateOfBirth,
        healthScore: sp.healthScore,
        lv2SubjectId: sp.lv2SubjectId,
        studentStatus: sp.studentStatus,
      },
    });
  }
  console.log('✅ Profils élèves synchronisés sur Azure.');

  // C. Profils parents
  for (const pp of parentProfiles) {
    await azurePrisma.parentProfile.upsert({
      where: { id: pp.id },
      create: { id: pp.id, userId: pp.userId },
      update: {},
    });
  }
  console.log('✅ Profils parents synchronisés sur Azure.');

  // D. Inscriptions
  for (const en of enrollments) {
    await azurePrisma.enrollment.upsert({
      where: { id: en.id },
      create: { ...en },
      update: {
        status: en.status,
        classId: en.classId,
      },
    });
  }
  console.log('✅ Inscriptions synchronisées sur Azure.');

  // E. Liens parents-élèves
  for (const ps of parentStudents) {
    await azurePrisma.parentStudent.upsert({
      where: {
        parentProfileId_studentProfileId: {
          parentProfileId: ps.parentProfileId,
          studentProfileId: ps.studentProfileId,
        },
      },
      create: {
        parentProfileId: ps.parentProfileId,
        studentProfileId: ps.studentProfileId,
        relation: ps.relation,
        contactPrincipal: ps.contactPrincipal,
        responsableFinancier: ps.responsableFinancier,
      },
      update: {
        relation: ps.relation,
        contactPrincipal: ps.contactPrincipal,
        responsableFinancier: ps.responsableFinancier,
      },
    });
  }
  console.log('✅ Liens parent-élève synchronisés sur Azure.');

  await localPrisma.$disconnect();
  await azurePrisma.$disconnect();
  console.log('🎉 Synchronisation des données terminée avec succès sur Azure !');
}

main().catch((e) => {
  console.error('Erreur:', e);
  process.exit(1);
});
