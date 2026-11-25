-- CreateEnum
CREATE TYPE "DisciplineCouncilStatus" AS ENUM ('CONVOQUE', 'TENU', 'ANNULE');

-- CreateTable
CREATE TABLE "DisciplineCouncilSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "presidedById" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "composition" JSONB NOT NULL,
    "parentNotifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "heldAt" TIMESTAMP(3),
    "decision" "DisciplineType",
    "pv" TEXT,
    "status" "DisciplineCouncilStatus" NOT NULL DEFAULT 'CONVOQUE',
    "disciplineRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplineCouncilSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineCouncilSession_disciplineRecordId_key" ON "DisciplineCouncilSession"("disciplineRecordId");

-- CreateIndex
CREATE INDEX "DisciplineCouncilSession_schoolId_studentId_idx" ON "DisciplineCouncilSession"("schoolId", "studentId");

-- AddForeignKey
ALTER TABLE "DisciplineCouncilSession" ADD CONSTRAINT "DisciplineCouncilSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineCouncilSession" ADD CONSTRAINT "DisciplineCouncilSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineCouncilSession" ADD CONSTRAINT "DisciplineCouncilSession_presidedById_fkey" FOREIGN KEY ("presidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineCouncilSession" ADD CONSTRAINT "DisciplineCouncilSession_disciplineRecordId_fkey" FOREIGN KEY ("disciplineRecordId") REFERENCES "DisciplineRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
