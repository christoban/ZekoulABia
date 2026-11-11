-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "passwordFailures" INTEGER NOT NULL DEFAULT 0;
