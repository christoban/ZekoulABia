-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "level" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_schoolId_level_idx" ON "Conversation"("schoolId", "level");

-- CreateIndex
CREATE INDEX "Conversation_schoolId_classId_idx" ON "Conversation"("schoolId", "classId");
