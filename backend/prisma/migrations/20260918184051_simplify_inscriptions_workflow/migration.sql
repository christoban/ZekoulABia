-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OnboardingStatus" ADD VALUE 'BROUILLON';
ALTER TYPE "OnboardingStatus" ADD VALUE 'SOUMIS';
ALTER TYPE "OnboardingStatus" ADD VALUE 'INSCRIT';
ALTER TYPE "OnboardingStatus" ADD VALUE 'REJETE';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "adminGereInscriptions" BOOLEAN NOT NULL DEFAULT false;
