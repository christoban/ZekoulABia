/*
  Warnings:

  - You are about to drop the column `room` on the `TimetableSlot` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('NORMAL', 'LABORATORY', 'WORKSHOP', 'COMPUTER_LAB', 'FIELD');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- AlterTable
ALTER TABLE "TimetableSlot" DROP COLUMN "room",
ADD COLUMN     "roomId" TEXT;

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'NORMAL',
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_schoolId_idx" ON "Room"("schoolId");

-- CreateIndex
CREATE INDEX "Room_deletedAt_idx" ON "Room"("deletedAt");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
