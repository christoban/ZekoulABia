-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "harmonizedAssessmentSessionId" TEXT,
ADD COLUMN     "isAbsentGrade" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_harmonizedAssessmentSessionId_fkey" FOREIGN KEY ("harmonizedAssessmentSessionId") REFERENCES "HarmonizedAssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
