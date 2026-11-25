-- CreateEnum
CREATE TYPE "ChoiceWindowStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubmissionMethod" AS ENUM ('STUDENT_DIRECT', 'ADMIN_MANUAL');

-- CreateTable
CREATE TABLE "Lv2ChoiceWindow" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "openDate" TIMESTAMP(3) NOT NULL,
    "closeDate" TIMESTAMP(3) NOT NULL,
    "status" "ChoiceWindowStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lv2ChoiceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lv2ChoiceSubmission" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "chosenSubjectId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionMethod" "SubmissionMethod" NOT NULL,
    "submittedByUserId" TEXT,

    CONSTRAINT "Lv2ChoiceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lv2ChoiceSubmission_windowId_studentProfileId_key" ON "Lv2ChoiceSubmission"("windowId", "studentProfileId");

-- CreateIndex
CREATE INDEX "Lv2ChoiceWindow_schoolId_idx" ON "Lv2ChoiceWindow"("schoolId");

-- CreateIndex
CREATE INDEX "Lv2ChoiceWindow_academicYearId_idx" ON "Lv2ChoiceWindow"("academicYearId");

-- CreateIndex
CREATE INDEX "Lv2ChoiceSubmission_windowId_idx" ON "Lv2ChoiceSubmission"("windowId");

-- CreateIndex
CREATE INDEX "Lv2ChoiceSubmission_studentProfileId_idx" ON "Lv2ChoiceSubmission"("studentProfileId");

-- AddForeignKey
ALTER TABLE "Lv2ChoiceSubmission" ADD CONSTRAINT "Lv2ChoiceSubmission_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "Lv2ChoiceWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
