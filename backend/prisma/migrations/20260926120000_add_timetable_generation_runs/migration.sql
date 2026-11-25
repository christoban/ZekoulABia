CREATE TABLE "TimetableGenerationRun" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "preflightReport" JSONB,
    "results" JSONB,
    "progress" JSONB,
    "errorMessage" TEXT,
    "budgetSeconds" INTEGER NOT NULL DEFAULT 600,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "TimetableGenerationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimetableGenerationRun_schoolId_academicYearId_status_idx"
ON "TimetableGenerationRun"("schoolId", "academicYearId", "status");

CREATE INDEX "TimetableGenerationRun_schoolId_heartbeatAt_idx"
ON "TimetableGenerationRun"("schoolId", "heartbeatAt");
