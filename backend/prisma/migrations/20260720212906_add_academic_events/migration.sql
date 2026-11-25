-- CreateEnum
CREATE TYPE "AcademicEventCategory" AS ENUM ('FIXED_DATE', 'MANUAL_TRIGGER', 'SLIDING_WINDOW');

-- CreateEnum
CREATE TYPE "AcademicEventStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "AcademicEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" "AcademicEventCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetRoles" TEXT[],
    "openDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "status" "AcademicEventStatus" NOT NULL DEFAULT 'UPCOMING',
    "triggeredById" TEXT,
    "triggeredAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCalendarException" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolCalendarException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicEvent_schoolId_status_idx" ON "AcademicEvent"("schoolId", "status");

-- CreateIndex
CREATE INDEX "SchoolCalendarException_schoolId_idx" ON "SchoolCalendarException"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCalendarException_schoolId_date_key" ON "SchoolCalendarException"("schoolId", "date");

-- AddForeignKey
ALTER TABLE "AcademicEvent" ADD CONSTRAINT "AcademicEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicEvent" ADD CONSTRAINT "AcademicEvent_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicEvent" ADD CONSTRAINT "AcademicEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCalendarException" ADD CONSTRAINT "SchoolCalendarException_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
