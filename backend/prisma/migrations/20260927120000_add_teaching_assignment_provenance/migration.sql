CREATE TYPE "TeachingAssignmentSource" AS ENUM ('MANUAL', 'GENERATED', 'UNKNOWN');

ALTER TABLE "School" ADD COLUMN "defaultMaxWeeklyHours" INTEGER;
ALTER TABLE "TeacherProfile" ADD COLUMN "maxWeeklyHours" INTEGER;
ALTER TABLE "TeachingAssignment" ADD COLUMN "source" "TeachingAssignmentSource" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "TeachingAssignment" ADD COLUMN "createdAt" TIMESTAMP(3);

ALTER TABLE "School" ADD CONSTRAINT "School_defaultMaxWeeklyHours_check" CHECK ("defaultMaxWeeklyHours" IS NULL OR "defaultMaxWeeklyHours" > 0);
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_maxWeeklyHours_check" CHECK ("maxWeeklyHours" IS NULL OR "maxWeeklyHours" > 0);
