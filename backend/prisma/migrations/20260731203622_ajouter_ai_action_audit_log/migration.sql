-- CreateEnum
CREATE TYPE "AIActionOrigin" AS ENUM ('UI_DIRECT', 'AI_ASSISTANT');

-- CreateEnum
CREATE TYPE "AIActionOutcome" AS ENUM ('SUCCES', 'REFUSE', 'ERREUR');

-- CreateTable
CREATE TABLE "AIActionAuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "schoolId" TEXT,
    "actionName" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "origin" "AIActionOrigin" NOT NULL,
    "outcome" "AIActionOutcome" NOT NULL,
    "refusalReason" TEXT,
    "parametersSummary" JSONB,
    "triggeringMessage" TEXT,

    CONSTRAINT "AIActionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIActionAuditLog_actorUserId_timestamp_idx" ON "AIActionAuditLog"("actorUserId", "timestamp");

-- CreateIndex
CREATE INDEX "AIActionAuditLog_schoolId_timestamp_idx" ON "AIActionAuditLog"("schoolId", "timestamp");

-- CreateIndex
CREATE INDEX "AIActionAuditLog_outcome_timestamp_idx" ON "AIActionAuditLog"("outcome", "timestamp");
