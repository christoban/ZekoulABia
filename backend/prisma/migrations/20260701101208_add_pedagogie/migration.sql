/*
  Warnings:

  - A unique constraint covering the columns `[professorPrincipalId]` on the table `Class` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[headId]` on the table `Department` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resetPasswordToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VerifiableDocumentType" AS ENUM ('CERTIFICATE', 'STUDENT_CARD', 'TRANSFER_LETTER', 'REPORT_CARD');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'ABSENT_JUSTIFIED';

-- AlterEnum
ALTER TYPE "SequenceType" ADD VALUE 'UA';

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "observation" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetPasswordToken" TEXT,
ADD COLUMN     "resetPasswordTokenExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ClassSubjectOverride" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ClassSubjectOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target" JSONB NOT NULL,
    "message" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "BroadcastLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiableDocument" (
    "id" TEXT NOT NULL,
    "type" "VerifiableDocumentType" NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSnapshot" JSONB NOT NULL,

    CONSTRAINT "VerifiableDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT,
    "level" TEXT,
    "academicYearId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapitre" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "volumeHeuresPrevu" INTEGER NOT NULL DEFAULT 2,
    "sequenceCibleFin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chapitre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CahierDeTexte" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "chapitreId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contenuRealise" TEXT NOT NULL,
    "devoirsDonnes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CahierDeTexte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassSubjectOverride_schoolId_idx" ON "ClassSubjectOverride"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubjectOverride_classId_subjectId_key" ON "ClassSubjectOverride"("classId", "subjectId");

-- CreateIndex
CREATE INDEX "BroadcastLog_schoolId_idx" ON "BroadcastLog"("schoolId");

-- CreateIndex
CREATE INDEX "BroadcastLog_schoolId_createdAt_idx" ON "BroadcastLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "VerifiableDocument_studentId_idx" ON "VerifiableDocument"("studentId");

-- CreateIndex
CREATE INDEX "VerifiableDocument_schoolId_idx" ON "VerifiableDocument"("schoolId");

-- CreateIndex
CREATE INDEX "Programme_schoolId_idx" ON "Programme"("schoolId");

-- CreateIndex
CREATE INDEX "Programme_subjectId_idx" ON "Programme"("subjectId");

-- CreateIndex
CREATE INDEX "Programme_academicYearId_idx" ON "Programme"("academicYearId");

-- CreateIndex
CREATE INDEX "Chapitre_programmeId_idx" ON "Chapitre"("programmeId");

-- CreateIndex
CREATE INDEX "CahierDeTexte_schoolId_idx" ON "CahierDeTexte"("schoolId");

-- CreateIndex
CREATE INDEX "CahierDeTexte_teacherId_idx" ON "CahierDeTexte"("teacherId");

-- CreateIndex
CREATE INDEX "CahierDeTexte_classId_idx" ON "CahierDeTexte"("classId");

-- CreateIndex
CREATE INDEX "CahierDeTexte_subjectId_idx" ON "CahierDeTexte"("subjectId");

-- CreateIndex
CREATE INDEX "CahierDeTexte_academicYearId_idx" ON "CahierDeTexte"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_professorPrincipalId_key" ON "Class"("professorPrincipalId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_headId_key" ON "Department"("headId");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");

-- AddForeignKey
ALTER TABLE "ClassSubjectOverride" ADD CONSTRAINT "ClassSubjectOverride_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubjectOverride" ADD CONSTRAINT "ClassSubjectOverride_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubjectOverride" ADD CONSTRAINT "ClassSubjectOverride_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastLog" ADD CONSTRAINT "BroadcastLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiableDocument" ADD CONSTRAINT "VerifiableDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiableDocument" ADD CONSTRAINT "VerifiableDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapitre" ADD CONSTRAINT "Chapitre_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTexte" ADD CONSTRAINT "CahierDeTexte_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTexte" ADD CONSTRAINT "CahierDeTexte_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTexte" ADD CONSTRAINT "CahierDeTexte_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTexte" ADD CONSTRAINT "CahierDeTexte_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTexte" ADD CONSTRAINT "CahierDeTexte_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierDeTexte" ADD CONSTRAINT "CahierDeTexte_chapitreId_fkey" FOREIGN KEY ("chapitreId") REFERENCES "Chapitre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
