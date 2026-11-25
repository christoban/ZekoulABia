-- AlterTable
ALTER TABLE "MatriculeImportJob" ADD COLUMN     "flaggedForCorrection" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "matchedRowsExact" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "matchedRowsFuzzyConfirmed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "matriculeMatchType" TEXT;
