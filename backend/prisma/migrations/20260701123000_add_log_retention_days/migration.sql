-- Add log retention control to SchoolSettings
ALTER TABLE "SchoolSettings"
ADD COLUMN "logRetentionDays" INTEGER NOT NULL DEFAULT 90;