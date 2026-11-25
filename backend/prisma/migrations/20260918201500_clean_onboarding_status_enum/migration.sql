-- AlterEnum: Nettoyage des doublons et suppression de PENDING_VALIDATION
BEGIN;

-- Conversion préalable de toute valeur dépréciée
UPDATE "StudentOnboarding"
SET "status" = CASE
  WHEN "status"::text IN ('PENDING_VALIDATION', 'SOUMIS') THEN 'SUBMITTED'
  WHEN "status"::text = 'BROUILLON' THEN 'DRAFT'
  WHEN "status"::text = 'INSCRIT' THEN 'VALIDATED'
  WHEN "status"::text = 'REJETE' THEN 'REJECTED'
  ELSE "status"::text
END::"OnboardingStatus";

CREATE TYPE "OnboardingStatus_new" AS ENUM ('DRAFT', 'LINK_SENT', 'SUBMITTED', 'VALIDATED', 'ACTIVATED', 'REJECTED', 'EXPIRED');
ALTER TABLE "public"."StudentOnboarding" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StudentOnboarding" ALTER COLUMN "status" TYPE "OnboardingStatus_new" USING ("status"::text::"OnboardingStatus_new");
ALTER TYPE "OnboardingStatus" RENAME TO "OnboardingStatus_old";
ALTER TYPE "OnboardingStatus_new" RENAME TO "OnboardingStatus";
DROP TYPE "public"."OnboardingStatus_old";
ALTER TABLE "StudentOnboarding" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

COMMIT;
