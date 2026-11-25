-- AlterTable
ALTER TABLE "SchoolConfig" ADD COLUMN     "configOverrides" JSONB NOT NULL DEFAULT '[]';
