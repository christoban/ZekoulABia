-- AlterTable
ALTER TABLE "StudentFollowUpAction" ADD COLUMN     "subjectId" TEXT;

-- AddForeignKey
ALTER TABLE "StudentFollowUpAction" ADD CONSTRAINT "StudentFollowUpAction_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
