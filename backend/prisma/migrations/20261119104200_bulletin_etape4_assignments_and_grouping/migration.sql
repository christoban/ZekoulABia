-- CreateEnum
CREATE TYPE "BulletinGroupingScheme" AS ENUM ('FLAT', 'GROUP_1_2_3', 'SCI_LIT_OTHER', 'TECH_GEN_PRO_DIV', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BulletinPeriodKind" AS ENUM ('SEQUENCE', 'TRIMESTER', 'ANNUAL', 'MONTHLY');

-- AlterTable
ALTER TABLE "SchoolConfig"
ADD COLUMN "bulletinGroupingScheme" "BulletinGroupingScheme" NOT NULL DEFAULT 'FLAT',
ADD COLUMN "useMeasuredBulletinRenderer" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReportCard"
ADD COLUMN "templateSpecId" TEXT;

-- AlterTable
ALTER TABLE "BulletinRevocationArchive"
ADD COLUMN "templateSpecId" TEXT;

-- CreateTable
CREATE TABLE "BulletinTemplateAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classLevel" TEXT,
    "classId" TEXT,
    "periodKind" "BulletinPeriodKind" NOT NULL DEFAULT 'SEQUENCE',
    "template" "BulletinTemplate" NOT NULL DEFAULT 'FR_SECONDARY',
    "templateSpecId" TEXT NOT NULL DEFAULT 'GENERAL_GROUPED_V1',
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "groupingScheme" "BulletinGroupingScheme",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinTemplateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulletinTemplateAssignment_schoolId_periodKind_isActive_idx"
ON "BulletinTemplateAssignment"("schoolId", "periodKind", "isActive");

-- CreateIndex (NULLS NOT DISTINCT : empêche tout doublon quand classLevel et/ou classId sont NULL)
CREATE UNIQUE INDEX "BulletinTemplateAssignment_schoolId_classLevel_classId_peri_key"
ON "BulletinTemplateAssignment"("schoolId", "classLevel", "classId", "periodKind")
NULLS NOT DISTINCT;

-- AddForeignKey
ALTER TABLE "BulletinTemplateAssignment"
ADD CONSTRAINT "BulletinTemplateAssignment_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinTemplateAssignment"
ADD CONSTRAINT "BulletinTemplateAssignment_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
