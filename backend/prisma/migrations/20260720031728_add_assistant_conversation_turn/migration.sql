-- CreateTable
CREATE TABLE "AssistantConversationTurn" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantConversationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantConversationTurn_conversationId_createdAt_idx" ON "AssistantConversationTurn"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantConversationTurn_schoolId_userId_idx" ON "AssistantConversationTurn"("schoolId", "userId");
