-- AlterTable
ALTER TABLE "TimetableSlot" ADD COLUMN     "isElectiveSlot" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StudentALevelSubject" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentALevelSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentALevelSubject_subjectId_idx" ON "StudentALevelSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentALevelSubject_studentId_subjectId_key" ON "StudentALevelSubject"("studentId", "subjectId");

-- AddForeignKey
ALTER TABLE "StudentALevelSubject" ADD CONSTRAINT "StudentALevelSubject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentALevelSubject" ADD CONSTRAINT "StudentALevelSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
