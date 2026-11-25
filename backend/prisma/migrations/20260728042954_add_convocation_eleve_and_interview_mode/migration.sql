-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('DATE_PROPOSEE', 'DEMANDE_DISPONIBILITE');

-- AlterEnum
ALTER TYPE "StudentFollowUpActionType" ADD VALUE 'CONVOCATION_ELEVE';

-- AlterTable
ALTER TABLE "StudentFollowUpAction" ADD COLUMN     "interviewMode" "InterviewMode";
