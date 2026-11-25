-- CreateEnum
CREATE TYPE "AssessmentSessionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TeacherDepartment" (
    "teacherProfileId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "TeacherDepartment_pkey" PRIMARY KEY ("teacherProfileId","departmentId")
);

-- CreateTable
CREATE TABLE "AssessmentScope" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequenceType" "SequenceType" NOT NULL,
    "subjectIds" TEXT[],
    "classIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarmonizedAssessmentSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assessmentScopeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicSequenceId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "status" "AssessmentSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HarmonizedAssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentParticipation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "harmonizedAssessmentSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentScope_schoolId_academicYearId_idx" ON "AssessmentScope"("schoolId", "academicYearId");

-- CreateIndex
CREATE INDEX "HarmonizedAssessmentSession_schoolId_classId_scheduledDate_idx" ON "HarmonizedAssessmentSession"("schoolId", "classId", "scheduledDate");

-- CreateIndex
CREATE INDEX "HarmonizedAssessmentSession_schoolId_subjectId_idx" ON "HarmonizedAssessmentSession"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "AssessmentParticipation_schoolId_studentId_idx" ON "AssessmentParticipation"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentParticipation_harmonizedAssessmentSessionId_stude_key" ON "AssessmentParticipation"("harmonizedAssessmentSessionId", "studentId");

-- AddForeignKey
ALTER TABLE "TeacherDepartment" ADD CONSTRAINT "TeacherDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDepartment" ADD CONSTRAINT "TeacherDepartment_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentScope" ADD CONSTRAINT "AssessmentScope_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentScope" ADD CONSTRAINT "AssessmentScope_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarmonizedAssessmentSession" ADD CONSTRAINT "HarmonizedAssessmentSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarmonizedAssessmentSession" ADD CONSTRAINT "HarmonizedAssessmentSession_assessmentScopeId_fkey" FOREIGN KEY ("assessmentScopeId") REFERENCES "AssessmentScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarmonizedAssessmentSession" ADD CONSTRAINT "HarmonizedAssessmentSession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarmonizedAssessmentSession" ADD CONSTRAINT "HarmonizedAssessmentSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarmonizedAssessmentSession" ADD CONSTRAINT "HarmonizedAssessmentSession_academicSequenceId_fkey" FOREIGN KEY ("academicSequenceId") REFERENCES "AcademicSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentParticipation" ADD CONSTRAINT "AssessmentParticipation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentParticipation" ADD CONSTRAINT "AssessmentParticipation_harmonizedAssessmentSessionId_fkey" FOREIGN KEY ("harmonizedAssessmentSessionId") REFERENCES "HarmonizedAssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentParticipation" ADD CONSTRAINT "AssessmentParticipation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentParticipation" ADD CONSTRAINT "AssessmentParticipation_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
