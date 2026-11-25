-- CreateEnum
CREATE TYPE "StudentFollowUpActionType" AS ENUM ('ENTRETIEN_PARENT', 'SIGNALEMENT_CONSEILLER', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "StudentFollowUpStatus" AS ENUM ('OUVERT', 'EN_COURS', 'CLOS');

-- CreateTable
CREATE TABLE "StudentFollowUpAction" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "triggeringRecommendationId" TEXT,
    "type" "StudentFollowUpActionType" NOT NULL,
    "status" "StudentFollowUpStatus" NOT NULL DEFAULT 'OUVERT',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "targetDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closingNote" TEXT,

    CONSTRAINT "StudentFollowUpAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentFollowUpAction_studentProfileId_idx" ON "StudentFollowUpAction"("studentProfileId");

-- CreateIndex
CREATE INDEX "StudentFollowUpAction_schoolId_assignedToId_status_idx" ON "StudentFollowUpAction"("schoolId", "assignedToId", "status");

-- AddForeignKey
ALTER TABLE "StudentFollowUpAction" ADD CONSTRAINT "StudentFollowUpAction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFollowUpAction" ADD CONSTRAINT "StudentFollowUpAction_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFollowUpAction" ADD CONSTRAINT "StudentFollowUpAction_triggeringRecommendationId_fkey" FOREIGN KEY ("triggeringRecommendationId") REFERENCES "StudentRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFollowUpAction" ADD CONSTRAINT "StudentFollowUpAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFollowUpAction" ADD CONSTRAINT "StudentFollowUpAction_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFollowUpAction" ADD CONSTRAINT "StudentFollowUpAction_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
