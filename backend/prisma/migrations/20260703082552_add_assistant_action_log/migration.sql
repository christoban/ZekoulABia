-- CreateTable
CREATE TABLE "AssistantActionLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "destructive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'EXECUTED',
    "undoable" BOOLEAN NOT NULL DEFAULT true,
    "undoData" JSONB,
    "resultLabel" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "AssistantActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantActionLog_schoolId_idx" ON "AssistantActionLog"("schoolId");

-- CreateIndex
CREATE INDEX "AssistantActionLog_userId_idx" ON "AssistantActionLog"("userId");

-- CreateIndex
CREATE INDEX "AssistantActionLog_status_idx" ON "AssistantActionLog"("status");
