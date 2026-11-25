-- CreateEnum
CREATE TYPE "StaffAttendanceMode" AS ENUM ('QR', 'GPS', 'MANUEL');

-- AlterEnum
ALTER TYPE "StaffAttendanceStatus" ADD VALUE 'A_VERIFIER';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "qrEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StaffAttendance" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "mode" "StaffAttendanceMode",
ADD COLUMN     "qrToken" TEXT,
ADD COLUMN     "roomId" TEXT,
ADD COLUMN     "timetableSlotId" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- CreateTable
CREATE TABLE "StaffAttendanceSettings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gpsRadiusMeters" INTEGER NOT NULL DEFAULT 75,
    "qrTokenTtlSeconds" INTEGER NOT NULL DEFAULT 120,
    "schoolLatitude" DOUBLE PRECISION,
    "schoolLongitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceSettings_schoolId_key" ON "StaffAttendanceSettings"("schoolId");

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceSettings" ADD CONSTRAINT "StaffAttendanceSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
