-- CreateEnum
CREATE TYPE "OrientationCheckpointType" AS ENUM ('FIN_TROISIEME', 'FIN_SECONDE_C');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('ELEVEE', 'MOYENNE', 'FAIBLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutRecommandation" ADD VALUE 'CALCULEE';
ALTER TYPE "StatutRecommandation" ADD VALUE 'VALIDEE_CONSEILLER';
ALTER TYPE "StatutRecommandation" ADD VALUE 'PROPOSEE_A_L_ELEVE';
ALTER TYPE "StatutRecommandation" ADD VALUE 'VALIDEE_ELEVE';
ALTER TYPE "StatutRecommandation" ADD VALUE 'VALIDEE_PAR_DEFAUT';

-- AlterTable
ALTER TABLE "RecommandationSerie" ADD COLUMN     "checkpointType" "OrientationCheckpointType",
ADD COLUMN     "confidenceLevel" "ConfidenceLevel",
ADD COLUMN     "dataDepthMonths" INTEGER,
ADD COLUMN     "finalTrack" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "remindersSentAt" JSONB,
ADD COLUMN     "responseDeadline" TIMESTAMP(3),
ADD COLUMN     "studentChosenTrack" TEXT,
ADD COLUMN     "suggestedTracks" JSONB;

-- AlterTable
ALTER TABLE "SchoolConfig" ADD COLUMN     "hasDedicatedOrientationCounselor" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TestAptitude" ADD COLUMN     "administeredById" TEXT,
ADD COLUMN     "checkpointType" "OrientationCheckpointType",
ADD COLUMN     "literaryAptitude" INTEGER,
ADD COLUMN     "scientificAptitude" INTEGER,
ADD COLUMN     "technicalAptitude" INTEGER;

-- CreateTable
CREATE TABLE "OrientationCheckpointConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "OrientationCheckpointType" NOT NULL,
    "possibleTracks" JSONB NOT NULL,
    "relevantSubjects" JSONB NOT NULL,
    "psychotechnicalTestRequired" BOOLEAN NOT NULL DEFAULT false,
    "windowStartMonth" INTEGER NOT NULL DEFAULT 3,
    "windowStartDay" INTEGER NOT NULL DEFAULT 1,
    "windowEndMonth" INTEGER NOT NULL DEFAULT 5,
    "windowEndDay" INTEGER NOT NULL DEFAULT 31,
    "responseDeadlineDays" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrientationCheckpointConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAspiration" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "checkpointType" "OrientationCheckpointType" NOT NULL,
    "desiredTrack" TEXT,
    "careerInterest" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAspiration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrientationCheckpointConfig_schoolId_type_key" ON "OrientationCheckpointConfig"("schoolId", "type");

-- CreateIndex
CREATE INDEX "StudentAspiration_schoolId_checkpointType_idx" ON "StudentAspiration"("schoolId", "checkpointType");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAspiration_studentId_checkpointType_key" ON "StudentAspiration"("studentId", "checkpointType");

-- CreateIndex
CREATE INDEX "TestAptitude_ficheOrientationId_checkpointType_idx" ON "TestAptitude"("ficheOrientationId", "checkpointType");

-- AddForeignKey
ALTER TABLE "OrientationCheckpointConfig" ADD CONSTRAINT "OrientationCheckpointConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAspiration" ADD CONSTRAINT "StudentAspiration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAptitude" ADD CONSTRAINT "TestAptitude_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
