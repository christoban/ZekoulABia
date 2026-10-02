-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "announcementsOnly" BOOLEAN NOT NULL DEFAULT true;

-- RenameIndex
ALTER INDEX "TeachingAssignmentIssue_schoolId_academicYearId_classId_subject" RENAME TO "TeachingAssignmentIssue_schoolId_academicYearId_classId_sub_key";
