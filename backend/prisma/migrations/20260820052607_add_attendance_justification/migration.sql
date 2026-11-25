-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "justification" TEXT,
ADD COLUMN     "justifiedAt" TIMESTAMP(3),
ADD COLUMN     "justifiedById" TEXT;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_justifiedById_fkey" FOREIGN KEY ("justifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
