-- Phase 1B, étape 1 : colonnes nullable pour permettre le backfill contrôlé.
ALTER TABLE "StudentProfile" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentProfile" ADD COLUMN "identityId" TEXT;

-- Phase 1B, étape 2 : backfill depuis la source de vérité actuelle.
UPDATE "StudentProfile" AS profile
SET "schoolId" = "User"."schoolId"
FROM "User"
WHERE "User"."id" = profile."userId"
  AND profile."schoolId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "StudentProfile" WHERE "schoolId" IS NULL) THEN
    RAISE EXCEPTION 'StudentProfile.schoolId backfill incomplete';
  END IF;
END $$;

-- Normaliser les matricules déjà présents avant de créer les identités globales.
UPDATE "StudentProfile"
SET "matricule" = upper(regexp_replace("matricule", '[[:space:]]+', '', 'g'))
WHERE "matricule" IS NOT NULL;

-- Phase 1B, étape 3 : contrainte et index après vérification du backfill.
ALTER TABLE "StudentProfile" ALTER COLUMN "schoolId" SET NOT NULL;
CREATE UNIQUE INDEX "User_id_schoolId_key" ON "User"("id", "schoolId");

CREATE TABLE "StudentIdentity" (
  "id" TEXT NOT NULL,
  "nationalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentIdentity_nationalId_key" ON "StudentIdentity"("nationalId");
CREATE UNIQUE INDEX "StudentProfile_identityId_schoolId_key"
  ON "StudentProfile"("identityId", "schoolId")
  WHERE "identityId" IS NOT NULL;
CREATE UNIQUE INDEX "StudentProfile_userId_schoolId_key" ON "StudentProfile"("userId", "schoolId");
CREATE INDEX "StudentProfile_schoolId_idx" ON "StudentProfile"("schoolId");
CREATE INDEX "StudentProfile_identityId_idx" ON "StudentProfile"("identityId");
CREATE INDEX "StudentProfile_identityId_schoolId_idx" ON "StudentProfile"("identityId", "schoolId");

ALTER TABLE "StudentProfile"
  ADD CONSTRAINT "StudentProfile_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "StudentIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentProfile"
  ADD CONSTRAINT "StudentProfile_userId_schoolId_fkey"
  FOREIGN KEY ("userId", "schoolId") REFERENCES "User"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
