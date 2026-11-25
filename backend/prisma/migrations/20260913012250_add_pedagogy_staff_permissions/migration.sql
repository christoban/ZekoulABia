-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffPermissionType" ADD VALUE 'MANAGE_ANONYMAT';
ALTER TYPE "StaffPermissionType" ADD VALUE 'MANAGE_CLASSES';
ALTER TYPE "StaffPermissionType" ADD VALUE 'MANAGE_STUDENT_ASSIGNMENTS';
ALTER TYPE "StaffPermissionType" ADD VALUE 'MANAGE_TEACHING_ASSIGNMENTS';

-- AddForeignKey
ALTER TABLE "AnonymatCode" ADD CONSTRAINT "AnonymatCode_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
