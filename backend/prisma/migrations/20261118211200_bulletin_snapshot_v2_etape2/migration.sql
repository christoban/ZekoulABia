-- AlterEnum
ALTER TYPE "ReportCardStatus" ADD VALUE 'REVOKED';

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "isRepeater" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placeOfBirth" TEXT;

-- AlterTable
ALTER TABLE "SubjectCoefficient" ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "groupLabel" TEXT,
ADD COLUMN     "groupOrder" INTEGER;

-- AlterTable
ALTER TABLE "ClassSubjectOverride" ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "groupLabel" TEXT,
ADD COLUMN     "groupOrder" INTEGER;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "groupLabel" TEXT,
ADD COLUMN     "groupOrder" INTEGER;

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN     "computationVersion" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "reprintCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revocationReason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedById" TEXT,
ADD COLUMN     "snapshotData" JSONB,
ADD COLUMN     "templateVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "verifyToken" TEXT;

-- Marquer tous les bulletins préexistants en base comme version 1 (les nouveaux prennent le défaut 2)
UPDATE "ReportCard" SET "computationVersion" = 1;

-- AlterTable
ALTER TABLE "ReportCardSubjectLine" ADD COLUMN     "classSubjectAverage" DOUBLE PRECISION,
ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "groupLabel" TEXT,
ADD COLUMN     "groupOrder" INTEGER,
ADD COLUMN     "maxSubjectAverage" DOUBLE PRECISION,
ADD COLUMN     "minSubjectAverage" DOUBLE PRECISION,
ADD COLUMN     "teacherName" TEXT;

-- CreateTable
CREATE TABLE "BulletinRevocationArchive" (
    "id" TEXT NOT NULL,
    "originalReportCardId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "academicPeriodId" TEXT NOT NULL,
    "computationVersion" INTEGER NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "generalAverage" DOUBLE PRECISION,
    "rank" INTEGER,
    "snapshotData" JSONB,
    "contentHash" TEXT,
    "verifyToken" TEXT,
    "revokedById" TEXT NOT NULL,
    "revocationReason" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinRevocationArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulletinRevocationArchive_schoolId_studentId_idx" ON "BulletinRevocationArchive"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "BulletinRevocationArchive_originalReportCardId_idx" ON "BulletinRevocationArchive"("originalReportCardId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_verifyToken_key" ON "ReportCard"("verifyToken");
