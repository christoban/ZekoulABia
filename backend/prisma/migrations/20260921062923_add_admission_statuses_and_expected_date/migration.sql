-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdmissionStatus" ADD VALUE 'NON_ADMIS';
ALTER TYPE "AdmissionStatus" ADD VALUE 'DESISTE';
ALTER TYPE "AdmissionStatus" ADD VALUE 'ABSENT';

-- AlterTable
ALTER TABLE "EntranceExamSession" ADD COLUMN     "officialExamExpectedDate" TIMESTAMP(3);
