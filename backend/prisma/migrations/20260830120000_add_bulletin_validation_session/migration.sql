-- CreateEnum
CREATE TYPE "BulletinValidationStatus" AS ENUM ('SUBMITTED', 'VALIDATED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN "classWorkflowStatus" "BulletinValidationStatus";

-- CreateTable
CREATE TABLE "BulletinValidationSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicPeriodId" TEXT NOT NULL,
    "status" "BulletinValidationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "BulletinValidationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulletinValidationSession_classId_academicPeriodId_key" ON "BulletinValidationSession"("classId", "academicPeriodId");

-- CreateIndex
CREATE INDEX "BulletinValidationSession_schoolId_idx" ON "BulletinValidationSession"("schoolId");

-- AddForeignKey
ALTER TABLE "BulletinValidationSession" ADD CONSTRAINT "BulletinValidationSession_academicPeriodId_fkey" FOREIGN KEY ("academicPeriodId") REFERENCES "AcademicPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinValidationSession" ADD CONSTRAINT "BulletinValidationSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinValidationSession" ADD CONSTRAINT "BulletinValidationSession_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinValidationSession" ADD CONSTRAINT "BulletinValidationSession_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinValidationSession" ADD CONSTRAINT "BulletinValidationSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
