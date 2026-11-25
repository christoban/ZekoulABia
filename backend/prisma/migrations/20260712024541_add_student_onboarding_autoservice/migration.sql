-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'LINK_SENT', 'SUBMITTED', 'PENDING_VALIDATION', 'VALIDATED', 'ACTIVATED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OnboardingRecipient" AS ENUM ('ELEVE', 'PARENT', 'LES_DEUX');

-- CreateEnum
CREATE TYPE "OnboardingSource" AS ENUM ('IMPORT_MASSE', 'AUTOSERVICE', 'CONCOURS');

-- AlterTable
ALTER TABLE "EntranceExamSession" ADD COLUMN     "targetClassId" TEXT;

-- CreateTable
CREATE TABLE "StudentOnboarding" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "nomProvisoire" TEXT NOT NULL,
    "classId" TEXT,
    "contactEmail" TEXT,
    "contactTelephone" TEXT,
    "recipientType" "OnboardingRecipient" NOT NULL DEFAULT 'ELEVE',
    "sourceType" "OnboardingSource" NOT NULL DEFAULT 'AUTOSERVICE',
    "examCandidateId" TEXT,
    "token" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "tokenUsedAt" TIMESTAMP(3),
    "submittedData" JSONB,
    "submittedAt" TIMESTAMP(3),
    "matchScore" INTEGER,
    "matchedStudentId" TEXT,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdStudentId" TEXT,
    "remindersSentCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolOnboardingSettings" (
    "schoolId" TEXT NOT NULL,
    "selfServiceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultRecipient" "OnboardingRecipient" NOT NULL DEFAULT 'ELEVE',
    "ageThresholdForParent" INTEGER NOT NULL DEFAULT 15,
    "tokenExpiryDays" INTEGER NOT NULL DEFAULT 14,
    "reminderDelayDays" INTEGER[] DEFAULT ARRAY[3, 7]::INTEGER[],
    "escalationDelayDays" INTEGER NOT NULL DEFAULT 10,
    "responsableRole" "UserRole" NOT NULL DEFAULT 'ADMIN',

    CONSTRAINT "SchoolOnboardingSettings_pkey" PRIMARY KEY ("schoolId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentOnboarding_token_key" ON "StudentOnboarding"("token");

-- CreateIndex
CREATE INDEX "StudentOnboarding_schoolId_status_idx" ON "StudentOnboarding"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StudentOnboarding_token_idx" ON "StudentOnboarding"("token");

-- AddForeignKey
ALTER TABLE "StudentOnboarding" ADD CONSTRAINT "StudentOnboarding_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentOnboarding" ADD CONSTRAINT "StudentOnboarding_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentOnboarding" ADD CONSTRAINT "StudentOnboarding_examCandidateId_fkey" FOREIGN KEY ("examCandidateId") REFERENCES "EntranceExamCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentOnboarding" ADD CONSTRAINT "StudentOnboarding_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolOnboardingSettings" ADD CONSTRAINT "SchoolOnboardingSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
