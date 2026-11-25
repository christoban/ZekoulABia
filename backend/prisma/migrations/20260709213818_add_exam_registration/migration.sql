-- CreateEnum
CREATE TYPE "TypeExamen" AS ENUM ('BEPC', 'PROBATOIRE', 'BAC', 'GCE_OL', 'GCE_AL', 'CAP', 'BT');

-- CreateEnum
CREATE TYPE "ExamRegStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CONFIRMED', 'RESULT_AVAILABLE');

-- CreateTable
CREATE TABLE "ExamRegistration" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "typeExamen" "TypeExamen" NOT NULL,
    "session" INTEGER NOT NULL,
    "matriculeNational" TEXT NOT NULL,
    "numeroCandidatExamen" TEXT,
    "paiementMinesecId" TEXT,
    "status" "ExamRegStatus" NOT NULL DEFAULT 'DRAFT',
    "resultatStatus" TEXT,
    "resultatMention" TEXT,
    "resultatScore" DOUBLE PRECISION,
    "resultatSource" TEXT,
    "resultatVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamRegistration_studentId_anneeScolaire_idx" ON "ExamRegistration"("studentId", "anneeScolaire");

-- CreateIndex
CREATE INDEX "ExamRegistration_schoolId_typeExamen_idx" ON "ExamRegistration"("schoolId", "typeExamen");

-- CreateIndex
CREATE INDEX "ExamRegistration_status_idx" ON "ExamRegistration"("status");

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
