import { PrismaClient, StaffPermissionType } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_TITLES = ['Censeur', 'Vice-Principal', 'Directeur Adjoint', 'Deputy Head Teacher'];

const NEW_PERMISSIONS: StaffPermissionType[] = [
  'MANAGE_CLASSES',
  'MANAGE_STUDENT_ASSIGNMENTS',
  'MANAGE_TEACHING_ASSIGNMENTS',
];

async function main() {
  console.log('--- Backfill Staff Permissions ---');
  
  const profiles = await prisma.staffProfile.findMany({
    where: {
      title: { in: TARGET_TITLES },
    },
    include: {
      permissions: true,
    },
  });

  console.log(`Trouvé ${profiles.length} profil(s) staff correspondant aux titres visés.`);

  let insertedCount = 0;

  for (const profile of profiles) {
    const existingPerms = new Set(profile.permissions.map((p) => p.permission));

    for (const perm of NEW_PERMISSIONS) {
      if (!existingPerms.has(perm)) {
        await prisma.staffPermission.create({
          data: {
            staffProfileId: profile.id,
            permission: perm,
          },
        });
        insertedCount++;
      }
    }
  }

  console.log(`Backfill terminé avec succès. ${insertedCount} permission(s) insérée(s).`);
}

main()
  .catch((e) => {
    console.error('Erreur lors du backfill :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
