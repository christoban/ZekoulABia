-- CreateTable
CREATE TABLE "StudentRecommendation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT,
    "recipientRole" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentRecommendation_schoolId_studentId_idx" ON "StudentRecommendation"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "StudentRecommendation_studentId_contextType_createdAt_idx" ON "StudentRecommendation"("studentId", "contextType", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentRecommendation" ADD CONSTRAINT "StudentRecommendation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRecommendation" ADD CONSTRAINT "StudentRecommendation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
