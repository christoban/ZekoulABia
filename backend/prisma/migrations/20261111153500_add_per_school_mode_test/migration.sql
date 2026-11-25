-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "disabledSchoolIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SuppressedOutboundMessage" ADD COLUMN "schoolId" TEXT;

-- CreateIndex
CREATE INDEX "SuppressedOutboundMessage_schoolId_idx" ON "SuppressedOutboundMessage"("schoolId");
