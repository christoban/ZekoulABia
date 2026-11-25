-- Add backup tracking fields to SchoolSettings
ALTER TABLE "SchoolSettings"
ADD COLUMN "lastBackupAt" TIMESTAMP(3),
ADD COLUMN "lastBackupFile" TEXT;