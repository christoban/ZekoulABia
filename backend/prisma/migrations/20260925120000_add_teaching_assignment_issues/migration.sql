CREATE TABLE "TeachingAssignmentIssue" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "details" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "TeachingAssignmentIssue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeachingAssignmentIssue_schoolId_academicYearId_classId_subjectId_key"
ON "TeachingAssignmentIssue"("schoolId", "academicYearId", "classId", "subjectId");

CREATE INDEX "TeachingAssignmentIssue_schoolId_academicYearId_status_idx"
ON "TeachingAssignmentIssue"("schoolId", "academicYearId", "status");
