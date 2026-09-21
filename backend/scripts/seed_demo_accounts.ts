/**
 * Script de création des comptes de démonstration pour le développement local et les tests.
 * 
 * GARDE DE SÉCURITÉ : Ne s'exécute JAMAIS en environnement de production (NODE_ENV=production).
 * Usage : bun scripts/seed_demo_accounts.ts
 */

import { PrismaClient, StaffPermissionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV === 'production') {
  console.error('⛔ ERREUR : Exécution strictement interdite en environnement de production.');
  process.exit(1);
}

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'DemoPassword123!';

interface DemoStaffDef {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  permissions: StaffPermissionType[];
}

const DEMO_STAFF_ACCOUNTS: DemoStaffDef[] = [
  {
    email: 'secretaire.demo@zekoulabia.cm',
    firstName: 'Sophie',
    lastName: 'Secrétaire',
    title: 'Secrétaire',
    permissions: [
      'MANAGE_ENROLLMENT',
      'GENERATE_REPORTS',
    ],
  },
  {
    email: 'censeur.demo@zekoulabia.cm',
    firstName: 'Alain',
    lastName: 'Censeur',
    title: 'Censeur',
    permissions: [
      'MANAGE_CLASSES',
      'MANAGE_STUDENT_ASSIGNMENTS',
      'MANAGE_TEACHING_ASSIGNMENTS',
      'MANAGE_TIMETABLE',
      'VALIDATE_GRADES',
      'MANAGE_EXAMS',
      'SUPERVISE_TEACHERS',
      'GENERATE_REPORTS',
      'MANAGE_CLASS_COUNCIL',
      'MANAGE_ATTENDANCE',
      'MANAGE_DISCIPLINE',
    ],
  },
  {
    email: 'intendant.demo@zekoulabia.cm',
    firstName: 'Paul',
    lastName: 'Intendant',
    title: 'Intendant',
    permissions: [
      'MANAGE_FINANCE',
      'VALIDATE_PAYMENTS',
      'GENERATE_REPORTS',
    ],
  },
  {
    email: 'surveillant.demo@zekoulabia.cm',
    firstName: 'Marc',
    lastName: 'Surveillant',
    title: 'Surveillant Général',
    permissions: [
      'MANAGE_ATTENDANCE',
      'MANAGE_DISCIPLINE',
      'MANAGE_INCIDENTS',
      'GENERATE_REPORTS',
    ],
  },
  {
    email: 'orientation.demo@zekoulabia.cm',
    firstName: 'Claire',
    lastName: 'Conseillère',
    title: "Conseillère d'Orientation",
    permissions: [
      'MANAGE_ORIENTATION',
      'GENERATE_REPORTS',
    ],
  },
  {
    email: 'documentaliste.demo@zekoulabia.cm',
    firstName: 'Élise',
    lastName: 'Documentaliste',
    title: 'Documentaliste',
    permissions: [
      'MANAGE_LIBRARY',
    ],
  },
];

async function main() {
  console.log('🚀 [Seed Démo] Initialisation des comptes de démonstration...');

  // 1. Trouver ou créer l'école de démo
  let school = await prisma.school.findFirst({
    where: { subdomain: 'demo-college' },
  });

  if (!school) {
    school = await prisma.school.findFirst();
  }

  if (!school) {
    console.log('Création d\'une école de démonstration par défaut...');
    school = await prisma.school.create({
      data: {
        name: 'Collège Démo ZekoulABia',
        subdomain: 'demo-college',
        city: 'Yaoundé',
        phone: '+237 600 00 00 00',
        subsystem: 'FRANCOPHONE',
        status: 'ACTIVE',
      },
    });
  }

  console.log(`🏫 École cible : ${school.name} (ID: ${school.id})`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 2. Administrateur
  const adminEmail = 'admin.demo@zekoulabia.cm';
  const adminUser = await prisma.user.upsert({
    where: {
      schoolId_email: {
        schoolId: school.id,
        email: adminEmail,
      },
    },
    update: {
      passwordHash,
      isActive: true,
    },
    create: {
      email: adminEmail,
      firstName: 'Directeur',
      lastName: 'Admin',
      role: 'ADMIN',
      schoolId: school.id,
      passwordHash,
      isActive: true,
    },
  });
  console.log(`✅ Admin démo : ${adminUser.email}`);

  // 3. Comptes Staff avec rôles et permissions
  for (const staffDef of DEMO_STAFF_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: {
        schoolId_email: {
          schoolId: school.id,
          email: staffDef.email,
        },
      },
      update: {
        passwordHash,
        isActive: true,
      },
      create: {
        email: staffDef.email,
        firstName: staffDef.firstName,
        lastName: staffDef.lastName,
        role: 'STAFF',
        schoolId: school.id,
        passwordHash,
        isActive: true,
      },
    });

    const profile = await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: {
        title: staffDef.title,
        schoolId: school.id,
      },
      create: {
        userId: user.id,
        schoolId: school.id,
        title: staffDef.title,
      },
    });

    // Supprimer les permissions existantes et réinsérer les permissions actuelles
    await prisma.staffPermission.deleteMany({
      where: { staffProfileId: profile.id },
    });

    for (const perm of staffDef.permissions) {
      await prisma.staffPermission.create({
        data: {
          staffProfileId: profile.id,
          permission: perm,
        },
      });
    }

    console.log(`✅ Staff [${staffDef.title}] : ${user.email} (${staffDef.permissions.length} perms)`);
  }

  // 4. Compte Enseignant
  const teacherEmail = 'prof.demo@zekoulabia.cm';
  const teacherUser = await prisma.user.upsert({
    where: {
      schoolId_email: {
        schoolId: school.id,
        email: teacherEmail,
      },
    },
    update: {
      passwordHash,
      isActive: true,
    },
    create: {
      email: teacherEmail,
      firstName: 'Jean',
      lastName: 'Professeur',
      role: 'TEACHER',
      schoolId: school.id,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      specialization: ['Mathématiques', 'Physique'],
    },
  });
  console.log(`✅ Enseignant démo : ${teacherUser.email}`);

  // 5. Compte Parent
  const parentEmail = 'parent.demo@zekoulabia.cm';
  const parentUser = await prisma.user.upsert({
    where: {
      schoolId_email: {
        schoolId: school.id,
        email: parentEmail,
      },
    },
    update: {
      passwordHash,
      isActive: true,
    },
    create: {
      email: parentEmail,
      firstName: 'Marie',
      lastName: 'Parent',
      role: 'PARENT',
      schoolId: school.id,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      userId: parentUser.id,
    },
  });
  console.log(`✅ Parent démo : ${parentUser.email}`);

  // 6. Compte Élève
  const studentEmail = 'eleve.demo@zekoulabia.cm';
  const studentUser = await prisma.user.upsert({
    where: {
      schoolId_email: {
        schoolId: school.id,
        email: studentEmail,
      },
    },
    update: {
      passwordHash,
      isActive: true,
    },
    create: {
      email: studentEmail,
      firstName: 'Lucas',
      lastName: 'Élève',
      role: 'STUDENT',
      schoolId: school.id,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      matricule: 'DEMO-2025-001',
    },
  });
  console.log(`✅ Élève démo : ${studentUser.email}`);

  console.log('\n🎉 Seed démo terminé avec succès ! Mot de passe commun :', DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed des comptes de démo :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
