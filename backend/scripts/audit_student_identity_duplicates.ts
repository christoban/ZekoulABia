import { PrismaClient } from '@prisma/client';
import { detectPotentialNationalIdDuplicates } from '../src/application/matricule/detectPotentialNationalIdDuplicates.ts';
import { normalizeNationalId } from '../src/application/matricule/normalizeNationalId.ts';

const prisma = new PrismaClient();

type LegacyStudentProfileRow = {
  profileId: string;
  matricule: string | null;
  userId: string;
  userIdFound: string | null;
  userSchoolId: string | null;
};

try {
  // This query intentionally targets only the pre-Phase-1B schema.
  const profiles = await prisma.$queryRaw<LegacyStudentProfileRow[]>`
    SELECT
      p."id" AS "profileId",
      p."matricule",
      p."userId",
      u."id" AS "userIdFound",
      u."schoolId" AS "userSchoolId"
    FROM "StudentProfile" p
    LEFT JOIN "User" u ON u."id" = p."userId"
    ORDER BY p."id"
  `;

  const schoolScopeMismatches = profiles.filter((profile) => !profile.userIdFound || !profile.userSchoolId);

  const report = detectPotentialNationalIdDuplicates(
    profiles.flatMap((profile) => profile.matricule
      ? [{ profileId: profile.profileId, schoolId: profile.userSchoolId ?? '', matricule: profile.matricule }]
      : []),
  );
  const nonConformingMatricules = profiles.flatMap((profile) => {
    if (!profile.matricule) return [];
    const normalized = normalizeNationalId(profile.matricule);
    return normalized !== profile.matricule || !/^[A-Z0-9]+$/.test(profile.matricule)
      ? [{ profileId: profile.profileId, matricule: profile.matricule, normalized }]
      : [];
  });

  console.log(JSON.stringify({
    totalProfiles: profiles.length,
    exactDuplicates: report.exactDuplicates,
    confusableVariants: report.confusableVariants,
    exactDuplicateCount: report.exactDuplicates.length,
    confusableVariantCount: report.confusableVariants.length,
    nonConformingMatriculeCount: nonConformingMatricules.length,
    nonConformingMatricules,
    schoolScopeMismatchCount: schoolScopeMismatches.length,
    schoolScopeMismatches: schoolScopeMismatches.map((profile) => ({
      profileId: profile.profileId,
      userId: profile.userId,
      userIdFound: profile.userIdFound,
      userSchoolId: profile.userSchoolId,
    })),
  }, null, 2));

  if (schoolScopeMismatches.length > 0) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
