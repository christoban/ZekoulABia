-- CreateEnum
CREATE TYPE "AnonymatStatus" AS ENUM ('NONE', 'CODES_GENERES', 'EQUIPE_DESIGNEE', 'ANONYMISATION_EN_COURS', 'ANONYMISATION_TERMINEE', 'EN_CORRECTION', 'CORRECTION_TERMINEE', 'RECONCILIE');

-- CreateEnum
CREATE TYPE "CorrectionMode" AS ENUM ('OWN_CLASS', 'CROSSED');

-- CreateEnum
CREATE TYPE "AnonymatTeamMemberStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'EXPIRED');

-- AlterTable
ALTER TABLE "HarmonizedAssessmentSession" ADD COLUMN     "anonymatStatus" "AnonymatStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "codesGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "codesGeneratedById" TEXT,
ADD COLUMN     "correctionMode" "CorrectionMode",
ADD COLUMN     "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciledById" TEXT;

-- CreateTable
CREATE TABLE "AnonymatCode" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assessmentSessionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT NOT NULL,

    CONSTRAINT "AnonymatCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAnonyme" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assessmentSessionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "isIllegible" BOOLEAN NOT NULL DEFAULT false,
    "correcteurId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "NoteAnonyme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymatTeamMember" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assessmentSessionId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "magicTokenHash" TEXT NOT NULL,
    "magicTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "assignedClassIds" TEXT[],
    "classSliceStart" INTEGER,
    "classSliceEnd" INTEGER,
    "status" "AnonymatTeamMemberStatus" NOT NULL DEFAULT 'PENDING',
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymatTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assessmentSessionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "correcteurUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnonymatCode_assessmentSessionId_classId_idx" ON "AnonymatCode"("assessmentSessionId", "classId");

-- CreateIndex
CREATE INDEX "AnonymatCode_schoolId_idx" ON "AnonymatCode"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymatCode_assessmentSessionId_code_key" ON "AnonymatCode"("assessmentSessionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymatCode_assessmentSessionId_studentProfileId_key" ON "AnonymatCode"("assessmentSessionId", "studentProfileId");

-- CreateIndex
CREATE INDEX "NoteAnonyme_assessmentSessionId_correcteurId_idx" ON "NoteAnonyme"("assessmentSessionId", "correcteurId");

-- CreateIndex
CREATE INDEX "NoteAnonyme_schoolId_idx" ON "NoteAnonyme"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteAnonyme_assessmentSessionId_code_key" ON "NoteAnonyme"("assessmentSessionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymatTeamMember_magicTokenHash_key" ON "AnonymatTeamMember"("magicTokenHash");

-- CreateIndex
CREATE INDEX "AnonymatTeamMember_assessmentSessionId_idx" ON "AnonymatTeamMember"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "AnonymatTeamMember_magicTokenHash_idx" ON "AnonymatTeamMember"("magicTokenHash");

-- CreateIndex
CREATE INDEX "CorrectionAssignment_correcteurUserId_idx" ON "CorrectionAssignment"("correcteurUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectionAssignment_assessmentSessionId_classId_key" ON "CorrectionAssignment"("assessmentSessionId", "classId");

-- AddForeignKey
ALTER TABLE "AnonymatCode" ADD CONSTRAINT "AnonymatCode_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "HarmonizedAssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymatCode" ADD CONSTRAINT "AnonymatCode_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymatCode" ADD CONSTRAINT "AnonymatCode_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAnonyme" ADD CONSTRAINT "NoteAnonyme_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "HarmonizedAssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAnonyme" ADD CONSTRAINT "NoteAnonyme_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymatTeamMember" ADD CONSTRAINT "AnonymatTeamMember_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "HarmonizedAssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymatTeamMember" ADD CONSTRAINT "AnonymatTeamMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionAssignment" ADD CONSTRAINT "CorrectionAssignment_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "HarmonizedAssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionAssignment" ADD CONSTRAINT "CorrectionAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
