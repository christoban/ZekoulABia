-- CreateEnum
CREATE TYPE "EntranceExamStatus" AS ENUM ('DRAFT', 'RESULTS_PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('PENDING', 'ADMIS_PROVISOIRE', 'CONFIRME', 'ANNULE');

-- CreateEnum
CREATE TYPE "CepResult" AS ENUM ('NON_PASSE', 'REUSSI', 'ECHOUE');

-- CreateTable
CREATE TABLE "EntranceExamSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "admissionThreshold" DOUBLE PRECISION,
    "availableSeats" INTEGER,
    "status" "EntranceExamStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntranceExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntranceExamCandidate" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "originSchool" TEXT,
    "examScore" DOUBLE PRECISION,
    "admissionStatus" "AdmissionStatus" NOT NULL DEFAULT 'PENDING',
    "cepResult" "CepResult" DEFAULT 'NON_PASSE',
    "cepResultDate" TIMESTAMP(3),
    "studentProfileId" TEXT,

    CONSTRAINT "EntranceExamCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntranceExamSession_schoolId_idx" ON "EntranceExamSession"("schoolId");

-- CreateIndex
CREATE INDEX "EntranceExamSession_academicYearId_idx" ON "EntranceExamSession"("academicYearId");

-- CreateIndex
CREATE INDEX "EntranceExamCandidate_sessionId_idx" ON "EntranceExamCandidate"("sessionId");

-- CreateIndex
CREATE INDEX "EntranceExamCandidate_admissionStatus_idx" ON "EntranceExamCandidate"("admissionStatus");

-- AddForeignKey
ALTER TABLE "EntranceExamCandidate" ADD CONSTRAINT "EntranceExamCandidate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EntranceExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
