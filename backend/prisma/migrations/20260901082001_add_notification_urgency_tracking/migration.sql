/*
  Warnings:

  - You are about to drop the column `isRead` on the `Notification` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "NotificationUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- DropIndex
DROP INDEX "Notification_schoolId_userId_isRead_idx";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "isRead",
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "urgency" "NotificationUrgency" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX "Notification_schoolId_userId_readAt_idx" ON "Notification"("schoolId", "userId", "readAt");
