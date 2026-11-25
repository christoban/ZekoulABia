-- CreateEnum
CREATE TYPE "ParentStudentRelation" AS ENUM ('PERE', 'MERE', 'TUTEUR_LEGAL', 'AUTRE');

-- CreateEnum
CREATE TYPE "StudentAccessScope" AS ENUM ('FULL', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "ProfileManagedBy" AS ENUM ('PARENT', 'STUDENT', 'SECRETARIAT');

-- AlterTable
ALTER TABLE "ParentStudent" ADD COLUMN     "contactPrincipal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "relation" "ParentStudentRelation" NOT NULL DEFAULT 'AUTRE',
ADD COLUMN     "responsableFinancier" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentOnboarding" ADD COLUMN     "accessProfile" JSONB,
ADD COLUMN     "completenessScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "numeroInterne" TEXT,
ADD COLUMN     "overrideCapacityReason" TEXT,
ADD COLUMN     "returnedComment" TEXT,
ADD COLUMN     "submittedById" TEXT,
ADD COLUMN     "validableSousReserve" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "numeroInterne" TEXT,
ADD COLUMN     "profileManagedBy" "ProfileManagedBy" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN     "studentAccessScope" "StudentAccessScope" NOT NULL DEFAULT 'FULL';

-- CreateTable
CREATE TABLE "EnrollmentDocumentRequirement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "applicableCase" TEXT NOT NULL DEFAULT 'TOUS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentDocument" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "requirementId" TEXT,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "note" TEXT,
    "fileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrollmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentDocumentRequirement_schoolId_idx" ON "EnrollmentDocumentRequirement"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentDocumentRequirement_schoolId_code_key" ON "EnrollmentDocumentRequirement"("schoolId", "code");

-- CreateIndex
CREATE INDEX "EnrollmentDocument_onboardingId_idx" ON "EnrollmentDocument"("onboardingId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentDocument_onboardingId_code_key" ON "EnrollmentDocument"("onboardingId", "code");

-- AddForeignKey
ALTER TABLE "EnrollmentDocumentRequirement" ADD CONSTRAINT "EnrollmentDocumentRequirement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentDocument" ADD CONSTRAINT "EnrollmentDocument_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "StudentOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentDocument" ADD CONSTRAINT "EnrollmentDocument_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "EnrollmentDocumentRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
