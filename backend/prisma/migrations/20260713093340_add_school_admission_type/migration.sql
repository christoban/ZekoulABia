-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('MIXTE', 'FILLES', 'GARCONS');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "admissionType" "AdmissionType" NOT NULL DEFAULT 'MIXTE';
