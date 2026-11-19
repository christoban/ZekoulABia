-- CreateTable
CREATE TABLE "StudentSequenceAbsenceSummary" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "academicPeriodId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "justifiedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unjustifiedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consignesCount" INTEGER NOT NULL DEFAULT 0,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSequenceAbsenceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentSequenceAbsenceSummary_schoolId_classId_academicPerio_idx"
ON "StudentSequenceAbsenceSummary"("schoolId", "classId", "academicPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSequenceAbsenceSummary_studentId_sequenceId_key"
ON "StudentSequenceAbsenceSummary"("studentId", "sequenceId");

-- AddForeignKey
ALTER TABLE "StudentSequenceAbsenceSummary"
ADD CONSTRAINT "StudentSequenceAbsenceSummary_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSequenceAbsenceSummary"
ADD CONSTRAINT "StudentSequenceAbsenceSummary_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSequenceAbsenceSummary"
ADD CONSTRAINT "StudentSequenceAbsenceSummary_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSequenceAbsenceSummary"
ADD CONSTRAINT "StudentSequenceAbsenceSummary_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSequenceAbsenceSummary"
ADD CONSTRAINT "StudentSequenceAbsenceSummary_academicYearId_fkey"
FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSequenceAbsenceSummary"
ADD CONSTRAINT "StudentSequenceAbsenceSummary_academicPeriodId_fkey"
FOREIGN KEY ("academicPeriodId") REFERENCES "AcademicPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSequenceAbsenceSummary"
ADD CONSTRAINT "StudentSequenceAbsenceSummary_sequenceId_fkey"
FOREIGN KEY ("sequenceId") REFERENCES "AcademicSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

