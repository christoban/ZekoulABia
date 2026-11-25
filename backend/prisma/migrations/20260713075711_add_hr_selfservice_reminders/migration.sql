-- AlterTable
ALTER TABLE "EmployeeFile" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "remindersSentCount" INTEGER NOT NULL DEFAULT 0;
