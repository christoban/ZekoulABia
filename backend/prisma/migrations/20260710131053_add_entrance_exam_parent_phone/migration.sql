-- DropIndex
DROP INDEX "MatriculeImportJob_schoolId_idx";

-- AlterTable
ALTER TABLE "EntranceExamCandidate" ADD COLUMN     "parentPhone" TEXT;
