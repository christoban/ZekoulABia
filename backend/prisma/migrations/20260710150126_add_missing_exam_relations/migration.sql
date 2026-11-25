-- CreateIndex
CREATE INDEX "PebsExamCandidate_studentProfileId_idx" ON "PebsExamCandidate"("studentProfileId");

-- AddForeignKey
ALTER TABLE "Lv2ChoiceSubmission" ADD CONSTRAINT "Lv2ChoiceSubmission_chosenSubjectId_fkey" FOREIGN KEY ("chosenSubjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PebsExamCandidate" ADD CONSTRAINT "PebsExamCandidate_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
