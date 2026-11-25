-- AlterTable
ALTER TABLE "FeePlan" ADD COLUMN     "academicYearId" TEXT;

-- CreateIndex
CREATE INDEX "FeePlan_schoolId_academicYearId_idx" ON "FeePlan"("schoolId", "academicYearId");

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
