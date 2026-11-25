-- CreateEnum
CREATE TYPE "GroupTransferType" AS ENUM ('STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "GroupTransferStatus" AS ENUM ('PENDING_TARGET_ADMIN', 'ACCEPTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "OnboardingSource" ADD VALUE 'GROUPE_TRANSFERT';

-- CreateTable
CREATE TABLE "GroupTransferRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "type" "GroupTransferType" NOT NULL,
    "sourceSchoolId" TEXT NOT NULL,
    "targetSchoolId" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "status" "GroupTransferStatus" NOT NULL DEFAULT 'PENDING_TARGET_ADMIN',
    "onboardingId" TEXT,
    "requestedByOwnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "GroupTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupTransferRequest_groupId_idx" ON "GroupTransferRequest"("groupId");

-- CreateIndex
CREATE INDEX "GroupTransferRequest_targetSchoolId_status_idx" ON "GroupTransferRequest"("targetSchoolId", "status");
