import { PrismaClient } from '@prisma/client';
import { detectPotentialNationalIdDuplicates } from '../src/application/matricule/detectPotentialNationalIdDuplicates.ts';
import { normalizeNationalId } from '../src/application/matricule/normalizeNationalId.ts';

const prisma = new PrismaClient();

const CODE_DOSSIER_D6 = /^D6-ELEVE\d{3}$/;

function estCodeDossierIgnore(matricule: string): boolean {
  return CODE_DOSSIER_D6.test(matricule.trim().toUpperCase());
}

try {
  const profiles = await prisma.studentProfile.findMany({
    where: { matricule: { not: null }, identityId: null },
    select: { id: true, schoolId: true, matricule: true, user: { select: { schoolId: true } } },
    orderBy: { matricule: 'asc' },
  });

  const scopeMismatches = profiles.filter((profile) => profile.schoolId !== profile.user.schoolId);
  if (scopeMismatches.length > 0) {
    throw new Error(`StudentProfile.schoolId incohérent pour ${scopeMismatches.length} profil(s).`);
  }

  const report = detectPotentialNationalIdDuplicates(
    profiles.flatMap((profile) => profile.matricule
      ? [{ profileId: profile.id, schoolId: profile.schoolId, matricule: profile.matricule }]
      : []),
  );
  const ambiguousProfileIds = new Set(
    [...report.exactDuplicates.flatMap((group) => group.rows), ...report.confusableVariants.flatMap((pair) => [...pair.rowsA, ...pair.rowsB])]
      .map((row) => row.profileId),
  );

  const eligible = profiles.filter((profile) => !ambiguousProfileIds.has(profile.id) && profile.matricule);
  const skippedProfiles = eligible
    .filter((profile) => estCodeDossierIgnore(profile.matricule!))
    .map((profile) => ({
      profileId: profile.id,
      matricule: profile.matricule!,
      reason: 'CODE_DOSSIER_D6_NON_ELIGIBLE',
    }));
  const profilesToLink = eligible.filter((profile) => !estCodeDossierIgnore(profile.matricule!));
  const identityIds = new Map<string, string>();
  for (const profile of profilesToLink) {
    const nationalId = normalizeNationalId(profile.matricule!);
    let identityId = identityIds.get(nationalId);
    if (!identityId) {
      const identity = await prisma.studentIdentity.upsert({
        where: { nationalId },
        update: {},
        create: { nationalId },
      });
      identityId = identity.id;
      identityIds.set(nationalId, identityId);
    }
    await prisma.studentProfile.update({ where: { id: profile.id }, data: { identityId } });
  }

  console.log(JSON.stringify({
    scannedProfiles: profiles.length,
    linkedProfiles: profilesToLink.length,
    skippedAmbiguousProfiles: ambiguousProfileIds.size,
    skippedProfiles,
    exactDuplicateGroups: report.exactDuplicates.length,
    confusableVariantPairs: report.confusableVariants.length,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
