-- CreateEnum
CREATE TYPE "UserAccessMode" AS ENUM ('FULL_ACCESS', 'SMS_ONLY');

-- AlterEnum
ALTER TYPE "StaffPermissionType" ADD VALUE 'MANAGE_ENROLLMENT';

-- AlterTable
ALTER TABLE "StudentOnboarding" ADD COLUMN     "eleveADispositif" BOOLEAN,
ADD COLUMN     "eleveDispositifOS" TEXT,
ADD COLUMN     "parentADispositif" BOOLEAN,
ADD COLUMN     "parentContactEmail" TEXT,
ADD COLUMN     "parentContactTelephone" TEXT,
ADD COLUMN     "parentDispositifOS" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessMode" "UserAccessMode" NOT NULL DEFAULT 'FULL_ACCESS';
