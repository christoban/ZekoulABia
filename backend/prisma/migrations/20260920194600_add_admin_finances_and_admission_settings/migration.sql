-- AlterTable
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "adminGereFinances" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SchoolOnboardingSettings" ADD COLUMN IF NOT EXISTS "requireEntranceExam" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SchoolOnboardingSettings" ADD COLUMN IF NOT EXISTS "admissionPolicy" TEXT;
