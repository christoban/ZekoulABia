/*
  Warnings:

  - The `pebsFiliere` column on the `StudentProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PebsFiliere" AS ENUM ('FR_PEBS', 'EN_PEBS');

-- AlterTable
ALTER TABLE "StudentProfile" DROP COLUMN "pebsFiliere",
ADD COLUMN     "pebsFiliere" "PebsFiliere";
