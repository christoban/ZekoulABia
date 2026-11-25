-- CreateEnum
CREATE TYPE "PebsExamStatus" AS ENUM ('DRAFT', 'RESULTS_PENDING', 'APPLIED');

-- CreateEnum
CREATE TYPE "SelectionResult" AS ENUM ('PENDING', 'SELECTIONNE', 'NON_SELECTIONNE');

-- CreateTable
CREATE TABLE "PebsExamSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "level" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "selectionThreshold" DOUBLE PRECISION,
    "availableSeats" INTEGER,
    "targetClassId" TEXT NOT NULL,
    "status" "PebsExamStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PebsExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PebsExamCandidate" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "currentClassId" TEXT NOT NULL,
    "examScore" DOUBLE PRECISION,
    "selectionResult" "SelectionResult" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "PebsExamCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PebsExamSession_schoolId_idx" ON "PebsExamSession"("schoolId");

-- CreateIndex
CREATE INDEX "PebsExamSession_academicYearId_idx" ON "PebsExamSession"("academicYearId");

-- CreateIndex
CREATE INDEX "PebsExamCandidate_sessionId_idx" ON "PebsExamCandidate"("sessionId");

-- CreateIndex
CREATE INDEX "PebsExamCandidate_selectionResult_idx" ON "PebsExamCandidate"("selectionResult");

-- AddForeignKey
ALTER TABLE "PebsExamCandidate" ADD CONSTRAINT "PebsExamCandidate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PebsExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
