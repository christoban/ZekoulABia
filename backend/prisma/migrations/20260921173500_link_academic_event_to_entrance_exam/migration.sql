-- AlterTable
ALTER TABLE "AcademicEvent" ADD COLUMN     "entranceExamSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AcademicEvent_entranceExamSessionId_key" ON "AcademicEvent"("entranceExamSessionId");

-- AddForeignKey
ALTER TABLE "AcademicEvent" ADD CONSTRAINT "AcademicEvent_entranceExamSessionId_fkey" FOREIGN KEY ("entranceExamSessionId") REFERENCES "EntranceExamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
