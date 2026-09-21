-- CreateEnum
CREATE TYPE "CandidatePresence" AS ENUM ('PRESENT', 'ABSENT', 'ABANDON');

-- AlterEnum
ALTER TYPE "AdmissionStatus" ADD VALUE 'ADMIS';
ALTER TYPE "AdmissionStatus" ADD VALUE 'LISTE_ATTENTE';
ALTER TYPE "AdmissionStatus" ADD VALUE 'REFUSE';
ALTER TYPE "AdmissionStatus" ADD VALUE 'REPECHE';
ALTER TYPE "AdmissionStatus" ADD VALUE 'INSCRIT';
ALTER TYPE "AdmissionStatus" ADD VALUE 'FORFAIT';

-- AlterEnum
ALTER TYPE "EntranceExamStatus" ADD VALUE 'REGISTRATION_OPEN';
ALTER TYPE "EntranceExamStatus" ADD VALUE 'SEATS_ASSIGNED';
ALTER TYPE "EntranceExamStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "EntranceExamStatus" ADD VALUE 'GRADING';
ALTER TYPE "EntranceExamStatus" ADD VALUE 'DELIBERATION';
ALTER TYPE "EntranceExamStatus" ADD VALUE 'PUBLISHED';

-- AlterTable
ALTER TABLE "EntranceExamCandidate" ADD COLUMN     "candidateNumber" TEXT,
ADD COLUMN     "deskNumber" INTEGER,
ADD COLUMN     "presenceStatus" "CandidatePresence" NOT NULL DEFAULT 'PRESENT',
ADD COLUMN     "rank" INTEGER,
ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "roomId" TEXT,
ADD COLUMN     "totalAverage" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "EntranceExamSession" ADD COLUMN     "deliberatedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "registrationDeadline" TIMESTAMP(3),
ADD COLUMN     "requireCepForAdmission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seatReservationDays" INTEGER NOT NULL DEFAULT 14;

-- CreateTable
CREATE TABLE "EntranceExamSubject" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "eliminatoryScore" DOUBLE PRECISION,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntranceExamSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntranceExamRoom" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntranceExamRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntranceExamCandidateGrade" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntranceExamCandidateGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntranceExamSubject_sessionId_idx" ON "EntranceExamSubject"("sessionId");

-- CreateIndex
CREATE INDEX "EntranceExamRoom_sessionId_idx" ON "EntranceExamRoom"("sessionId");

-- CreateIndex
CREATE INDEX "EntranceExamCandidateGrade_candidateId_idx" ON "EntranceExamCandidateGrade"("candidateId");

-- CreateIndex
CREATE INDEX "EntranceExamCandidateGrade_subjectId_idx" ON "EntranceExamCandidateGrade"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "EntranceExamCandidateGrade_candidateId_subjectId_key" ON "EntranceExamCandidateGrade"("candidateId", "subjectId");

-- CreateIndex
CREATE INDEX "EntranceExamCandidate_candidateNumber_idx" ON "EntranceExamCandidate"("candidateNumber");

-- CreateIndex
CREATE INDEX "EntranceExamCandidate_roomId_idx" ON "EntranceExamCandidate"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "EntranceExamCandidate_sessionId_candidateNumber_key" ON "EntranceExamCandidate"("sessionId", "candidateNumber");

-- AddForeignKey
ALTER TABLE "EntranceExamSubject" ADD CONSTRAINT "EntranceExamSubject_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EntranceExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntranceExamRoom" ADD CONSTRAINT "EntranceExamRoom_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EntranceExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntranceExamCandidate" ADD CONSTRAINT "EntranceExamCandidate_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "EntranceExamRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntranceExamCandidateGrade" ADD CONSTRAINT "EntranceExamCandidateGrade_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "EntranceExamCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntranceExamCandidateGrade" ADD CONSTRAINT "EntranceExamCandidateGrade_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "EntranceExamSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
