ALTER TYPE "TimetableStatus" ADD VALUE 'SUBMITTED';
ALTER TABLE "TimetableSlot" ADD COLUMN "managedBySolver" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Timetable_schoolId_status_idx" ON "Timetable"("schoolId", "status");
