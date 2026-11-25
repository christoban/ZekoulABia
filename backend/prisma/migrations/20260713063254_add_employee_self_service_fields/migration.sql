-- AlterTable
ALTER TABLE "EmployeeFile" ADD COLUMN     "documentsUrls" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "selfServiceCompletedAt" TIMESTAMP(3);
