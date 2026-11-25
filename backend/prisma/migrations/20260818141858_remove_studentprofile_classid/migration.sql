/*
  Warnings:

  - You are about to drop the column `classId` on the `StudentProfile` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StudentProfile" DROP CONSTRAINT "StudentProfile_classId_fkey";

-- AlterTable
ALTER TABLE "StudentProfile" DROP COLUMN "classId";
